'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from 'genlayer-js'
import { studionet } from 'genlayer-js/chains'
import { getAddress } from 'viem'
import { CONTRACT_ADDRESS, STUDIO_CHAIN_ID, STUDIO_RPC } from './config'
import { normalizeError } from './errors'

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<any>
  on?: (event: string, listener: (...args: any[]) => void) => void
  removeListener?: (event: string, listener: (...args: any[]) => void) => void
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

export type UndertakingState = {
  undertaking_id: string
  author: string
  role_label: string
  text: string
  outcome_code: number
  outcome: 'RUNS_WITH_ROLE' | 'TIED_TO_AUTHOR'
  seat_mode: 'TRANSFERABLE' | 'FIXED'
  seat_state: 'OCCUPIED' | 'VACANT'
  holder: string
  last_holder: string
  holder_count: number
  performance_count: number
}

export type PerformanceEntry = { index: number; note: string; by: string }
export type HolderEntry = { index: number; wallet: string; is_current: boolean }

const readRpc = () =>
  typeof window === 'undefined' ? STUDIO_RPC : `${window.location.origin}/api/rpc`

const proxiedChain = () => ({
  ...studionet,
  rpcUrls: { default: { http: [readRpc()] } },
})

const getReadClient = () => createClient({ chain: proxiedChain() } as any)
const getWriteClient = (account: string) =>
  createClient({
    chain: proxiedChain(),
    account: getAddress(account) as any,
    provider: window.ethereum as any,
  } as any)

const STUDIO_CHAIN_HEX = `0x${STUDIO_CHAIN_ID.toString(16)}`

async function ensureStudioNet() {
  const ethereum = window.ethereum
  if (!ethereum) throw new Error('No browser wallet detected.')

  const current = await ethereum.request({ method: 'eth_chainId' })
  if (String(current).toLowerCase() === STUDIO_CHAIN_HEX) return

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: STUDIO_CHAIN_HEX }],
    })
    return
  } catch (error: any) {
    if (error?.code !== 4902 && error?.data?.originalError?.code !== 4902) throw error
  }

  await ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [{
      chainId: STUDIO_CHAIN_HEX,
      chainName: 'GenLayer StudioNet',
      rpcUrls: [STUDIO_RPC],
      nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
    }],
  })
  await ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: STUDIO_CHAIN_HEX }],
  })
}

const unpack = <T,>(raw: unknown): T => {
  if (raw && typeof raw === 'object' && 'result' in (raw as any)) {
    return unpack<T>((raw as any).result)
  }
  if (typeof raw === 'string') {
    try { return JSON.parse(raw.trim()) as T } catch { return raw as T }
  }
  return raw as T
}

const isAddress = (value: unknown) =>
  typeof value === 'string' && (/^0x[a-fA-F0-9]{40}$/.test(value) || value === '')
const isId = (value: unknown) => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value)
const isCount = (value: unknown) =>
  (typeof value === 'number' && Number.isFinite(value)) ||
  typeof value === 'bigint' ||
  (typeof value === 'string' && /^\d+$/.test(value.trim()))

function validateUndertaking(value: any): UndertakingState {
  if (
    !value || !isId(value.undertaking_id) || !isAddress(value.author) ||
    !isAddress(value.holder) || !isAddress(value.last_holder) ||
    typeof value.role_label !== 'string' || typeof value.text !== 'string' ||
    !['RUNS_WITH_ROLE', 'TIED_TO_AUTHOR'].includes(value.outcome) ||
    !['TRANSFERABLE', 'FIXED'].includes(value.seat_mode) ||
    !['OCCUPIED', 'VACANT'].includes(value.seat_state) ||
    !isCount(value.outcome_code) || !isCount(value.holder_count) ||
    !isCount(value.performance_count)
  ) throw new Error('Malformed get_undertaking response from RPC.')

  return {
    ...value,
    outcome_code: Number(value.outcome_code),
    holder_count: Number(value.holder_count),
    performance_count: Number(value.performance_count),
  }
}

function validatePerformances(value: any): PerformanceEntry[] {
  if (!Array.isArray(value)) throw new Error('Malformed performance history from RPC.')
  return value.map((item) => {
    if (!item || !isCount(item.index) || typeof item.note !== 'string' || !isAddress(item.by)) {
      throw new Error('Malformed performance entry from RPC.')
    }
    return { ...item, index: Number(item.index) }
  })
}

function validateHolders(value: any): HolderEntry[] {
  if (!Array.isArray(value)) throw new Error('Malformed holder history from RPC.')
  return value.map((item) => {
    if (!item || !isCount(item.index) || !isAddress(item.wallet) || typeof item.is_current !== 'boolean') {
      throw new Error('Malformed holder entry from RPC.')
    }
    return { ...item, index: Number(item.index) }
  })
}

async function read(functionName: string, args: Array<string | number> = []) {
  return getReadClient().readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    stateStatus: 'accepted',
  } as any)
}

async function submit(account: string, functionName: string, args: Array<string | number>) {
  if (!window.ethereum) throw new Error('No browser wallet detected.')
  await ensureStudioNet()
  const hash = await getWriteClient(account).writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    value: BigInt(0),
  } as any)
  return String(hash)
}

export async function connectWallet() {
  if (!window.ethereum) throw new Error('No browser wallet detected. Install MetaMask or a compatible wallet.')
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[]
  if (!accounts?.[0]) throw new Error('Wallet connection was not approved.')
  await ensureStudioNet()
  return getAddress(accounts[0])
}

export async function passiveWallet() {
  if (!window.ethereum) return ''
  const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[]
  return accounts?.[0] ? getAddress(accounts[0]) : ''
}

export async function leaderRollbackReason(hash: string): Promise<string | undefined> {
  try {
    const tx: any = await (getReadClient() as any).getTransaction({ hash })
    const consensus = tx?.consensus_data ?? tx?.consensusData
    let leader = consensus?.leader_receipt ?? consensus?.leaderReceipt
    if (Array.isArray(leader)) {
      leader = leader.find((entry: any) => String(entry?.mode ?? '').toUpperCase() === 'LEADER') ?? leader[0]
    }
    const result = String(leader?.execution_result ?? leader?.executionResult ?? '').toUpperCase()
    if (result !== 'ERROR' && result !== 'FINISHED_WITH_ERROR') return undefined
    for (const field of [leader?.error, leader?.message, leader?.return_data, leader?.returnData]) {
      if (typeof field === 'string' && field.trim()) return field.trim()
    }
    return 'Contract execution rolled back.'
  } catch { return undefined }
}

export const successorBind = {
  openUndertaking: (account: string, roleLabel: string, text: string) =>
    submit(account, 'open_undertaking', [roleLabel.trim(), text.trim()]),
  recordPerformance: (account: string, id: string, note: string) =>
    submit(account, 'record_performance', [id.trim().toLowerCase(), note.trim()]),
  stepDown: (account: string, id: string) =>
    submit(account, 'step_down', [id.trim().toLowerCase()]),
  takeSeat: (account: string, id: string) =>
    submit(account, 'take_seat', [id.trim().toLowerCase()]),
  getUndertaking: async (id: string) =>
    validateUndertaking(unpack(await read('get_undertaking', [id.trim().toLowerCase()]))),
  getPerformances: async (id: string) =>
    validatePerformances(unpack(await read('get_performances', [id.trim().toLowerCase(), 0, 30]))),
  getHolders: async (id: string) =>
    validateHolders(unpack(await read('get_holders', [id.trim().toLowerCase(), 0, 10]))),
  getLimits: async () => unpack<Record<string, number>>(await read('get_limits')),
}

export { normalizeError }
