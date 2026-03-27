# Service Readiness

`agent-office` is service-ready only if all of the following conditions hold:

1. Build integrity
   - `npm run build` succeeds.
   - `npm run typecheck` succeeds.

2. Electron runtime integrity
   - Electron runtime binary dependencies are present on the host machine.
   - Native module rebuild path exists for Electron (`better-sqlite3` must be rebuilt for Electron ABI).

3. Renderer bootstrap integrity
   - The renderer can fail loudly instead of showing a silent black screen.
   - Preload exposes the required `agentOffice` bridge.

4. Agent configuration integrity
   - Main process returns normalized agent configs through IPC.
   - Settings UI loads saved agent configs on open.
   - Settings UI can persist updated agent configs.
   - Remote targets enforce required fields.

5. Local execution prerequisites
   - At least one built-in provider CLI is available.
   - If a provider is unavailable, the app falls back to an available provider and blocks saving invalid selections.

6. Operational visibility
   - Readiness can be re-checked by a single command.
   - Failures report concrete remediation targets.

7. Host runtime advisory
   - Electron system library checks are reported as warnings in environments where this shell cannot represent the final desktop runtime exactly.

Run:

```bash
npm run ready:check
```
