# AgentGuard ID

**AI Agents propose. Humans authorize. Apps enforce.**

An independent BNB Chain hackathon prototype that uses Binance Wallet / SPACE ID **Agent ID** as an actual authorization condition, not merely a profile badge. The on-chain guard validates ownership of the non-transferable Agent ID NFT, enforces a human-owned allowlist and UTC daily action quotas, requires explicit owner approval, rejects self-approval by the agent, prevents replay, and emits an auditable history. An example `ProtectedTaskRegistry` shows how an application can refuse agent actions until the exact payload is approved, then record separate immutable **intent** and **agent-reported result** hashes as a public task receipt. The on-chain `explainAuthorization` function makes current permission failures inspectable without gas.

**Status:** [public static website](https://agentguardid.vercel.app) deployed on Vercel Hobby with GitHub CI passing. The **smart contracts are NOT yet deployed** on BNB Chain, verified on BscScan, independently audited, or submitted. UI is currently a read-only/prototype control panel; the public Agent ID eligibility checker works without connecting a wallet. The request inspector and live decision explainer work without a wallet after contract deployment; the approval button requires a verified exact-text/hash match and the separate owner wallet. Never describe the static website as a live mainnet contract integration.

## Project structure

```text
AgentGuardID/
  contracts/
    AgentGuardID.sol             # Identity-gated authorization, policy, audit events
    ProtectedTaskRegistry.sol    # Working target-side enforcement adapter example
    MockAgentID.sol              # LOCAL TEST ONLY; never deploy for hackathon
  test/AgentGuardID.t.sol        # 10 Foundry security and flow tests
  tests/frontend.test.mjs       # Zero-dependency frontend integrity tests
  web/
    index.html                  # Responsive four-tab dApp UI
    styles.css                  # Premium dark UI
    app.js                      # Explicit wallet actions using ethers v6
    config.js                   # Official mainnet registry + deployment placeholders
    vercel.json                 # Static deployment config
  docs/AGENTIC_WALLET.md        # Binance Agentic Wallet Developer Mode CLI walkthrough
  .github/workflows/ci.yml      # Auto compile/test when published to GitHub
  docs/SECURITY.md              # Actual enforced vs unenforced boundaries
  docs/SUBMISSION.md            # Hackathon requirements and milestones
  foundry.toml
```

## Zero-cost local preview

You can preview the site immediately. From this repository root:

```bash
cd web
python -m http.server 4173
# Visit http://localhost:4173
```

For the wallet contract methods, an injected EVM wallet is required. `web/config.js` intentionally contains **empty** deployment addresses. The UI detects that the mainnet protocol is not configured instead of fabricating a working integration. Ethers v6 is loaded from a pinned jsDelivr URL; for entirely offline hosting, vendor a reviewed version of the dependency.

## Smart-contract tests

Requires [Foundry](https://book.getfoundry.sh/getting-started/installation):

```bash
forge build --sizes
forge test -vv
```

The supplied test suite checks: single-use actions; no execution before approval; no impersonation; hash binding; per-day quota; time expiry; owner-only approval; Agent ID requirement; allowlist revocation; agent rotation. There is no external `forge-std` dependency. The simple UI integrity test uses Node.js 18+:

```bash
node tests/frontend.test.mjs
node --check web/app.js
```

**Verification status:** GitHub Actions has successfully compiled the contracts and run Foundry tests on main, with a separate passing frontend check. See the repository Actions tab. A public CI pass does not replace an external security audit.

## Deploy to BNB Chain mainnet (required by the contest)

> Deployment and subsequent state-changing interactions cost BNB gas. There is no zero-gas claim. No secrets or private keys belong in this repository.

1. Obtain a **real Agent ID** through the official Binance App: Wallet → Agent ID banner. Confirm which wallet address actually holds it; a Binance Agentic Wallet's address may differ from a regular wallet address.
2. Open [Remix](https://remix.ethereum.org) and compile `contracts/AgentGuardID.sol` with compiler 0.8.24, optimizer enabled (200 runs). For local work you can use Foundry instead.
3. Use BNB Chain **mainnet chain ID 56** in your wallet, then deploy `AgentGuardID` with constructor argument:
   `0x60b9262456de011f7d15a54cdd8c48baaa8b022f`
4. Deploy `ProtectedTaskRegistry` with constructor argument equal to the newly deployed `AgentGuardID` address.
5. **Verify and publish the exact source code of both contracts on BscScan.** Do not deploy `MockAgentID` on mainnet.
6. Set `guardAddress` and `taskRegistryAddress` in `web/config.js`. Verify the addresses on BscScan yourself. Only then is the browser app configured for the actual contracts.
7. Publish `web/` as a static Vercel project (framework preset **Other**, root directory `web`; no build command or paid service needed). The CI workflow can build contracts independently.
8. Use a **human owner wallet different from the Agent ID-holding wallet** to create a workspace specifying the **agent wallet** and a daily cap. The owner allowlists the actual `ProtectedTaskRegistry` address.
9. Using the agent wallet, submit a task intent; share its **exact text** with the human owner via a channel you trust; using the human wallet, inspect the on-chain request, verify that text hashes to the on-chain digest, then approve it. Using the agent wallet, publish the protected task along with its **result summary hash**; the website can verify the result text against the on-chain receipt afterward. A second execution should revert on-chain. Each state change requires explicit wallet confirmation and gas.

**Compatibility note:** Standard injected EVM wallet interactions are supported in the prototype. Official Binance Agentic Wallet restricts arbitrary smart contract calls by default; its optional Developer Mode must be enabled inside the Binance App and still requires simulation and explicit confirmation. The website also generates official `baw contract-call preview` commands for the Agentic Wallet address. See `docs/AGENTIC_WALLET.md` for the manual two-step flow. Never build a third-party QR or pairing-code login screen for the hackathon.

## Why Agent ID is essential

| Phase | On-chain Agent ID check | Who controls the step |
|---|---|---|
| Workspace setup | Designated agent must hold Agent ID | Human owner |
| Request | Caller must be bound agent and current Agent ID holder | Agent |
| Approve | Bound agent must still hold ID | Human owner |
| Execute | Guard confirms same original Agent ID holder, target, hash, limits, status | Integrated target app |

Changing the assigned agent, disabling the workspace, revoking a target, expiration, reaching a quota, or trying to reuse the approval stops execution. **Any effective agent/policy/target permission change increments a workspace revision and permanently invalidates previously requested, unconsumed authorizations — even if the owner reverses that change.** The actual target contract **must** supply its authenticated `msg.sender` to the guard. A target that does not integrate the guard is not protected.

## Limits and ethics

This is not wallet-level protection for arbitrary third-party transfers, not a payment/settlement protocol, and not a guarantee that an autonomous agent behaves safely off-chain. It holds **no funds**. `ProtectedTaskRegistry` persists authorized task intent hashes and separate claimed result hashes as an auditable receipt; it does not transfer assets or independently verify that AI results are correct. See `docs/SECURITY.md` for an explicit threat model.

For a serious financial use case, use a separate audited vault/executor contract that refuses all unauthorized actions at the funds boundary; do not imply these prototype contracts protect funds they never touch.

## Hackathon milestones

Official rules: https://www.binance.com/en/support/announcement/detail/95f5dbe0ea674a48a739b59e046648bf

- **Submission ends Dec 9, 2026 08:00 UTC = 15:00 (Vietnam)**.
- The Innovation Award scores Agent ID integration depth (30%), practicality (25%), product completion (25%), and innovation (20%).
- Eligible Innovation entries require a **live** product with **at least 30 genuine Agent ID-holding addresses** interacting with submitted contracts during the window.
- Contracts must be verified on BscScan; participants submit a site URL, contract addresses, source code and Agent ID usage description.
- No artificial traffic, mass account creation, key collection, or unapproved automatic transactions.
- Complete checklist and scorecard in `docs/SUBMISSION.md`.

### Submission description (English)

> AgentGuard ID is an on-chain authorization control plane for AI agents on BNB Chain. It uses the official non-transferable Agent ID registry as a required identity primitive, not a social profile. Human-controlled workspaces specify approved execution targets and daily action quotas. An agent submits a payload-bound intent; a workspace owner reviews and approves it; an integrated target smart contract consumes the single-use authorization before completing the task. Revocations, identity changes, expiration, replay protection, and audit events are enforced on-chain. Our protected task registry demonstrates the complete workflow without custodying user funds.

This is an independent project; it does not use the Binance brand in its name or suggest affiliation.
