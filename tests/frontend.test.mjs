import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const code = fs.readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const config = fs.readFileSync(new URL('../web/config.js', import.meta.url), 'utf8');

for (const id of ['connectButton','createWorkspace','allowTarget','denyTarget','requestAuthorization',
  'inspectAuthorization','approveAuthorization','cancelAuthorization','executeTask','checkUsage',
  'updatePolicy','rotateAgent','deploymentStatus','agentIdentity','checkIdentity','identityAddress','identityCheckResult','verifyPayload','reviewDescription','payloadVerification','executionResult','verifyReceipt','receiptTaskId','receiptResultText','receiptDetails','verifyWiring','wiringCheck','evidenceFromBlock','evidenceToBlock','scanParticipationEvidence','participationSummary','evidenceLinks']) {
  assert.match(html, new RegExp(`id="${id}"`), `missing UI control ${id}`);
  if (!['deploymentStatus','agentIdentity','identityAddress','identityCheckResult','reviewDescription','payloadVerification','executionResult','receiptTaskId','receiptResultText','receiptDetails','wiringCheck','evidenceFromBlock','evidenceToBlock','participationSummary','evidenceLinks'].includes(id)) assert.match(code, new RegExp(`'${id}'`));
}
assert.match(config, /0x60b9262456de011f7d15a54cdd8c48baaa8b022f/i);
assert.match(config, /guardAddress:\s*''/);
assert.match(config, /taskRegistryAddress:\s*''/);
assert.match(code, /eth_requestAccounts/);
assert.match(code, /wallet_switchEthereumChain/);
assert.match(code, /keccak256/);
assert.match(code, /approveAuthorization/);
assert.match(code, /recordTask/);
assert.match(code, /JsonRpcProvider\(CFG\.rpcUrl, CFG\.chainId\)/);
assert.match(code, /hook\('checkIdentity'/);
assert.match(code, /hook\('verifyPayload'/);
assert.match(code, /explainAuthorization/);
assert.match(code, /verifiedReview/);
assert.match(code, /readTarget\(\)/);
assert.match(code, /resultHash/);
assert.match(code, /hook\('verifyReceipt'/);
assert.match(code, /hook\('verifyWiring'/);
assert.match(code, /requireWiringVerified\(\)/);
assert.match(code, /function scanParticipationEvidence\(\)/);
assert.match(code, /AuthorizationRequested/);
assert.match(code, /AuthorizationConsumed/);
assert.match(code, /to - from \+ 1 > 3000/);
assert.match(html, /id="approveAuthorization"[^>]*disabled/);
assert.doesNotMatch(html, /<form[^>]*action=["']https?:/);
console.log('Frontend integrity checks: PASS');
