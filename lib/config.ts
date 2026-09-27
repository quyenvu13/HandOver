const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

const fallbackAddress = '0x6eEBF98E208AD59c4070AAcb4Af40a3ff48F3DdD'
const envAddress = String(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()

export const CONTRACT_ADDRESS = (
  ADDRESS_RE.test(envAddress) ? envAddress : fallbackAddress
) as `0x${string}`

export const STUDIO_RPC =
  String(process.env.NEXT_PUBLIC_STUDIO_RPC || '').trim() ||
  'https://studio.genlayer.com/api'

export const EXPLORER_BASE =
  String(process.env.NEXT_PUBLIC_EXPLORER_BASE || '').trim() ||
  'https://explorer-studio.genlayer.com'

export const EXPLORER_URL = `${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`
export const DEPLOY_TX =
  '0x97e19ea7284fe3bde1d698bf1e8cbe631f3b447c111a96bc541a4fd1420d6a6e'
export const DEPLOY_TX_URL = `${EXPLORER_BASE}/tx/${DEPLOY_TX}`
export const STUDIO_CHAIN_ID = 61999

