# AgentGuardID — BNB Chain mainnet deployment

## Status
Deployment **requires a human wallet signature and BNB gas**; neither ChatGPT nor the CI workflow holds a deployment key. Do not publish an address as live unless its creation transaction has finalized on BNB Chain, you have verified source code, and read-back checks succeed.

Static deployment companion: https://agentguardid.vercel.app/deploy

**Network:** BNB Smart Chain mainnet (chain ID 56, hex 0x38). Avoid BSC testnet 97.
**Official non-transferable Agent ID registry:** 0x60b9262456de011f7d15a54cdd8c48baaa8b022f. Check balanceOf(agent) > 0 for any Agent ID-holding wallet.

Official hackathon rules: https://www.binance.com/en/support/announcement/detail/95f5dbe0ea674a48a739b59e046648bf

## Before signing
- Verify the repository is https://github.com/bearbaba/AgentGuardID, main branch. Inspect both Solidity sources and GitHub Actions results.
- Use a browser extension wallet on BNB Chain mainnet, with only the BNB gas you intend to spend. The constructor VALUE must be zero.
- Never enter a seed phrase, private key, pairing code or secret in ChatGPT, GitHub, Remix file editor or this deployment companion.
- The guarded contract is not audited for custodying funds; it does not move funds. Do not send assets to it.
- Owner and Agent wallet addresses must be different later, and the Agent must hold official Agent ID. The deployer wallet does NOT have to hold Agent ID.

## 1. Deploy AgentGuardID (first)
Open the exact repository source in official Remix:
https://app.remix.live/#url=https://github.com/bearbaba/AgentGuardID/blob/main/contracts/AgentGuardID.sol

Select Solidity compiler **0.8.24**, optimizer **enabled**, optimizer runs **200** (the settings in foundry.toml). Compile and select **AgentGuardID** (not interface IAgentID) from the deployment contract dropdown.

In Deploy & Run, select **Browser Extension / Injected Provider**; verify chain 56 and wallet address. This MUST NOT be Remix VM. In the constructor enter:

    0x60b9262456de011f7d15a54cdd8c48baaa8b022f

Set transaction value 0 BNB. Review estimated gas and contract deployment transaction carefully, sign with your wallet, and wait for confirmed transaction. Save:
- Guard contract address
- Guard creation transaction hash
- Actual compiler version and optimizer settings

Verify read-only: agentID() == official registry.

## 2. Deploy ProtectedTaskRegistry (second)
Open:
https://app.remix.live/#url=https://github.com/bearbaba/AgentGuardID/blob/main/contracts/ProtectedTaskRegistry.sol

Use the same Solidity 0.8.24 compiler and optimizer (200 runs). Select contract **ProtectedTaskRegistry**.

Constructor guardAddress: YOUR newly deployed Guard address (not the registry).

With Browser Extension/Injected Provider on chain 56, VALUE 0 BNB, review and confirm the deployment. Save target contract address and creation transaction hash.

Verify read-only: guard() == deployed Guard contract.

## 3. Verify source code on BscScan
Visit both public BscScan contract pages:
https://bscscan.com/address/NEW_GUARD_ADDRESS#code
https://bscscan.com/address/NEW_TARGET_ADDRESS#code

Use BscScan's Contract → Verify and Publish flow, or Remix Contract Verification integration when available. Verify the EXACT source from the deployment commit using the ACTUAL compiler, optimizer and constructor arguments. For Remix 0.8.24, optimizer enabled, 200 runs; EVM version/metadata settings must also match the actual compilation. BscScan may require a verified-account API key for automated verification; use the manual verifier if preferred.

BscScan's code tab should explicitly show contract source verified for each address. Compilation passing CI does not mean the on-chain deployment is verified.

## 4. Validate wiring and activate the website
Open https://agentguardid.vercel.app/deploy. Paste BOTH deployed contract addresses. Click **Check deployed contracts (no gas)**. The companion validates:
1. BNB RPC chain ID is 56.
2. Bytecode exists at official registry, Guard, and Target.
3. Guard.agentID() references the official registry.
4. Target.guard() references your Guard.

These checks are not an audit, do not verify source code and cannot prove a contract is benign. Check BscScan verified-source status independently.

Once checks pass, copy the two public contract addresses into ChatGPT. Update ONLY the two addresses in web/config.js; leave official Agent ID registry unchanged. Merge via GitHub CI to trigger Vercel production sync, then repeat the main app's Verify contract wiring action.

## 5. Genuine end-to-end demonstration
1. Human wallet: createWorkspace(AGENT_ID_HOLDING_WALLET, dailyCap), using an agent address DIFFERENT from owner.
2. Human wallet: setTarget(workspaceId, PROTECTED_TASK_REGISTRY_ADDRESS, true).
3. Agent ID wallet: requestAuthorization(workspaceId, target, keccak256(exactIntentText), expiresAt).
4. Human wallet: inspect record on-chain, compare exact text/hash in app, approveAuthorization(id).
5. Agent ID wallet: recordTask(id, exactIntentHash, nonzeroResultHash) via ProtectedTaskRegistry.
6. Anyone: verify task receipt, inspect Guard/Target events and transaction hashes on BscScan. Replay of the same authorization must revert.

All state changes cost gas and need explicit user confirmation. Do not fabricate 30-Agent-ID activity. The hackathon Innovation eligibility requires at least 30 *genuine* Agent ID addresses interacting with the participating contracts during the contest window; the public proof-center query is bounded and does NOT establish total eligibility.

## Support / recovery
- Wallet says chain 97 or the UI says BSC testnet: do NOT sign, switch to BSC mainnet 56.
- Missing bytecode: recheck contract address, blockchain network, and confirmation status.
- Guard/Target linkage mismatch: do NOT update web/config.js. Check constructor arguments. Fixing an immutable address usually requires a new deployment and gas.
- If public BSC RPC errors, retry later or use a trusted alternative to manually check the contract; do not disable checks to force transactions.
- If BscScan rejects verification, match exact compiler release/build, optimizer, EVM target, constructor ABI args, metadata and exact source commit. Do not claim verified until public source is visible.
- If you discover a contract bug after deployment, stop new interactions; both Guard and Target here are non-upgradeable. The owner can disable workspaces when configured.

Never share secrets or private keys with anyone who offers to deploy on your behalf.