# Security boundaries — AgentGuard ID

**This is a contest starter, not an audited financial product. No assets are custodied or transferred by the supplied contracts.**

## What the gate actually enforces

- Every assigned agent must hold an official BNB Chain Agent ID NFT (`balanceOf(agent) > 0`) at workspace setup, request, approval, and consumption.
- A separate workspace owner configures agent address, allowed target contract addresses, enabled state, and maximum actions/day.
- A request binds its original agent, target, exact `bytes32 payloadHash`, expiry (max seven days), and workspace ID.
- The workspace owner must approve before the action can be consumed; approvals can be cancelled.
- The *actual target application contract*, and not the agent, consumes the authorization. The target must authenticate its own `msg.sender` and pass that value as `agent`.
- Exactly one successful consumption per authorization, with a UTC calendar-day quota. Revocation and disabling apply immediately to future consumptions.
- Any effective change of assigned agent, enabled state, daily quota, or target allowance increments workspace revision and permanently invalidates all older outstanding approvals and requests. Reverting the configuration does not restore old permissions.
- Every meaningful state transition emits a structured event.

## What it cannot enforce

- It does not restrict arbitrary transactions from an external Agentic Wallet. A malicious agent can bypass it by calling an unrelated contract directly unless that target integrates the gate.
- It does not validate task content, ensure a user knows what bytes were hashed, or check off-chain behavior.
- It does not enforce USD spending limits or token movements. The example protected target stores task hashes only.
- Agent ID ownership proves possession of a non-transferable on-chain credential, not a human's legal identity or trustworthiness.
- The browser uses an injected EVM wallet; official Agentic Wallet custom contract calls may require opt-in Developer Mode and human confirmation. **Do not implement third-party QR sign-in/pairing.**

## Trust and permissions

- There is no global admin, pause key, minting, owner withdrawal, or upgrade proxy.
- Each workspace owner can rotate agent identity, allowlist/revoke app targets, change the limit, and disable the workspace.
- Users should not create workspaces with an agent that they do not trust or that they cannot control.
- Both the owner and agent can cancel requested/approved actions. Once any workspace configuration changes, prior outstanding authorizations remain invalid even after the original setting is restored.
- If a workspace owner is also the agent, independent human approval is not guaranteed. Real users should use separate human and agent addresses.

## Before mainnet

1. Compile with Solidity 0.8.24 and run `forge test -vv` plus independent static analysis.
2. Obtain a third-party security review for real-value use cases; there is no audit in this package.
3. Deploy and verify the guard with official Agent ID registry `0x60b9262456de011f7d15a54cdd8c48baaa8b022f`.
4. Deploy and verify the protected target with your guard address; initialize its address in the workspace allowlist.
5. Test with separate human owner and Agent ID holding agent addresses. Avoid seed phrase and secret collection.
6. Check transaction details, gas costs and decoded calldata every time before signing.
7. Publicly disclose all workspace owner permissions and avoid claims of automatic profitability.
