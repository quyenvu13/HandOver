/* eslint-disable @typescript-eslint/no-explicit-any */
const collect = (error: unknown, depth = 0): string[] => {
  if (depth > 4 || error == null) return []
  const value = error as any
  const out: string[] = []
  for (const message of [
    value?.shortMessage,
    value?.details,
    value?.data?.message,
    value?.error?.message,
    value?.message,
    typeof error === 'string' ? error : '',
  ]) {
    if (typeof message === 'string' && message.trim()) out.push(message)
  }
  if (value?.cause) out.push(...collect(value.cause, depth + 1))
  return out
}

function extractContractRevert(raw: string) {
  for (const pattern of [
    /\[rollback\]\s*([^\n"]+)/i,
    /UserError[:\s]+([^\n"]+)/i,
    /execution reverted[:\s]+([^\n"]+)/i,
  ]) {
    const match = raw.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return ''
}

export function normalizeError(error: unknown) {
  const candidates = collect(error)
  const joined = candidates.join('\n')
  const revert = extractContractRevert(joined)
  if (revert) return `Contract rejected the call: ${revert}`

  const message = String(candidates[0] || 'Unknown error')
    .replace(/^Error:\s*/i, '')
    .trim()

  if (/user rejected|user denied|rejected the request/i.test(message)) {
    return 'Wallet request was rejected.'
  }
  if (/429|rate limit/i.test(message)) {
    return 'StudioNet is rate-limiting requests. Wait briefly, then refresh accepted state.'
  }
  if (/failed to fetch|network error|cors/i.test(message)) {
    return 'Network/RPC read failed. If a transaction hash was already returned, do not resubmit; refresh accepted state.'
  }
  return message
}
