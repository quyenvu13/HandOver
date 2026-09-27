'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Clipboard,
  ExternalLink,
  History,
  LoaderCircle,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  Wallet,
} from 'lucide-react'
import {
  connectWallet,
  leaderRollbackReason,
  normalizeError,
  passiveWallet,
  successorBind,
  type HolderEntry,
  type PerformanceEntry,
  type UndertakingState,
} from '@/lib/genlayer'
import { CONTRACT_ADDRESS, DEPLOY_TX_URL, EXPLORER_BASE, EXPLORER_URL } from '@/lib/config'
import { isContractId, pyLen, undertakingIdFor } from '@/lib/ids'

const RECENT_KEY = 'handover:recent-undertakings:v1'
const SAFE_TEXT_LENGTH = 150
const RESERVED = [
  '<UNTRUSTED_UNDERTAKING_TEXT>',
  '</UNTRUSTED_UNDERTAKING_TEXT>',
  '<UNTRUSTED_POSITION_LABEL>',
  '</UNTRUSTED_POSITION_LABEL>',
  'RUNS_WITH_ROLE',
  'TIED_TO_AUTHOR',
]

const short = (value: string, head = 6, tail = 5) =>
  value ? `${value.slice(0, head)}…${value.slice(-tail)}` : '—'
const sameAddress = (a: string, b: string) =>
  Boolean(a && b && a.toLowerCase() === b.toLowerCase())

function readRecent() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && isContractId(id)).slice(0, 5) : []
  } catch { return [] }
}

function remember(id: string) {
  const values = [id.toLowerCase(), ...readRecent().filter((item) => item.toLowerCase() !== id.toLowerCase())].slice(0, 5)
  localStorage.setItem(RECENT_KEY, JSON.stringify(values))
  return values
}

export default function HandOverApp() {
  const [account, setAccount] = useState('')
  const [undertakingId, setUndertakingId] = useState('')
  const [state, setState] = useState<UndertakingState | null>(null)
  const [performances, setPerformances] = useState<PerformanceEntry[]>([])
  const [holders, setHolders] = useState<HolderEntry[]>([])
  const [recent, setRecent] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : readRecent(),
  )
  const [roleLabel, setRoleLabel] = useState('Operations Lead')
  const [undertakingText, setUndertakingText] = useState('The holder of the Operations Lead role must publish the weekly service report.')
  const [note, setNote] = useState('Published the weekly service report and linked the incident summary.')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [txHash, setTxHash] = useState('')
  const [copied, setCopied] = useState('')
  const [activeTab, setActiveTab] = useState<'ledger' | 'holders'>('ledger')

  const connectedIsHolder = Boolean(state && sameAddress(account, state.holder))
  const connectedWasLast = Boolean(state && sameAddress(account, state.last_holder))
  const canStepDown = Boolean(state && connectedIsHolder && state.seat_mode === 'TRANSFERABLE' && state.seat_state === 'OCCUPIED')
  const canTakeSeat = Boolean(state && account && state.seat_state === 'VACANT' && !connectedWasLast)
  const textLength = pyLen(undertakingText.trim())
  const roleLength = pyLen(roleLabel.trim())
  const noteLength = pyLen(note.trim())
  const containsReserved = RESERVED.some((token) => `${roleLabel}\n${undertakingText}`.toUpperCase().includes(token))
  const safeToSubmit = roleLength > 0 && roleLength <= 80 && textLength > 0 && textLength <= SAFE_TEXT_LENGTH && !containsReserved

  const clearStatus = () => { setError(''); setMessage('') }

  const copy = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(key)
    window.setTimeout(() => setCopied(''), 1400)
  }

  const refresh = useCallback(async (idInput?: string, quiet = false) => {
    const id = (idInput || undertakingId).trim().toLowerCase()
    if (!isContractId(id)) {
      if (!quiet) setError('Enter a 64-character undertaking ID.')
      return null
    }
    if (!quiet) { clearStatus(); setBusy('refresh') }
    try {
      const [next, nextPerformances, nextHolders] = await Promise.all([
        successorBind.getUndertaking(id),
        successorBind.getPerformances(id),
        successorBind.getHolders(id),
      ])
      setState(next)
      setPerformances(nextPerformances)
      setHolders(nextHolders)
      setUndertakingId(id)
      setRecent(remember(id))
      if (!quiet) setMessage('Accepted state refreshed from StudioNet.')
      return next
    } catch (cause) {
      if (!quiet) setError(normalizeError(cause))
      return null
    } finally {
      if (!quiet) setBusy('')
    }
  }, [undertakingId])

  const waitForAccepted = useCallback(async (
    id: string,
    predicate: (value: UndertakingState) => boolean,
    hash: string,
    success: string,
  ) => {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 3200 : 4000))
      const latest = await refresh(id, true)
      if (latest && predicate(latest)) {
        setMessage(success)
        setBusy('')
        return
      }
    }
    const rollback = await leaderRollbackReason(hash)
    setBusy('')
    if (rollback) setError(`Transaction rolled back: ${rollback}`)
    else setMessage('Transaction submitted. Consensus is still settling; use Refresh accepted state shortly.')
  }, [refresh])

  const ensureWallet = async () => {
    if (account) return account
    const next = await connectWallet()
    setAccount(next)
    return next
  }

  const submitOpen = async () => {
    clearStatus()
    if (!safeToSubmit) {
      setError(textLength > SAFE_TEXT_LENGTH
        ? `Keep the undertaking at ${SAFE_TEXT_LENGTH} characters or fewer for the verified StudioNet calldata path.`
        : 'Complete both fields and remove reserved classifier tokens.')
      return
    }
    try {
      setBusy('open')
      const wallet = await ensureWallet()
      const id = undertakingIdFor(wallet, undertakingText)
      const hash = await successorBind.openUndertaking(wallet, roleLabel, undertakingText)
      setUndertakingId(id)
      setTxHash(hash)
      setMessage('Submitted. Waiting for GenLayer consensus and accepted state…')
      void waitForAccepted(id, (value) => value.undertaking_id === id, hash, 'Undertaking opened and accepted on StudioNet.')
    } catch (cause) {
      setBusy('')
      setError(normalizeError(cause))
    }
  }

  const submitPerformance = async () => {
    clearStatus()
    if (!state || !note.trim() || noteLength > 300) {
      setError('Enter a performance note between 1 and 300 characters.')
      return
    }
    try {
      setBusy('performance')
      const wallet = await ensureWallet()
      const before = state.performance_count
      const hash = await successorBind.recordPerformance(wallet, state.undertaking_id, note)
      setTxHash(hash)
      setMessage('Performance submitted. Waiting for accepted state…')
      void waitForAccepted(state.undertaking_id, (value) => value.performance_count > before, hash, 'Performance entry recorded on-chain.')
    } catch (cause) { setBusy(''); setError(normalizeError(cause)) }
  }

  const submitStepDown = async () => {
    clearStatus()
    if (!state) return
    try {
      setBusy('stepdown')
      const wallet = await ensureWallet()
      const hash = await successorBind.stepDown(wallet, state.undertaking_id)
      setTxHash(hash)
      setMessage('Step-down submitted. Waiting for accepted state…')
      void waitForAccepted(state.undertaking_id, (value) => value.seat_state === 'VACANT', hash, 'Seat is vacant. A different wallet may now take it.')
    } catch (cause) { setBusy(''); setError(normalizeError(cause)) }
  }

  const submitTakeSeat = async () => {
    clearStatus()
    if (!state) return
    try {
      setBusy('takeseat')
      const wallet = await ensureWallet()
      const hash = await successorBind.takeSeat(wallet, state.undertaking_id)
      setTxHash(hash)
      setMessage('Seat claim submitted. Waiting for accepted state…')
      void waitForAccepted(state.undertaking_id, (value) => sameAddress(value.holder, wallet), hash, 'The connected wallet now holds the role seat.')
    } catch (cause) { setBusy(''); setError(normalizeError(cause)) }
  }

  useEffect(() => {
    void passiveWallet().then(setAccount).catch(() => undefined)
    const ethereum = window.ethereum
    const onAccounts = (accounts: string[]) => setAccount(accounts?.[0] || '')
    ethereum?.on?.('accountsChanged', onAccounts)
    return () => ethereum?.removeListener?.('accountsChanged', onAccounts)
  }, [])

  useEffect(() => {
    const context = (document as any).modelContext
    if (!context?.registerTool) return
    const lifecycle = new AbortController()
    const report = () => undefined
    try {
      void Promise.resolve(context.registerTool({
        name: 'load_undertaking',
        title: 'Load undertaking',
        description: 'Read one SuccessorBind undertaking from accepted StudioNet state and show it in HandOver.',
        inputSchema: {
          type: 'object', properties: { undertakingId: { type: 'string', pattern: '^[a-fA-F0-9]{64}$' } },
          required: ['undertakingId'], additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async (input: any) => {
          if (!isContractId(input?.undertakingId || '')) throw new Error('Invalid undertaking ID')
          const value = await refresh(input.undertakingId)
          if (!value) throw new Error('Undertaking could not be loaded')
          return { id: value.undertaking_id, state: value.seat_state, mode: value.seat_mode, holder: value.holder }
        },
      }, { signal: lifecycle.signal })).catch(report)
      void Promise.resolve(context.registerTool({
        name: 'stage_new_undertaking',
        title: 'Stage new undertaking',
        description: 'Fill the HandOver creation form. This does not submit or request a wallet signature.',
        inputSchema: {
          type: 'object',
          properties: { roleLabel: { type: 'string', maxLength: 80 }, text: { type: 'string', maxLength: 150 } },
          required: ['roleLabel', 'text'], additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async (input: any) => {
          if (!input?.roleLabel?.trim() || !input?.text?.trim()) throw new Error('Both fields are required')
          setRoleLabel(input.roleLabel.trim()); setUndertakingText(input.text.trim())
          window.scrollTo({ top: 0, behavior: 'smooth' })
          return { staged: true, requiresWalletSignature: true }
        },
      }, { signal: lifecycle.signal })).catch(report)
    } catch { /* unsupported or partial WebMCP implementation */ }
    return () => lifecycle.abort()
  }, [refresh])

  const seatCopy = useMemo(() => {
    if (!state) return 'No undertaking loaded'
    if (state.seat_mode === 'FIXED') return 'This undertaking stays with its author.'
    if (state.seat_state === 'VACANT') return 'The transferable role seat is open.'
    return 'The undertaking follows the current role holder.'
  }, [state])

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="HandOver home">
          <span className="brand-mark"><ArrowRight size={20} /></span>
          <span><b>HandOver</b><small>role-bound undertakings</small></span>
        </a>
        <div className="network-pill"><span /> StudioNet · 61999</div>
        <div className="top-actions">
          <a className="ghost-button desktop-only" href={EXPLORER_URL} target="_blank" rel="noreferrer">
            {short(CONTRACT_ADDRESS)} <ExternalLink size={14} />
          </a>
          <button className="wallet-button" onClick={() => void ensureWallet().catch((cause) => setError(normalizeError(cause)))}>
            <Wallet size={16} /> {account ? short(account) : 'Connect wallet'}
          </button>
        </div>
      </header>

      <main id="top" className="workspace">
        <section className="intro-strip">
          <div>
            <p className="eyebrow">SUCCESSORBIND / ACCEPTED STATE</p>
            <h1>The person can change.<br />The undertaking keeps its place.</h1>
          </div>
          <p className="intro-copy">GenLayer classifies one narrow question: does this undertaking run with a declared role, or remain tied to its author? HandOver then keeps the seat and its performance trail on-chain.</p>
        </section>

        {(message || error || txHash) && (
          <section className={`status-ribbon ${error ? 'is-error' : ''}`} aria-live="polite">
            <div>{error ? '!' : <Check size={15} />}<span>{error || message}</span></div>
            {txHash && <a href={`${EXPLORER_BASE}/tx/${txHash}`} target="_blank" rel="noreferrer">View transaction <ExternalLink size={13} /></a>}
          </section>
        )}

        <div className="workspace-grid">
          <aside className="control-column">
            <section className="panel create-panel">
              <div className="section-heading"><span>01</span><div><p>Author desk</p><h2>Open an undertaking</h2></div></div>
              <label>Role label <em>{roleLength}/80</em></label>
              <input value={roleLabel} onChange={(event) => setRoleLabel(event.target.value)} maxLength={80} placeholder="e.g. Operations Lead" />
              <label>Undertaking text <em className={textLength > SAFE_TEXT_LENGTH ? 'warn' : ''}>{textLength}/{SAFE_TEXT_LENGTH} verified</em></label>
              <textarea value={undertakingText} onChange={(event) => setUndertakingText(event.target.value)} rows={5} maxLength={600} placeholder="Describe one obligation…" />
              <div className="calldata-meter"><span style={{ width: `${Math.min(100, textLength / SAFE_TEXT_LENGTH * 100)}%` }} /><small>{textLength <= SAFE_TEXT_LENGTH ? 'Within tested StudioNet calldata range' : 'Above tested frontend range'}</small></div>
              {containsReserved && <p className="field-error">Reserved classifier tokens are not allowed.</p>}
              <button className="primary-action" disabled={Boolean(busy) || !safeToSubmit} onClick={submitOpen}>
                {busy === 'open' ? <LoaderCircle className="spin" size={17} /> : <BriefcaseBusiness size={17} />}
                Open with GenLayer consensus
              </button>
              <p className="fine-print">One semantic write. The resulting seat mode is immutable.</p>
            </section>

            <section className="panel load-panel">
              <div className="section-heading"><span>02</span><div><p>Accepted state</p><h2>Open by ID</h2></div></div>
              <div className="load-row">
                <input value={undertakingId} onChange={(event) => setUndertakingId(event.target.value)} placeholder="64 hex characters" />
                <button aria-label="Load undertaking" disabled={busy === 'refresh'} onClick={() => void refresh()}>{busy === 'refresh' ? <LoaderCircle className="spin" size={17} /> : <ArrowDownToLine size={17} />}</button>
              </div>
              {recent.length > 0 && <div className="recent-list"><small>Recent in this browser</small>{recent.map((id) => <button key={id} onClick={() => void refresh(id)}>{short(id, 8, 6)}</button>)}</div>}
            </section>

            <section className="contract-card">
              <div><small>PROJECT CONTRACT</small><button onClick={() => copy(CONTRACT_ADDRESS, 'contract')}>{short(CONTRACT_ADDRESS, 10, 8)} {copied === 'contract' ? <Check size={13} /> : <Clipboard size={13} />}</button></div>
              <a href={DEPLOY_TX_URL} target="_blank" rel="noreferrer">Verified deployment <ExternalLink size={14} /></a>
            </section>
          </aside>

          <section className="main-column">
            {!state ? (
              <section className="empty-state panel">
                <span className="empty-icon"><UserRoundCheck size={31} /></span>
                <p className="eyebrow">ROLE SUCCESSION LEDGER</p>
                <h2>No undertaking loaded</h2>
                <p>Open a new undertaking or paste a 64-character ID. HandOver never invents a global list; it reads only accepted contract state.</p>
                <div className="empty-steps"><span>1 · classify</span><ArrowRight size={15} /><span>2 · perform</span><ArrowRight size={15} /><span>3 · hand over</span></div>
              </section>
            ) : (
              <>
                <section className="state-board panel">
                  <div className="board-header">
                    <div><p className="eyebrow">03 / UNDERTAKING</p><h2>{state.role_label}</h2></div>
                    <button className="refresh-button" onClick={() => void refresh()} disabled={Boolean(busy)}><RefreshCw size={15} className={busy === 'refresh' ? 'spin' : ''} /> Refresh accepted state</button>
                  </div>
                  <div className="state-badges"><span className={state.seat_mode === 'TRANSFERABLE' ? 'green' : 'amber'}>{state.seat_mode}</span><span>{state.seat_state}</span><span>{state.outcome}</span></div>
                  <blockquote>{state.text}</blockquote>
                  <div className="seat-rail">
                    <article><small>AUTHOR</small><strong>{short(state.author, 10, 8)}</strong><span>opened the undertaking</span></article>
                    <div className={`rail-node ${state.seat_state.toLowerCase()}`}><ArrowRight size={21} /><b>{state.seat_state}</b></div>
                    <article><small>CURRENT SEAT</small><strong>{state.holder ? short(state.holder, 10, 8) : 'Open seat'}</strong><span>{seatCopy}</span></article>
                  </div>
                  <div className="stats-row"><div><small>HOLDERS</small><strong>{state.holder_count}/10</strong></div><div><small>PERFORMANCES</small><strong>{state.performance_count}/30</strong></div><div><small>CONNECTED ROLE</small><strong>{connectedIsHolder ? 'Holder' : connectedWasLast ? 'Previous' : 'Observer'}</strong></div></div>
                  <div className="id-line"><span>ID {short(state.undertaking_id, 16, 12)}</span><button onClick={() => copy(state.undertaking_id, 'id')}>{copied === 'id' ? <Check size={14} /> : <Clipboard size={14} />}</button></div>
                </section>

                <div className="action-grid">
                  <section className="panel action-panel">
                    <div className="section-heading"><span>04</span><div><p>Proof of work</p><h2>Record performance</h2></div></div>
                    <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} maxLength={300} placeholder="What did the current holder complete?" />
                    <div className="action-meta"><span>{noteLength}/300</span><span>Current holder only</span></div>
                    <button className="secondary-action" disabled={Boolean(busy) || !connectedIsHolder || state.seat_state !== 'OCCUPIED' || !note.trim()} onClick={submitPerformance}>
                      {busy === 'performance' ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />} Record on-chain
                    </button>
                  </section>
                  <section className="panel action-panel seat-actions">
                    <div className="section-heading"><span>05</span><div><p>Seat control</p><h2>Hand over the role</h2></div></div>
                    {state.seat_mode === 'FIXED' ? <p className="action-explainer">Consensus tied this undertaking to its author. Its seat cannot transfer.</p> : state.seat_state === 'OCCUPIED' ? <p className="action-explainer">The current holder can leave the transferable seat vacant.</p> : <p className="action-explainer">Any wallet except the immediately previous holder may take the vacant seat.</p>}
                    <div className="seat-buttons">
                      <button disabled={Boolean(busy) || !canStepDown} onClick={submitStepDown}><LogOut size={16} /> Step down</button>
                      <button className="accent" disabled={Boolean(busy) || !canTakeSeat} onClick={submitTakeSeat}>{busy === 'takeseat' ? <LoaderCircle className="spin" size={16} /> : <LogIn size={16} />} Take vacant seat</button>
                    </div>
                    {connectedWasLast && state.seat_state === 'VACANT' && <p className="field-error">The previous holder cannot immediately retake the seat.</p>}
                  </section>
                </div>

                <section className="panel history-panel">
                  <div className="history-head"><div className="section-heading"><span>06</span><div><p>Immutable record</p><h2>Undertaking history</h2></div></div><div className="tabs"><button className={activeTab === 'ledger' ? 'active' : ''} onClick={() => setActiveTab('ledger')}>Performance</button><button className={activeTab === 'holders' ? 'active' : ''} onClick={() => setActiveTab('holders')}>Holders</button></div></div>
                  {activeTab === 'ledger' ? (
                    performances.length ? <div className="timeline">{performances.map((entry) => <article key={entry.index}><span>{String(entry.index).padStart(2, '0')}</span><div><strong>{entry.note}</strong><small>Recorded by {short(entry.by, 9, 7)}</small></div></article>)}</div> : <div className="history-empty"><History size={20} /> No performance has been recorded yet.</div>
                  ) : (
                    <div className="holder-list">{holders.map((entry) => <article key={entry.index}><span>{String(entry.index).padStart(2, '0')}</span><strong>{short(entry.wallet, 12, 10)}</strong>{entry.is_current && <em>current</em>}</article>)}</div>
                  )}
                </section>
              </>
            )}
          </section>
        </div>

        <section className="truth-section">
          <div><p className="eyebrow">WHAT CONSENSUS DECIDES</p><h2>One semantic classification.<br />Everything after it is deterministic.</h2></div>
          <div className="truth-grid"><article><span>RUNS_WITH_ROLE</span><h3>Transferable seat</h3><p>The undertaking survives a change in who fills the declared role.</p></article><article><span>TIED_TO_AUTHOR</span><h3>Fixed seat</h3><p>Ambiguous or personal undertakings remain with the author.</p></article><article><span>HONEST BOUNDARY</span><h3>Not identity proof</h3><p>Taking a seat is permissionless and does not prove real-world qualification.</p></article></div>
        </section>
      </main>

      <footer><span>HandOver · SuccessorBind v1</span><span>Contract state is authoritative · accepted-state reads</span></footer>
    </div>
  )
}
