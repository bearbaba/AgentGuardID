/* AgentGuard ID mainnet deployment companion.
   READ-ONLY: never invokes wallet connection or transaction methods. */
(() => {
  'use strict';
  const CFG = Object.freeze({
    chainId: 56,
    rpc: 'https://bsc-dataseed.bnbchain.org',
    agentId: '0x60b9262456de011f7d15a54cdd8c48baaa8b022f',
    explorer: 'https://bscscan.com'
  });
  const el = id => document.getElementById(id);
  let verified = null;

  function status(message, passed = false) {
    const node = el('verificationStatus');
    node.textContent = message;
    node.className = 'verification-note ' + (passed ? 'check-pass' : '');
  }
  function normalize(raw, label) {
    if (!window.ethers) throw Error('Ethers.js did not load. Please check your connection.');
    if (!window.ethers.isAddress(raw)) throw Error(label + ' is not a valid EVM address.');
    return window.ethers.getAddress(raw);
  }
  function reset() {
    verified = null;
    el('configOutput').textContent = 'Awaiting verified deployments. No mainnet contract addresses are configured yet.';
    el('copyConfig').disabled = true;
    el('copyForChat').disabled = true;
    el('explorerLinks').replaceChildren();
    status('Addresses changed. Verify both deployed contracts again.');
    const a = el('guardAddress').value.trim();
    el('guardConstructor').textContent = /^0x[0-9a-f]{40}$/i.test(a) ? a : 'Paste the deployed guard address above';
  }
  el('guardAddress').addEventListener('input', reset);
  el('targetAddress').addEventListener('input', reset);

  function showExplorer(address, label) {
    const a = document.createElement('a');
    a.href = CFG.explorer + '/address/' + address + '#code';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'small-link';
    a.textContent = 'Verify ' + label + ' on BscScan ↗';
    el('explorerLinks').appendChild(a);
  }
  async function verify() {
    reset();
    const guardAddress = normalize(el('guardAddress').value.trim(), 'AgentGuardID');
    const targetAddress = normalize(el('targetAddress').value.trim(), 'ProtectedTaskRegistry');
    if (guardAddress.toLowerCase() === targetAddress.toLowerCase()) throw Error('Two different contract addresses are required.');
    if (guardAddress.toLowerCase() === CFG.agentId.toLowerCase() ||
        targetAddress.toLowerCase() === CFG.agentId.toLowerCase()) throw Error('Do not use the official Agent ID registry as your own contract.');
    status('Reading BNB Chain mainnet bytecode and constructor-linked addresses…');
    const rpc = new window.ethers.JsonRpcProvider(CFG.rpc);
    const net = await rpc.getNetwork();
    if (net.chainId !== 56n) throw Error('RPC returned wrong chain ID: ' + String(net.chainId));
    const [registryCode, guardCode, targetCode] = await Promise.all([
      rpc.getCode(CFG.agentId), rpc.getCode(guardAddress), rpc.getCode(targetAddress)
    ]);
    if ([registryCode,guardCode,targetCode].some(v => v === '0x')) {
      throw Error('Contract bytecode missing. Wait for confirmed transactions and check both addresses.');
    }
    const guard = new window.ethers.Contract(guardAddress, ['function agentID() view returns (address)'], rpc);
    const target = new window.ethers.Contract(targetAddress, ['function guard() view returns (address)'], rpc);
    const [liveAgentId, liveGuard] = await Promise.all([guard.agentID(),target.guard()]);
    if (liveAgentId.toLowerCase() !== CFG.agentId.toLowerCase()) {
      throw Error('Guard does not reference the official Agent ID registry.');
    }
    if (liveGuard.toLowerCase() !== guardAddress.toLowerCase()) {
      throw Error('ProtectedTaskRegistry does not reference this AgentGuardID contract.');
    }
    const config = [
      '// BNB Chain mainnet: user-deployed, separately verified contracts.',
      '// Verify exact source code and compiler settings on BscScan independently.',
      'window.AGENTGUARD_CONFIG = Object.freeze({',
      '  chainId: 56,',
      "  chainName: 'BNB Smart Chain',",
      "  rpcUrl: 'https://bsc-dataseed.bnbchain.org',",
      "  explorer: 'https://bscscan.com',",
      "  officialAgentId: '" + CFG.agentId + "',",
      "  guardAddress: '" + guardAddress + "',",
      "  taskRegistryAddress: '" + targetAddress + "'",
      '});'
    ].join('\n');
    verified = {guardAddress,targetAddress,config};
    el('configOutput').textContent = config;
    el('copyConfig').disabled = false;
    el('copyForChat').disabled = false;
    status('✓ On-chain address wiring verified on BNB mainnet. NEXT: independently verify exact source on BscScan before activating the public app.', true);
    showExplorer(guardAddress,'AgentGuardID source');
    showExplorer(targetAddress,'ProtectedTaskRegistry source');
  }
  el('verifyContracts').addEventListener('click', async () => {
    try { await verify(); }
    catch (err) { status('Verification failed: ' + (err?.shortMessage || err?.message || String(err))); }
  });
  async function copy(value) {
    if (!navigator.clipboard?.writeText) throw Error('Clipboard access unavailable. Select and copy manually.');
    await navigator.clipboard.writeText(value);
  }
  el('copyRegistry').addEventListener('click', async () => {
    try { await copy(CFG.agentId); }
    catch (err) { status(err.message); }
  });
  el('copyGuard').addEventListener('click', async () => {
    try { await copy(normalize(el('guardAddress').value.trim(), 'AgentGuardID')); }
    catch (err) { status(err.message); }
  });
  el('copyConfig').addEventListener('click', async () => {
    if (!verified) return;
    try { await copy(verified.config); status('Copied config. Verify both sources on BscScan before publishing.', true); }
    catch (err) { status(err.message); }
  });
  el('copyForChat').addEventListener('click', async () => {
    if (!verified) return;
    const info = [
      'AgentGuardID BNB Chain mainnet deployments — chain ID 56',
      'AgentGuardID: ' + verified.guardAddress,
      'ProtectedTaskRegistry: ' + verified.targetAddress,
      'Official Agent ID registry: ' + CFG.agentId,
      'On-chain links: checked successfully (NOT source verification).',
      'Please verify source code on BscScan, then update web/config.js and redeploy Vercel.'
    ].join('\n');
    try { await copy(info); status('Copied public contract addresses for ChatGPT. Never send seed phrases or private keys.', true); }
    catch (err) { status(err.message); }
  });
})();