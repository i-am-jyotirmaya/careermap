import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { CareerForgeDB } from '../db/database.ts';
import { AIDriver } from '../services/aiDriver.ts';
import { JevModelRouter } from '../services/jevRouter.ts';

test('a saved subscription uses the ChatGPT CLI for verification and inference', async (t) => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'career-forge-codex-'));
  const mockCli = path.join(directory, 'mock-codex.cjs');
  writeFileSync(mockCli, String.raw`
const [command, ...args] = process.argv.slice(2);
if (command === 'login' && args[0] === 'status') {
  console.log(process.env.MOCK_CODEX_LOGIN);
} else if (command === 'exec' && !args.includes('--model') && args.at(-1) === '-') {
  process.stdin.setEncoding('utf8');
  let prompt = '';
  process.stdin.on('data', (chunk) => { prompt += chunk; });
  process.stdin.on('end', () => {
    if (prompt.includes('Career roadmap JSON')) {
      if (!args.includes('shell_tool') || !prompt.includes('from the supplied text alone')) {
        process.exitCode = 1;
        return;
      }
      console.log(JSON.stringify({ roadmaps: [{ title: 'Platform Engineering' }] }));
      return;
    }
    console.log(prompt.includes('exact word READY') ? 'READY' : 'Subscription reply');
  });
} else {
  process.exitCode = 1;
}
`);
  if (process.platform === 'win32') {
    writeFileSync(path.join(directory, 'codex.cmd'), `@"${process.execPath}" "%~dp0mock-codex.cjs" %*\r\n`);
  } else {
    writeFileSync(path.join(directory, 'codex'), '#!/bin/sh\nexec node "$(dirname "$0")/mock-codex.cjs" "$@"\n', { mode: 0o700 });
  }

  const previousPath = process.env.PATH;
  const previousLogin = process.env.MOCK_CODEX_LOGIN;
  process.env.PATH = [directory, path.dirname(process.execPath), previousPath].join(path.delimiter);
  process.env.MOCK_CODEX_LOGIN = 'Logged in using ChatGPT';
  const db = new CareerForgeDB(':memory:');
  t.after(() => {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    if (previousLogin === undefined) delete process.env.MOCK_CODEX_LOGIN;
    else process.env.MOCK_CODEX_LOGIN = previousLogin;
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Unexpected HTTP request from CareerForge');
  });

  const saved = db.saveProvider({
    name: 'ChatGPT Codex Subscription',
    type: 'codex_subscription',
    enabled: true,
    baseUrl: 'https://api.openai.com/v1',
    codexAuthMode: 'paste_token_or_json',
    apiKeyOrSecret: 'old-test-token',
    models: [{
      id: 'gpt-5.3-codex',
      label: 'GPT-5.3 Codex',
      costTier: 'free_local',
      capabilityTier: 'coding_specialist',
      supportsReasoningEffort: true,
      enabled: true,
    }],
  });
  const driver = new AIDriver(db, new JevModelRouter(db));

  const verification = await driver.testProvider(saved.id);
  assert.equal(verification.ok, true, verification.message);
  assert.match(verification.message, /READY/);
  assert.equal(verification.modelTested, 'codex-default');
  const result = await driver.execute({
    purpose: 'provider_test',
    systemPrompt: 'Reply briefly.',
    userPrompt: 'Check subscription inference.',
  });
  assert.equal(result.text, 'Subscription reply');

  const timers = t.mock.method(globalThis, 'setTimeout');
  const roadmap = await driver.executeJson<{ roadmaps: Array<{ title: string }> }>({
    purpose: 'roadmap_suggestion',
    systemPrompt: 'Generate Career roadmap JSON.',
    userPrompt: 'The candidate is a software engineer.',
  });
  assert.equal(roadmap.data.roadmaps[0]?.title, 'Platform Engineering');
  assert.ok(timers.mock.calls.some(({ arguments: [, delay] }) => delay === 240_000));
  assert.equal(fetch.mock.callCount(), 0);

  process.env.MOCK_CODEX_LOGIN = 'Logged in using an API key';
  const apiKeyVerification = await driver.testProvider(saved.id);
  assert.equal(apiKeyVerification.ok, false);
  assert.match(apiKeyVerification.message, /Sign in with ChatGPT/);
});
