import { describe, expect, test, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

let tmpHome;

beforeAll(async () => {
  tmpHome = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'protoforge-home-'));
  process.env.HOME = tmpHome;
  // conf also reads XDG vars sometimes; keep it isolated
  process.env.XDG_CONFIG_HOME = path.join(tmpHome, '.config');
  vi.resetModules();
});

afterAll(async () => {
  if (tmpHome) {
    await fs.promises.rm(tmpHome, { recursive: true, force: true });
  }
});

describe('config', () => {
  test('set/get config value roundtrip', async () => {

    const cfg = await import('../lib/core/config.js');
    cfg.setConfigValue('aiProvider', 'mock');
    expect(cfg.getConfigValue('aiProvider')).toBe('mock');

    const ai = cfg.getAIConfig();
    expect(ai.provider).toBe('mock');
  }, 15000);

  test('apiKeyEnv resolves from environment', async () => {
    process.env.TEST_PROTOFORGE_KEY = 'shhh';
    const cfg = await import('../lib/core/config.js');
    cfg.setAIConfig({ provider: 'openai', model: 'gpt-4o-mini', apiKeyEnv: 'TEST_PROTOFORGE_KEY' });
    const ai = cfg.getAIConfig();
    expect(ai.provider).toBe('openai');
    expect(ai.apiKey).toBe('shhh');
  });

  test('resetConfig clears values', async () => {
    const cfg = await import('../lib/core/config.js');
    cfg.setConfigValue('aiProvider', 'mock');
    cfg.resetConfig();
    expect(cfg.getConfigValue('aiProvider')).toBe('openai');
  });
});
