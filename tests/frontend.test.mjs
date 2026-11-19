import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const code = fs.readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const config = fs.readFileSync(new URL('../web/config.js', import.meta.url), 'utf8');

for (const id of ['connectButton','createWorkspace','allowTarget','denyTarget','requestAuthorization',
  'inspectAuthorization','approveAuthorization','cancelAuthorization','executeTask','checkUsage',
  'updatePolicy','rotateAgent','deploymentStatus','agentIdentity']) {
  assert.match(html, new RegExp(`id="${id}"`), `missing UI control ${id}`);
  if (!['deploymentStatus','agentIdentity'].includes(id)) assert.match(code, new RegExp(`'${id}'`));
}
assert.match(config, /0x60b9262456de011f7d15a54cdd8c48baaa8b022f/i);
assert.match(config, /guardAddress:\s*''/);
assert.match(config, /taskRegistryAddress:\s*''/);
assert.match(code, /eth_requestAccounts/);
assert.match(code, /wallet_switchEthereumChain/);
assert.match(code, /keccak256/);
assert.match(code, /approveAuthorization/);
assert.match(code, /recordTask/);
assert.doesNotMatch(html, /<form[^>]*action=["']https?:/);
console.log('Frontend integrity checks: PASS');
