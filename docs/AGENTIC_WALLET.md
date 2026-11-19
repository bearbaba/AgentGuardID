# Using official Binance Agentic Wallet for AgentGuard ID

Official source: https://web3.binance.com/en/dev-docs/products/agentic-wallet/use-cases/developer-mode

**This workflow never asks users to scan a third-party QR code or share a pairing code.** Set up and sign in to Agentic Wallet only using Binance's official Skills and App.

## Why it matters

Agent ID is associated with an Agentic Wallet. A standard browser wallet address and the official Agentic Wallet address can be different. Contract calls that should count toward the hackathon's Agent ID activity must originate from the actual ID-holding address.

Official Binance Agentic Wallet prevents arbitrary contract calls by default. The user must explicitly enable **Developer Mode in the Binance App**, where it has an independent allowance, expiry time, simulation and risk checks. The agent itself cannot enable the mode.

## Steps

1. Claim Agent ID in Binance App → Wallet → Agent ID; note the official ID-holding agent wallet address.
2. Install the official Binance Wallet skill (Node.js 18+):

   ```bash
   npx skills add binance/binance-skills-hub/skills/binance-web3/binance-agentic-wallet
   ```

3. Follow official Binance Wallet instructions to create and connect Agentic Wallet to your trusted local agent environment. Do not copy credentials into the project or a public issue.
4. Turn on Developer Mode **inside Binance App** and inspect its status:

   ```bash
   baw wallet settings --json
   ```

   Look for `devMode.enabled` and `devMode.expiresAt`.
5. On the AgentGuard website, fill the Request form (workspace ID, description, expiry). Expand **Use Binance Agentic Wallet · Developer Mode CLI**, enter the *actual* Agentic Wallet address and generate the **preview** command. Confirm the target address, calldata, amount `0` and risk assessment.
6. The CLI command uses the documented form:

   ```bash
   baw contract-call preview --binanceChainId 56 --from 0xYOUR_AGENT_WALLET --to 0xYOUR_GUARD --value 0 --inputData 0xYOUR_ENCODED_CALLDATA --json
   ```

7. Inspect the preview. An unsafe operation may be blocked. For a permitted operation, manually confirm in Binance App, then use the returned real `requestId`:

   ```bash
   baw contract-call execute --requestId THE_RETURNED_REQUEST_ID --json
   ```

8. Have the human controller **review/approve** the request from a separately owned EVM wallet using the website. This is a different contract call and a different role.
9. Return to the website's Execute tab, supply the issued authorization ID and the **identical task description**, expand the CLI generator, generate a *target contract* preview command, confirm it in Binance App, and execute it. Track the resulting transaction hash and confirm the guard's `AuthorizationConsumed` event.

## Main restrictions

- This capability can be unavailable for certain accounts or regions. Do not promise every user's Agentic Wallet can perform every custom call.
- A Developer Mode risk check can block a contract call. It cannot be bypassed by prompt tricks.
- Each state-changing transaction consumes BNB gas.
- The website does not transmit private keys or request wallet QR/pairing codes.
- This is a technical test workflow; real participant activity must be genuine. Do not automate Sybil account claims or spam interactions for the contest.
