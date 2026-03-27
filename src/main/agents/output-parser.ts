import type { AgentEvent } from '../../shared/types'

/**
 * Parse Claude Code stream-json format (one JSON object per line)
 * into normalized AgentEvent objects.
 */
export async function* parseClaudeStreamJson(
  lines: AsyncIterable<string>
): AsyncIterable<AgentEvent> {
  let buffer = ''

  for await (const chunk of lines) {
    buffer += chunk
    const parts = buffer.split('\n')
    buffer = parts.pop() || ''

    for (const line of parts) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const obj = JSON.parse(trimmed)
        yield normalizeClaudeEvent(obj)
      } catch {
        // Non-JSON line, emit as text
        yield { type: 'text-delta', content: trimmed }
      }
    }
  }

  // Flush remaining buffer
  if (buffer.trim()) {
    try {
      const obj = JSON.parse(buffer.trim())
      yield normalizeClaudeEvent(obj)
    } catch {
      yield { type: 'text-delta', content: buffer.trim() }
    }
  }
}

function normalizeClaudeEvent(obj: Record<string, unknown>): AgentEvent {
  const type = obj.type as string

  if (type === 'assistant' && obj.message) {
    const msg = obj.message as Record<string, unknown>
    const content = msg.content
    if (Array.isArray(content)) {
      const textBlocks = content
        .filter((b: Record<string, unknown>) => b.type === 'text')
        .map((b: Record<string, unknown>) => b.text as string)
      return { type: 'text-delta', content: textBlocks.join('') }
    }
    return { type: 'text-delta', content: String(content || '') }
  }

  if (type === 'content_block_delta') {
    const delta = obj.delta as Record<string, unknown> | undefined
    if (delta?.type === 'text_delta') {
      return { type: 'text-delta', content: delta.text as string }
    }
  }

  if (type === 'tool_use' || (obj.content_block as Record<string, unknown>)?.type === 'tool_use') {
    return {
      type: 'tool-use',
      content: JSON.stringify(obj),
      metadata: obj as Record<string, unknown>
    }
  }

  if (type === 'result') {
    return {
      type: 'complete',
      content: typeof obj.result === 'string' ? obj.result : JSON.stringify(obj),
      metadata: obj as Record<string, unknown>
    }
  }

  // Fallback
  return { type: 'text-delta', content: JSON.stringify(obj) }
}

/**
 * Parse plain text stdout (for Codex, custom CLIs) into AgentEvent objects.
 * Simpler: each chunk is a text-delta, stream end is complete.
 */
export async function* parsePlainTextOutput(
  lines: AsyncIterable<string>
): AsyncIterable<AgentEvent> {
  let fullText = ''

  for await (const chunk of lines) {
    if (chunk) {
      fullText += chunk
      yield { type: 'text-delta', content: chunk }
    }
  }

  yield { type: 'complete', content: fullText }
}

/**
 * Parse Codex JSONL output into normalized AgentEvent objects.
 */
export async function* parseCodexJson(
  lines: AsyncIterable<string>
): AsyncIterable<AgentEvent> {
  let buffer = ''
  let fullText = ''

  for await (const chunk of lines) {
    buffer += sanitizeTerminalChunk(chunk)
    const parts = buffer.split('\n')
    buffer = parts.pop() || ''

    for (const line of parts) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const obj = JSON.parse(trimmed) as Record<string, unknown>
        const normalized = normalizeCodexEvent(obj)
        if (!normalized) continue

        if (normalized.type === 'text-delta' || normalized.type === 'complete') {
          fullText += normalized.content
        }

        yield normalized
      } catch {
        fullText += trimmed
        yield { type: 'text-delta', content: trimmed }
      }
    }
  }

  if (buffer.trim()) {
    try {
      const obj = JSON.parse(buffer.trim()) as Record<string, unknown>
      const normalized = normalizeCodexEvent(obj)
      if (normalized) {
        if (normalized.type === 'text-delta' || normalized.type === 'complete') {
          fullText += normalized.content
        }
        yield normalized
      }
    } catch {
      fullText += buffer.trim()
      yield { type: 'text-delta', content: buffer.trim() }
    }
  }

  if (fullText) {
    yield { type: 'complete', content: fullText }
  }
}

function sanitizeTerminalChunk(chunk: string): string {
  return chunk
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001A\u001C-\u001F\u007F]/g, '')
    .replace(/\r/g, '')
}

function normalizeCodexEvent(obj: Record<string, unknown>): AgentEvent | null {
  const type = typeof obj.type === 'string' ? obj.type : ''

  if (type === 'error') {
    const message = typeof obj.message === 'string'
      ? obj.message
      : typeof obj.error === 'string'
        ? obj.error
        : JSON.stringify(obj)
    return { type: 'error', content: message, metadata: obj }
  }

  if (type === 'item.completed') {
    const item = obj.item as Record<string, unknown> | undefined
    if (item?.type === 'agent_message') {
      const text = extractCodexText(item)
      return text ? { type: 'text-delta', content: text, metadata: obj } : null
    }
    if (item?.type === 'exec_command' || item?.type === 'tool_call') {
      return { type: 'tool-use', content: JSON.stringify(item), metadata: obj }
    }
  }

  if (type === 'item.delta') {
    const delta = obj.delta as Record<string, unknown> | undefined
    const text = extractCodexText(delta)
    return text ? { type: 'text-delta', content: text, metadata: obj } : null
  }

  if (type === 'response.completed' || type === 'task.completed') {
    const text = extractCodexText(obj)
    return text ? { type: 'complete', content: text, metadata: obj } : null
  }

  return null
}

function extractCodexText(value: unknown): string {
  if (!value || typeof value !== 'object') return ''

  const obj = value as Record<string, unknown>

  if (typeof obj.text === 'string') return obj.text
  if (typeof obj.content === 'string') return obj.content
  if (typeof obj.message === 'string') return obj.message

  if (Array.isArray(obj.content)) {
    return obj.content
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return ''
        const contentEntry = entry as Record<string, unknown>
        if (typeof contentEntry.text === 'string') return contentEntry.text
        if (typeof contentEntry.content === 'string') return contentEntry.content
        return ''
      })
      .join('')
  }

  if (obj.last_agent_message && typeof obj.last_agent_message === 'object') {
    return extractCodexText(obj.last_agent_message)
  }

  return ''
}
