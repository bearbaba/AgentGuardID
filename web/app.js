/* AgentGuard ID — transparent browser-wallet UI. No server, session capture or QR pairing. */
(() => {
  'use strict';
  const CFG = window.AGENTGUARD_CONFIG;
  const GUARD_ABI = [
    'function createWorkspace(address agent,uint32 dailyLimit) returns (uint256)',
    'function setTarget(uint256 workspaceId,address target,bool allowed)',
    'function setPolicy(uint256 workspaceId,uint32 dailyLimit,bool active)',
    'function setAgent(uint256 workspaceId,address agent)',
    'function requestAuthorization(uint256 workspaceId,address target,bytes32 payloadHash,uint64 expiresAt) returns (uint256)',
    'function approveAuthorization(uint256 authorizationId)',
    'function cancelAuthorization(uint256 authorizationId)',
    'function getTodayUsage(uint256 workspaceId) view returns (uint256 used,uint256 limit)',
    'function authorizations(uint256 authorizationId) view returns (uint256 workspaceId,address target,address agent,bytes32 payloadHash,uint64 expiresAt,uint8 status)',
    'function workspaces(uint256 workspaceId) view returns (address owner,address agent,uint32 dailyLimit,bool active)',
    'function allowedTargets(uint256 workspaceId,address target) view returns (bool)',
    'function explainAuthorization(uint256 authorizationId) view returns (uint8 decision,uint256 used,uint256 limit)',
    'event WorkspaceCreated(uint256 indexed workspaceId,address indexed owner,address indexed agent,uint32 dailyLimit)',
    'event AuthorizationRequested(uint256 indexed authorizationId,uint256 indexed workspaceId,address indexed agent,address target,bytes32 payloadHash,uint64 expiresAt)',
    'event AuthorizationConsumed(uint256 indexed authorizationId,uint256 indexed workspaceId,address indexed agent,address target,bytes32 payloadHash)'
  ];
  const TASK_ABI = [
    'function recordTask(uint256 authorizationId,bytes32 contentHash,bytes32 resultHash) returns (uint256)',
    'function taskCount() view returns (uint256)',
    'function tasks(uint256 taskId) view returns (address agent,bytes32 contentHash,bytes32 resultHash,uint64 timestamp,uint256 authorizationId)'
  ];
  const ID_ABI = ['function balanceOf(address owner) view returns (uint256)'];
  const el = id => document.getElementById(id);
  const statusNames = ['NONE', 'REQUESTED', 'APPROVED', 'CONSUMED', 'CANCELLED'];
  const decisionNames = [
    'READY — on-chain policy checks pass; target and payload still require validation at execution',
    'UNKNOWN — authorization not found', 'BLOCKED — not approved or already consumed/cancelled',
    'BLOCKED — authorization expired', 'BLOCKED — workspace paused',
    'BLOCKED — assigned agent changed', 'BLOCKED — Agent ID missing',
    'BLOCKED — target contract revoked', 'BLOCKED — policy changed after this request',
    'BLOCKED — daily action quota reached'
  ];
  let verifiedReview = null;
  let provider = null, signer = null, wallet = null;
  const configured = !!(CFG.guardAddress && CFG.taskRegistryAddress &&
    window.ethers?.isAddress(CFG.guardAddress) && window.ethers?.isAddress(CFG.taskRegistryAddress));

  function message(value, kind = '') {
    const node = el('feedback'); node.textContent = value; node.className = 'feedback ' + kind;
  }
  function fail(err) {
    const reason = err?.shortMessage || err?.reason || err?.info?.error?.message || err?.message || String(err);
    message('Error: ' + reason.slice(0, 320), 'error');
  }
  function requireConfigured() {
    if (!configured) throw Error('Contracts are not deployed/configured. Deploy and verify them on BNB Chain, then edit web/config.js.');
  }
  function validateAddress(value, label) {
    if (!window.ethers.isAddress(value)) throw Error(label + ' must be a valid 0x address.');
    return window.ethers.getAddress(value);
  }
  function positiveInt(inputId) {
    const value = el(inputId).value.trim();
    if (!/^[1-9][0-9]*$/.test(value)) throw Error('Enter a positive integer in ' + inputId);
    return BigInt(value);
  }
  function readGuard() {
    requireConfigured();
    return new window.ethers.Contract(
      CFG.guardAddress, GUARD_ABI, new window.ethers.JsonRpcProvider(CFG.rpcUrl, CFG.chainId)
    );
  }
  function guard() { requireConfigured(); return new window.ethers.Contract(CFG.guardAddress, GUARD_ABI, signer); }
  function target() { requireConfigured(); return new window.ethers.Contract(CFG.taskRegistryAddress, TASK_ABI, signer); }
  function readTarget() {
    requireConfigured();
    return new window.ethers.Contract(
      CFG.taskRegistryAddress, TASK_ABI, new window.ethers.JsonRpcProvider(CFG.rpcUrl, CFG.chainId)
    );
  }
  async function ensureWallet() {
    if (!window.ethers) throw Error('The ethers library was not loaded. Check your internet connection or host a pinned local copy.');
    if (!window.ethereum) throw Error('No injected EVM wallet found. Open with a supported wallet browser.');
    if (!provider || !signer) await connect();
    const chain = await window.ethereum.request({method: 'eth_chainId'});
    if (Number.parseInt(chain, 16) !== 56) {
      try { await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x38'}]}); }
      catch (err) {
        if (err?.code !== 4902) throw err;
        await window.ethereum.request({method:'wallet_addEthereumChain',params:[{
          chainId:'0x38',chainName:'BNB Smart Chain',nativeCurrency:{name:'BNB',symbol:'BNB',decimals:18},
          rpcUrls:[CFG.rpcUrl],blockExplorerUrls:[CFG.explorer]
        }]});
      }
      provider = new window.ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
      wallet = await signer.getAddress();
    }
  }
  async function connect() {
    if (!window.ethereum) throw Error('No wallet extension detected. Use a supported injected EVM wallet.');
    if (!window.ethers) throw Error('ethers.js is unavailable.');
    await window.ethereum.request({method:'eth_requestAccounts'});
    provider = new window.ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    wallet = await signer.getAddress();
    el('walletAddress').textContent = wallet;
    el('connectButton').textContent = wallet.slice(0, 6) + '…' + wallet.slice(-4);
    // The owner and agent must be separate addresses. Never auto-assign the owner as agent.
    await refreshIdentity();
  }
  async function refreshIdentity() {
    if (!wallet || !provider) return;
    try {
      const chain = await window.ethereum.request({method:'eth_chainId'});
      if (Number.parseInt(chain,16) !== 56) {
        el('agentIdentity').textContent = 'Switch to BNB Smart Chain to check Agent ID.';
        el('agentDot').className = 'dot neutral';
        return;
      }
      const id = new window.ethers.Contract(CFG.officialAgentId, ID_ABI, provider);
      const balance = await id.balanceOf(wallet);
      const verified = balance > 0n;
      el('agentIdentity').textContent = verified ? 'Verified Agent ID holder — on-chain balance > 0' : 'No Agent ID detected for this wallet address.';
      el('agentDot').className = verified ? 'dot verified' : 'dot neutral';
      message(verified ? 'Agent ID verified. You can request actions if this address is a workspace agent.' : 'Connected. Claim Agent ID in Binance App if this account is eligible; addresses must match.', verified ? 'ok' : '');
    } catch (err) { fail(err); }
  }
  async function send(call, eventName) {
    await ensureWallet();
    message('Review and confirm this transaction in your wallet. No transaction is sent automatically.');
    const tx = await call();
    message('Submitted: ' + tx.hash + ' — awaiting on-chain confirmation.');
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw Error('Transaction reverted on-chain.');
    const scan = CFG.explorer + '/tx/' + receipt.hash;
    let eventId = '';
    if (eventName) for (const log of receipt.logs) {
      try { const parsed = guard().interface.parseLog(log); if (parsed?.name === eventName) {
        eventId = ' · ID: ' + String(parsed.args[0]); break;
      }} catch (_) { /* log belongs to another contract */ }
    }
    message('Confirmed on BSC' + eventId + ' · ' + scan, 'ok');
    return receipt;
  }
  async function run(handler) { try { await handler(); } catch (err) { fail(err); } }
  function hook(id, handler) { el(id).addEventListener('click', () => run(handler)); }
  function setTab(tab) {
    document.querySelectorAll('.tab').forEach(node => {
      const active = node.dataset.tab === tab;
      node.classList.toggle('active',active); node.setAttribute('aria-selected',String(active));
    });
    document.querySelectorAll('.panel').forEach(node => {
      const active = node.dataset.panel === tab; node.classList.toggle('active',active); node.hidden = !active;
    });
  }
  document.querySelectorAll('.tab').forEach(node => node.addEventListener('click', () => setTab(node.dataset.tab)));
  hook('getStarted', async () => { el('workspace').scrollIntoView({behavior:'smooth'}); setTab('overview'); });
  hook('connectButton', connect);
  hook('checkIdentity', async () => {
    if (!window.ethers) throw Error('Ethers.js is unavailable for the public checker.');
    const address = validateAddress(el('identityAddress').value.trim(), 'Agent ID holder');
    const result = el('identityCheckResult');
    result.textContent = 'Reading official Agent ID ownership from BNB Chain…';
    try {
      const reader = new window.ethers.JsonRpcProvider(CFG.rpcUrl, CFG.chainId);
      const registry = new window.ethers.Contract(CFG.officialAgentId, ID_ABI, reader);
      const balance = await registry.balanceOf(address);
      result.textContent = balance > 0n
        ? '✓ Agent ID detected (' + String(balance) + ') for ' + address
        : 'No Agent ID held by ' + address + ' at the latest readable block.';
      message('Public Agent ID lookup completed. No wallet connection or gas required.', 'ok');
    } catch (err) {
      result.textContent = 'Unable to read the registry right now. Check the public RPC connection and try again.';
      throw err;
    }
  });
  hook('createWorkspace', async () => {
    await ensureWallet(); requireConfigured();
    const agent = validateAddress(el('agentAddress').value.trim(),'Agent');
    const cap = positiveInt('dailyLimit');
    if (cap > 10000n) throw Error('Daily limit cannot exceed 10,000.');
    await send(() => guard().createWorkspace(agent, cap),'WorkspaceCreated');
  });
  async function setTarget(allowed) {
    await ensureWallet(); requireConfigured();
    const wid = positiveInt('policyWorkspaceId');
    const address = validateAddress(el('targetAddress').value.trim(),'Target contract');
    await send(() => guard().setTarget(wid,address,allowed));
  }
  hook('allowTarget', async () => setTarget(true));
  hook('denyTarget', async () => setTarget(false));
  hook('updatePolicy', async () => {
    await ensureWallet(); requireConfigured();
    const wid = positiveInt('advancedWorkspaceId');
    const limit = positiveInt('advancedDailyLimit');
    if (limit > 10000n) throw Error('Daily limit cannot exceed 10,000.');
    const active = el('advancedStatus').value === 'true';
    await send(() => guard().setPolicy(wid,limit,active));
  });
  hook('rotateAgent', async () => {
    await ensureWallet(); requireConfigured();
    const wid = positiveInt('advancedWorkspaceId');
    const agent = validateAddress(el('replacementAgent').value.trim(),'Replacement agent');
    await send(() => guard().setAgent(wid,agent));
  });
  hook('requestAuthorization', async () => {
    await ensureWallet(); requireConfigured();
    const wid = positiveInt('requestWorkspaceId');
    const description = el('taskDescription').value.trim();
    if (!description || description.length > 1000) throw Error('Task description must be 1–1000 characters.');
    const hours = positiveInt('expiryHours');
    if (hours > 168n) throw Error('Expiry must be 168 hours or less.');
    const hash = window.ethers.keccak256(window.ethers.toUtf8Bytes(description));
    const expiry = BigInt(Math.floor(Date.now()/1000)) + hours * 3600n;
    message('The task Keccak-256 hash is ' + hash + '. Copy your exact description for execution.');
    await send(() => guard().requestAuthorization(wid,CFG.taskRegistryAddress,hash,expiry),'AuthorizationRequested');
  });
  const resetReview = () => {
    verifiedReview = null;
    el('approveAuthorization').disabled = true;
    el('payloadVerification').textContent = 'Not verified. Compare the exact task description before approving.';
  };
  el('reviewDescription').addEventListener('input', resetReview);
  el('approveId').addEventListener('input', resetReview);
  async function inspectRequest() {
    requireConfigured();
    const id = positiveInt('approveId');
    const reader = readGuard();
    const record = await reader.authorizations(id);
    if (record.workspaceId === 0n) throw Error('Authorization ID does not exist.');
    const w = await reader.workspaces(record.workspaceId);
    const [decision, used, limit] = await reader.explainAuthorization(id);
    el('authorizationDetails').textContent =
      'Workspace: ' + record.workspaceId + '\nOwner: ' + w.owner + '\nAgent: ' + record.agent +
      '\nTarget: ' + record.target + '\nPayload hash: ' + record.payloadHash +
      '\nExpires: ' + new Date(Number(record.expiresAt)*1000).toISOString() +
      '\nStatus: ' + statusNames[Number(record.status)] +
      '\nReadiness: ' + decisionNames[Number(decision)] + '\nDaily usage (UTC): ' + used + '/' + limit;
    return { id, record, workspace: w };
  }
  hook('inspectAuthorization', async () => {
    resetReview();
    await inspectRequest();
    message('Read-only authorization and decision explanation loaded. No wallet needed.', 'ok');
  });
  hook('verifyPayload', async () => {
    resetReview();
    if (!window.ethers) throw Error('Ethers.js is unavailable.');
    const description = el('reviewDescription').value;
    if (!description.trim()) throw Error('Paste the exact full task description provided by the agent.');
    const {id, record, workspace} = await inspectRequest();
    if (Number(record.status) !== 1) throw Error('Only a pending request can be approved.');
    if (record.target.toLowerCase() !== CFG.taskRegistryAddress.toLowerCase()) {
      throw Error('Request target differs from configured protected app.');
    }
    if (workspace.owner.toLowerCase() === record.agent.toLowerCase()) {
      throw Error('Owner and agent must be separate addresses.');
    }
    const digest = window.ethers.keccak256(window.ethers.toUtf8Bytes(description));
    if (digest.toLowerCase() !== record.payloadHash.toLowerCase()) {
      el('payloadVerification').textContent = 'MISMATCH — supplied task text does not match on-chain payload hash.';
      throw Error('Payload mismatch. Do not approve.');
    }
    verifiedReview = { id: id.toString(), hash: digest, text: description };
    el('approveAuthorization').disabled = false;
    el('payloadVerification').textContent = '✓ MATCH — exact description hashes to the on-chain request. Confirm the task and target before signing.';
    message('Content and on-chain payload hash match. Owner wallet approval is still required.', 'ok');
  });
  hook('approveAuthorization', async () => {
    await ensureWallet(); requireConfigured();
    const id = positiveInt('approveId');
    if (!verifiedReview || verifiedReview.id !== id.toString() ||
        verifiedReview.text !== el('reviewDescription').value) {
      throw Error('First verify the exact task description against this authorization hash.');
    }
    const record = await guard().authorizations(id);
    const liveDigest = window.ethers.keccak256(window.ethers.toUtf8Bytes(el('reviewDescription').value));
    if (Number(record.status) !== 1 || record.payloadHash.toLowerCase() !== liveDigest.toLowerCase()) {
      resetReview();
      throw Error('Authorization changed since verification. Inspect and verify again.');
    }
    const w = await guard().workspaces(record.workspaceId);
    if (wallet.toLowerCase() !== w.owner.toLowerCase()) throw Error('Connect the separate human owner wallet to approve.');
    await send(() => guard().approveAuthorization(id));
    resetReview();
  });
  hook('cancelAuthorization', async () => {
    await ensureWallet(); requireConfigured();
    const id = positiveInt('approveId');
    await send(() => guard().cancelAuthorization(id));
  });
  hook('executeTask', async () => {
    await ensureWallet(); requireConfigured();
    const id = positiveInt('executeId');
    const description = el('executionDescription').value.trim();
    const result = el('executionResult').value.trim();
    if (!description) throw Error('Enter the exact description used when requesting approval.');
    if (!result) throw Error('Enter a non-empty result summary to commit as a receipt.');
    const hash = window.ethers.keccak256(window.ethers.toUtf8Bytes(description));
    const resultHash = window.ethers.keccak256(window.ethers.toUtf8Bytes(result));
    await send(() => target().recordTask(id,hash,resultHash));
  });
  hook('verifyReceipt', async () => {
    if (!window.ethers) throw Error('Ethers.js unavailable.');
    const taskIdText = el('receiptTaskId').value.trim();
    if (!/^(0|[1-9][0-9]*)$/.test(taskIdText)) throw Error('Enter a nonnegative task ID.');
    const taskId = BigInt(taskIdText);
    const registry = readTarget();
    const count = await registry.taskCount();
    if (taskId >= count) throw Error('Task receipt not found on-chain.');
    const task = await registry.tasks(taskId);
    const result = el('receiptResultText').value.trim();
    const computedHash = result ? window.ethers.keccak256(window.ethers.toUtf8Bytes(result)) : null;
    const match = computedHash && computedHash.toLowerCase() === task.resultHash.toLowerCase();
    el('receiptDetails').textContent =
      'Task #' + taskId + '\nAgent: ' + task.agent + '\nAuthorization: ' + task.authorizationId +
      '\nIntent hash: ' + task.contentHash + '\nResult hash: ' + task.resultHash +
      '\nRecorded: ' + new Date(Number(task.timestamp)*1000).toISOString() +
      '\nResult check: ' + (result ? (match ? 'MATCH — exact result text matches the stored hash'
        : 'MISMATCH — provided result differs from the stored commitment') : 'No result text supplied; commitment only') +
      '\nImportant: A matching hash does not prove the agent report is true.';
    message(match ? 'Result receipt verified against its on-chain hash.' : 'Task receipt read without wallet connection.', match ? 'ok' : '');
  });
  function cliCommand(from, to, calldata) {
    return 'baw contract-call preview --binanceChainId 56 --from ' + from +
      ' --to ' + to + ' --value 0 --inputData ' + calldata + ' --json' +
      '\n\nAfter preview returns a requestId, inspect it and confirm in the Binance App, then run:' +
      '\nbaw contract-call execute --requestId YOUR_PREVIEW_REQUEST_ID --json';
  }
  hook('generateRequestCLI', async () => {
    requireConfigured();
    if (!window.ethers) throw Error('ethers.js unavailable.');
    const from = validateAddress(el('cliFrom').value.trim(),'Agentic Wallet');
    const workspaceId = positiveInt('requestWorkspaceId');
    const description = el('taskDescription').value.trim();
    if (!description || description.length > 1000) throw Error('Enter a 1–1000 character task description in the request form.');
    const hours = positiveInt('expiryHours');
    if (hours > 168n) throw Error('Expiry must be 168 hours or less.');
    const expiry = BigInt(Math.floor(Date.now()/1000)) + hours * 3600n;
    const hash = window.ethers.keccak256(window.ethers.toUtf8Bytes(description));
    const data = new window.ethers.Interface(GUARD_ABI).encodeFunctionData('requestAuthorization',
      [workspaceId, CFG.taskRegistryAddress, hash, expiry]);
    el('cliRequestOutput').textContent = cliCommand(from, CFG.guardAddress, data);
    message('Encoded calldata for Agentic Wallet. Check the account, destination and hash before proceeding.', 'ok');
  });
  hook('generateExecuteCLI', async () => {
    requireConfigured();
    if (!window.ethers) throw Error('ethers.js unavailable.');
    const from = validateAddress(el('cliExecuteFrom').value.trim(),'Agentic Wallet');
    const id = positiveInt('executeId');
    const description = el('executionDescription').value.trim();
    if (!description) throw Error('Enter the exact description approved for execution.');
    const result = el('executionResult').value.trim();
    if (!result) throw Error('Enter the result summary in the execution form.');
    const hash = window.ethers.keccak256(window.ethers.toUtf8Bytes(description));
    const resultHash = window.ethers.keccak256(window.ethers.toUtf8Bytes(result));
    const data = new window.ethers.Interface(TASK_ABI).encodeFunctionData('recordTask',[id,hash,resultHash]);
    el('cliExecuteOutput').textContent = cliCommand(from, CFG.taskRegistryAddress, data);
    message('Encoded protected target call. Review the preview and explicitly approve in Binance App.', 'ok');
  });
  hook('checkUsage', async () => {
    requireConfigured();
    const wid = positiveInt('usageWorkspaceId');
    const [used, cap] = await readGuard().getTodayUsage(wid);
    el('dailyUsage').textContent = String(used) + ' / ' + String(cap);
    message('Daily usage read on-chain. Day boundaries follow UTC.', 'ok');
  });
  if (configured) {
    el('deploymentStatus').textContent = 'Mainnet addresses configured';
    el('deploymentStatus').className = 'status-chip success';
    el('guardStatus').textContent = CFG.guardAddress;
    el('guardDot').className = 'dot verified';
    el('guardDescription').textContent = 'Check BscScan for source verification and deployment history.';
    el('targetAddress').value = CFG.taskRegistryAddress;
    el('guardExplorer').href = CFG.explorer+'/address/'+CFG.guardAddress+'#events';
  }
  if (window.ethereum) {
    window.ethereum.on?.('accountsChanged', () => {provider=null;signer=null;wallet=null;el('connectButton').textContent='Connect wallet';el('walletAddress').textContent='Not connected';el('agentIdentity').textContent='Reconnect to verify Agent ID.';el('agentDot').className='dot neutral';});
    window.ethereum.on?.('chainChanged', () => {provider=null;signer=null;wallet=null;el('agentIdentity').textContent='Network changed. Reconnect to verify.';el('agentDot').className='dot neutral';});
  }
})();
