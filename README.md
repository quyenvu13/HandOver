# HandOver

HandOver is the project interface for the `SuccessorBind` GenLayer Intelligent Contract. It lets an author open one operational undertaking, lets GenLayer validators classify whether it follows a declared role or remains tied to the author, and then exposes a deterministic seat and performance ledger.

- Live application: [https://hand-over-roan.vercel.app](https://hand-over-roan.vercel.app)

## Live contract

- Network: GenLayer StudioNet (`61999`)
- Contract: [`0x6eEBF98E208AD59c4070AAcb4Af40a3ff48F3DdD`](https://explorer-studio.genlayer.com/address/0x6eEBF98E208AD59c4070AAcb4Af40a3ff48F3DdD)
- Deployment transaction: [`0x97e19ea7284fe3bde1d698bf1e8cbe631f3b447c111a96bc541a4fd1420d6a6e`](https://explorer-studio.genlayer.com/tx/0x97e19ea7284fe3bde1d698bf1e8cbe631f3b447c111a96bc541a4fd1420d6a6e)
- Contract source SHA-256: `ca48468c2854a616f14a64dbb9e30f1cdf0c6ee9a2fe97a05deeaaf4f2daeb54`

This deployment is intentionally separate from the Intelligent Contract-only submission address.

## What the product does

1. The author declares a role and writes an undertaking.
2. GenLayer consensus returns exactly one semantic result:
   - `RUNS_WITH_ROLE` creates a `TRANSFERABLE` seat.
   - `TIED_TO_AUTHOR` creates a `FIXED` seat.
3. The current holder may append performance notes.
4. A transferable holder may step down.
5. A different wallet may take the vacant seat; the immediately previous holder cannot retake it.

The semantic decision happens only in `open_undertaking`. Performance recording, step-down, seat-taking, pagination, and authorization checks are deterministic contract operations.

## Honest boundaries

- `take_seat` is permissionless and does not prove real-world identity or qualification.
- The contract has no administrator, clock, payment rail, or external web source.
- The previous-holder rule compares wallet addresses, not people.
- The frontend treats accepted contract state as authoritative and does not infer consensus results locally.
- The UI caps new undertaking text at the verified 150-character StudioNet path even though the contract-level maximum is 600 characters.

## Run locally

Requirements: Node.js 22+ and pnpm.

```bash
pnpm install
pnpm dev
```

Optional environment variables:

```bash
NEXT_PUBLIC_CONTRACT_ADDRESS=0x6eEBF98E208AD59c4070AAcb4Af40a3ff48F3DdD
NEXT_PUBLIC_STUDIO_RPC=https://studio.genlayer.com/api
NEXT_PUBLIC_EXPLORER_BASE=https://explorer-studio.genlayer.com
```

The same-origin route at `/api/rpc` proxies JSON-RPC calls to StudioNet so browser reads and the non-wallet RPC calls made during writes share one stable origin.

## Verification commands

```bash
pnpm lint
pnpm build
```

The included contract file has SHA-256 `ca48468c2854a616f14a64dbb9e30f1cdf0c6ee9a2fe97a05deeaaf4f2daeb54`. See [TESTING.md](./TESTING.md) for the runtime path.

## Verified StudioNet run

The primary succession path was completed against the deployment above on 27 September 2026.

- Undertaking ID: `45b31869bb05ff600ab1498cfc73a58ee06ef17070f061eaf0d744cfb30646ab`
- Consensus result: `RUNS_WITH_ROLE`
- Seat mode: `TRANSFERABLE`
- Final seat state: `OCCUPIED`
- Holder history: `2`
- Performance history: `2`

The author recorded performance and stepped down, the immediately previous holder was prevented from retaking the vacant seat, a second wallet took the seat and recorded a second performance entry, and an observer wallet could not use holder-only actions. Full wallet and outcome details are recorded in [TESTING.md](./TESTING.md).

## Repository map

- `app/handover-app.tsx` — wallet, accepted-state reads, writes, polling, and UI
- `app/api/rpc/route.ts` — same-origin StudioNet RPC proxy
- `lib/genlayer.ts` — typed GenLayer integration and response validation
- `lib/ids.ts` — Python-compatible normalization and undertaking ID derivation
- `contracts/SuccessorBind.py` — exact deployed Intelligent Contract source
- `TESTING.md` — concise runtime checklist
