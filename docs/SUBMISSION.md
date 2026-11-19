# Binance Wallet × BNB Chain Agent ID Hackathon — submission checklist

Official announcement: https://www.binance.com/en/support/announcement/detail/95f5dbe0ea674a48a739b59e046648bf

Deadline: **2026-12-09 08:00 UTC (15:00 Vietnam time)**. New and existing projects may enter. One project per team, no prior registration required.

- [ ] Deploy *real* interacting contracts on **BNB Smart Chain mainnet** (chain ID 56).
- [ ] Verify both contract sources publicly on BscScan; publish code on GitHub.
- [ ] Make the website live and ensure users can complete end-to-end operations.
- [ ] Use the official Agent ID registry on mainnet, not `MockAgentID`.
- [ ] Demonstrate actual `balanceOf` checks, exact-text/hash review, human authorization, live decision explanation and successful protected target action.
- [ ] Test different wallet addresses (a human controller and an Agent ID holder); demonstrate rejection of same-wallet workspace and stale-policy approvals.
- [ ] Recruit **at least 30 distinct real Agent ID holder addresses** to interact with submitted contract addresses during the submission window. Do not fake, sybil, or manipulate interaction counts.
- [ ] Submit project name, website, verified contract addresses, project GitHub URL, and description of core Agent ID usage using the official announcement's **Submit Project Now** link.
- [ ] Provide a 60–90 second original demo with hashes, verification, approval, and single-use execution.
- [ ] Disclose limitations, user approvals, permissions and risk boundaries prominently.
- [ ] Do not collect seeds, keys, pairing codes, API secrets; no third-party Binance Agentic Wallet QR sign-in.
- [ ] Keep screenshots, a transaction walkthrough and public BscScan links as evidence.

## Scoring priorities — Innovation Award

| Criterion | Weight | How this project addresses it |
|---|---:|---|
| Depth of Agent ID | 30% | Contract requires ID ownership for assigned agent at request, approval and consumption |
| Practicality | 25% | Human-controlled approvals for collaborating agent-based on-chain apps |
| Product completion | 25% | End-to-end on-chain demo; must be live and independently verified before submission |
| Innovation | 20% | Portable permission adapter pattern with replay protection and auditable decision path |

**Important:** The 30-ID threshold is a minimum requirement for *Innovation*, not a guarantee of a prize. The Pioneer ranking is based on genuine Agent ID interactions and other on-chain usage metrics; no award is guaranteed.

**Costs:** Frontend can be hosted free; real BNB Chain mainnet deployment and transactions require gas (BNB). No production actions have been executed by this package.
