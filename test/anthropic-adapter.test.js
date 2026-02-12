import { describe, expect, test } from 'vitest';

import adapterMod from '../lib/ai/adapter.js';

describe('AnthropicAdapter', () => {
  test('builds Messages API payload with system + messages', () => {
    const config = {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 1234,
      temperature: 0.2,
      apiKey: 'sk-ant-test'
    };

    const a = adapterMod.createAdapter(config);
    expect(typeof a.toAnthropicPayload).toBe('function');

    const payload = a.toAnthropicPayload([
      { role: 'system', content: 'SYSTEM ONE' },
      { role: 'system', content: 'SYSTEM TWO' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
      { role: 'user', content: 'Do X' }
    ]);

    expect(payload.model).toBe(config.model);
    expect(payload.max_tokens).toBe(config.maxTokens);
    expect(payload.temperature).toBe(config.temperature);
    expect(payload.system).toContain('SYSTEM ONE');
    expect(payload.system).toContain('SYSTEM TWO');
    expect(payload.messages.length).toBe(3);

    expect(payload.messages[0]).toEqual({
      role: 'user',
      content: [{ type: 'text', text: 'Hello' }]
    });
    expect(payload.messages[1]).toEqual({
      role: 'assistant',
      content: [{ type: 'text', text: 'Hi' }]
    });
  });
});
