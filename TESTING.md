# HandOver testing

## Automated checks

Run before every release:

```bash
pnpm lint
pnpm build
```

Expected results:

- ESLint exits successfully.
- Next.js builds `/` and `/api/rpc` successfully.
- `SOURCE_SHA256.txt` matches `contracts/SuccessorBind.py`.
- `get_limits` returns role `80`, text `600`, note `300`, performances `30`, holders `10`, page size `50`.

## Runtime path

Use three StudioNet test wallets: author, successor, and outsider. Switch wallets in the browser wallet, then let the app update the connected address.

### Transferable undertaking

1. Connect the author wallet.
2. Open an undertaking whose language explicitly attaches the duty to the declared role.
3. Wait for the app to report accepted state; do not resubmit after a transaction hash is shown.
4. Confirm `RUNS_WITH_ROLE`, `TRANSFERABLE`, `OCCUPIED`, and author as current holder.
5. Record one performance note as the author. Confirm the counter and history become `1`.
6. Step down as the author. Confirm `VACANT` and author as last holder.
7. Attempt to retake the seat with the same author wallet. Expect rejection: `The previous holder may not retake the seat`.
8. Switch to the successor wallet and take the seat. Confirm `OCCUPIED`, holder count `2`, and successor as current holder.
9. Record one performance note as successor and confirm the immutable performance history shows both entries.

### Fixed undertaking

1. Connect the outsider wallet and open text that is explicitly personal to the author.
2. Confirm `TIED_TO_AUTHOR` and `FIXED`.
3. Confirm the Step down action remains unavailable.

### Negative authorization checks

- A non-holder cannot call `record_performance`.
- A non-holder cannot call `step_down`.
- Nobody can call `take_seat` while a seat is occupied.
- An unknown or malformed 64-character ID cannot be displayed as valid state.

## Accepted-state rule

A returned transaction hash proves submission, not final acceptance. HandOver polls `stateStatus: "accepted"`, updates the visible state only after the expected state transition appears, and checks the leader receipt only after the accepted-state polling window expires.

## Verified StudioNet evidence

Primary runtime verification completed on 27 September 2026 against contract `0x6eEBF98E208AD59c4070AAcb4Af40a3ff48F3DdD`.

- Undertaking ID: `45b31869bb05ff600ab1498cfc73a58ee06ef17070f061eaf0d744cfb30646ab`
- Author wallet: `0x923a09d0D6e5C242e36C3c1D2071835917cC0bDF`
- Successor wallet: `0x188f15bC55302ff2d55f0107300499aed23a831E`
- Observer wallet: `0x3b097922A159B8D81197F0b0d19ef3f29D2B3c8b`

Accepted-state observations:

1. Consensus returned `RUNS_WITH_ROLE`; the contract created a `TRANSFERABLE`, `OCCUPIED` seat with the author as holder.
2. The author appended performance entry 1 and stepped down; the seat became `VACANT`.
3. The previous-holder restriction prevented the author from immediately retaking the seat.
4. The successor took the vacant seat; state returned to `OCCUPIED` and holder history became `2/10`.
5. The successor appended performance entry 2; both immutable entries remained visible in order.
6. With the observer wallet connected, holder-only performance and step-down actions were unavailable, and the occupied seat could not be taken.

Final observed state: `RUNS_WITH_ROLE`, `TRANSFERABLE`, `OCCUPIED`, holders `2/10`, performances `2/30`, with the successor marked current.

The separate `TIED_TO_AUTHOR` / `FIXED` scenario remains an optional additional runtime check and is not claimed as part of this verified run.
