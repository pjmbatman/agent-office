#!/usr/bin/env python3

import json
import os
import pty
import subprocess
import sys
from typing import Optional


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"exitCode": 1, "error": "Missing runner config path"}))
        return 1

    config_path = sys.argv[1]

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
    except Exception as exc:
        print(json.dumps({"exitCode": 1, "error": f"Failed to read runner config: {exc}"}))
        return 1

    env = os.environ.copy()
    cwd = config.get("cwd") or os.getcwd()
    command = config.get("command") or "codex"
    args = config.get("args") or []
    output_file = config.get("outputFile")

    master_fd, slave_fd = pty.openpty()
    transcript = b""

    try:
        proc = subprocess.Popen(
            [command, *args],
            cwd=cwd,
            env=env,
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            close_fds=True,
        )
    except Exception as exc:
        os.close(master_fd)
        os.close(slave_fd)
        print(json.dumps({"exitCode": 1, "error": str(exc), "outputText": read_output(output_file)}))
        return 1

    os.close(slave_fd)

    while True:
        try:
            chunk = os.read(master_fd, 4096)
            if not chunk:
                break
            transcript += chunk
        except OSError:
            break

    os.close(master_fd)
    exit_code = proc.wait()
    output_text = read_output(output_file)

    result = {
        "exitCode": exit_code,
        "outputText": output_text,
        "stdout": transcript.decode("utf-8", errors="replace"),
        "stderr": "",
    }
    print(json.dumps(result, ensure_ascii=False))
    return 0


def read_output(path: Optional[str]) -> str:
    if not path:
        return ""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception:
        return ""


if __name__ == "__main__":
    raise SystemExit(main())
