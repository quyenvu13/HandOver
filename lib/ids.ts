import { keccak256, toBytes } from 'viem'

const PY_SPACE =
  '\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000'
const PY_TRIM_START = new RegExp('^[' + PY_SPACE + ']+')
const PY_TRIM_END = new RegExp('[' + PY_SPACE + ']+$')

export function pyStrip(value: string) {
  return value.replace(PY_TRIM_START, '').replace(PY_TRIM_END, '')
}

/** Match Python's `" ".join(value.split())` exactly. */
export function pyCollapse(value: string) {
  return value.split(new RegExp('[' + PY_SPACE + ']+')).filter(Boolean).join(' ')
}

export function pyLen(value: string) {
  return Array.from(value).length
}

export function undertakingIdFor(author: string, text: string) {
  const normalized = pyCollapse(pyStrip(text))
  const payload =
    'SUCCESSOR_BIND:UNDERTAKING:V1|' +
    author.toLowerCase() +
    '|' +
    pyLen(normalized) +
    '|' +
    normalized

  return keccak256(toBytes(payload)).slice(2).toLowerCase()
}

export function isContractId(value: string) {
  return /^[a-fA-F0-9]{64}$/.test(value.trim())
}

