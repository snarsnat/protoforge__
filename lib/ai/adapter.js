/**
 * ProtoForge AI Adapter
 * Unified interface for multiple AI providers (Ollama, OpenAI, Groq, Anthropic, etc.)
 */

import axios from 'axios';
import { getAIConfig, getProviderDefaultApiKeyEnv } from '../core/config.js';

/**
 * Base AI Provider Adapter
 */
class BaseAdapter {
  constructor(config) {
    this.config = config;
  }

  async generate(messages) {
    throw new Error('Not implemented');
  }

  async *stream(messages) {
    throw new Error('Streaming not implemented');
  }

  getHeaders() {
    return {};
  }

  getBaseUrl() {
    return '';
  }

  formatMessages(messages) {
    return messages;
  }
}

/**
 * Ollama Adapter (Local)
 */
class OllamaAdapter extends BaseAdapter {
  getBaseUrl() {
    return (this.config.baseUrl || 'http://localhost:11434').replace(/\/$/, '');
  }

  getHeaders() {
    return { 'Content-Type': 'application/json' };
  }

  formatMessages(messages) {
    return messages.map((m) => ({ role: m.role, content: m.content }));
  }

  async generate(messages) {
    // Ollama chat API supports role-based messages.
    const url = `${this.getBaseUrl()}/api/chat`;
    const data = {
      model: this.config.model,
      messages: this.formatMessages(messages),
      stream: false,
      options: {
        temperature: this.config.temperature,
        num_predict: this.config.maxTokens
      }
    };

    const response = await axios.post(url, data, {
      headers: this.getHeaders(),
      timeout: 300000
    });

    return response.data?.message?.content ?? response.data?.response ?? '';
  }

  async *stream(messages) {
    const url = `${this.getBaseUrl()}/api/chat`;
    const data = {
      model: this.config.model,
      messages: this.formatMessages(messages),
      stream: true,
      options: {
        temperature: this.config.temperature,
        num_predict: this.config.maxTokens
      }
    };

    const response = await axios.post(url, data, {
      headers: this.getHeaders(),
      timeout: 300000,
      responseType: 'stream'
    });

    const s = response.data;
    let buffer = '';

    for await (const chunk of s) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          const token = data?.message?.content ?? data?.response;
          if (token) yield token;
          if (data?.done) return;
        } catch {
          // ignore
        }
      }
    }
  }
}

/**
 * OpenAI-compatible Adapter (OpenAI, Groq, DeepSeek, Custom)
 */
class OpenAICompatibleAdapter extends BaseAdapter {
  getBaseUrl() {
    if (this.config.baseUrl) {
      return this.config.baseUrl.replace(/\/$/, '');
    }
    const urls = {
      openai: 'https://api.openai.com/v1',
      groq: 'https://api.groq.com/openai/v1',
      deepseek: 'https://api.deepseek.com/v1'
    };
    return urls[this.config.provider] || 'https://api.openai.com/v1';
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  formatMessages(messages) {
    return messages;
  }

  async generate(messages) {
    if (!this.config.apiKey && ['openai', 'groq', 'deepseek', 'custom'].includes(this.config.provider)) {
      const env = getProviderDefaultApiKeyEnv(this.config.provider) || 'API_KEY';
      throw new Error(`Missing API key for ${this.config.provider}. Set ${env} or run: protoforge setup`);
    }
    const url = `${this.getBaseUrl()}/chat/completions`;
    const data = {
      model: this.config.model,
      messages: this.formatMessages(messages),
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens
    };

    const response = await axios.post(url, data, {
      headers: this.getHeaders(),
      timeout: 300000
    });

    return response.data.choices[0].message.content;
  }

  async *stream(messages) {
    const url = `${this.getBaseUrl()}/chat/completions`;
    const data = {
      model: this.config.model,
      messages: this.formatMessages(messages),
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: true
    };

    const response = await axios.post(url, data, {
      headers: this.getHeaders(),
      timeout: 300000,
      responseType: 'stream'
    });

    const stream = response.data;

    for await (const chunk of stream) {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
  }
}

/**
 * Anthropic Adapter (Claude)
 *
 * Uses the Anthropic Messages API (NOT OpenAI-compatible).
 * Docs: https://docs.anthropic.com/en/api/messages
 */
class AnthropicAdapter extends BaseAdapter {
  getBaseUrl() {
    return 'https://api.anthropic.com/v1';
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    };
    if (this.config.apiKey) headers['x-api-key'] = this.config.apiKey;
    return headers;
  }

  toAnthropicPayload(messages) {
    // Anthropic supports a separate system string.
    const systemParts = messages.filter((m) => m.role === 'system').map((m) => String(m.content || '')).filter(Boolean);
    const system = systemParts.length ? systemParts.join('\n\n') : undefined;

    const msg = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: [{ type: 'text', text: String(m.content ?? '') }]
      }));

    return {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      ...(system ? { system } : {}),
      messages: msg
    };
  }

  async generate(messages) {
    if (!this.config.apiKey) {
      const env = getProviderDefaultApiKeyEnv('anthropic') || 'ANTHROPIC_API_KEY';
      throw new Error(`Missing API key for anthropic. Set ${env} or run: protoforge setup`);
    }

    const url = `${this.getBaseUrl()}/messages`;
    const data = this.toAnthropicPayload(messages);

    const response = await axios.post(url, data, {
      headers: this.getHeaders(),
      timeout: 300000
    });

    // response.data.content is an array of blocks
    const blocks = response.data?.content || [];
    const text = blocks.map((b) => (b?.type === 'text' ? b.text : '')).join('');
    return text || '';
  }

  async *stream() {
    throw new Error('Streaming not implemented for Anthropic yet');
  }
}

/**
 * Google Gemini Adapter
 */
class GeminiAdapter extends BaseAdapter {
  getBaseUrl() {
    return `https://generativelanguage.googleapis.com/v1beta`;
  }

  normalizeModel(model) {
    let m = String(model || '').trim();
    // Accept users pasting "models/gemini-...".
    m = m.replace(/^models\//i, '');
    // Avoid spaces / friendly names like "Gemini 3".
    m = m.toLowerCase().replace(/\s+/g, '-');
    return m;
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) {
      headers['x-goog-api-key'] = this.config.apiKey;
    }
    return headers;
  }

  formatMessages(messages) {
    // Gemini uses a different format
    const contents = [];
    let currentContent = '';

    for (const message of messages) {
      if (message.role === 'system') continue; // Handle system separately
      currentContent += `${message.role.toUpperCase()}: ${message.content}\n`;
    }

    return { contents: [{ parts: [{ text: currentContent }] }] };
  }

  async generate(messages) {
    const model = this.normalizeModel(this.config.model);
    const url = `${this.getBaseUrl()}/models/${model}:generateContent`;
    const data = this.formatMessages(messages);

    const response = await axios.post(url, data, {
      headers: this.getHeaders(),
      timeout: 300000
    });

    return response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
}

/**
 * Factory to create appropriate adapter
 * @param {Object} config - AI configuration
 * @returns {BaseAdapter} Appropriate adapter instance
 */
function createAdapter(config) {
  const provider = config.provider;

  switch (provider) {
    case 'ollama':
      return new OllamaAdapter(config);
    case 'anthropic':
      return new AnthropicAdapter(config);
    case 'gemini':
      return new GeminiAdapter(config);
    case 'mock':
      return {
        async generate() {
          return process.env.PROTOFORGE_MOCK_RESPONSE || '{"overview":{"projectName":"Mock","description":"Set PROTOFORGE_MOCK_RESPONSE"}}';
        },
        async *stream() {
          yield await this.generate();
        }
      };
    case 'openai':
    case 'groq':
    case 'deepseek':
    case 'custom':
      return new OpenAICompatibleAdapter(config);
    default:
      return new OpenAICompatibleAdapter(config);
  }
}

/**
 * Generate response from AI
 * @param {Array} messages - Conversation messages
 * @param {Object} aiConfig - AI configuration
 * @returns {Promise<string>} AI response
 */
function formatProviderError(err, config) {
  // axios-like error
  const status = err?.response?.status;
  const statusText = err?.response?.statusText;
  const data = err?.response?.data;
  const code = err?.code;

  let detail = '';
  if (status) detail += `HTTP ${status}${statusText ? ` ${statusText}` : ''}`;
  if (!detail && code) detail += code;

  const provider = config?.provider || 'unknown';
  const model = config?.model || 'unknown';

  let hint = '';
  if (provider === 'ollama') {
    hint = 'Hint: is Ollama running? Try: `ollama serve` (or open the Ollama app) and verify the URL in `protoforge config`.';
  } else if (provider === 'openai' || provider === 'groq' || provider === 'anthropic' || provider === 'gemini' || provider === 'deepseek') {
    hint = 'Hint: check your API key (`protoforge setup` / `protoforge config`) and that the selected model exists for your provider.';
  }

  // Try to extract a readable message from response data.
  let remoteMsg = '';
  if (data) {
    if (typeof data === 'string') remoteMsg = data.slice(0, 500);
    else remoteMsg = JSON.stringify(data).slice(0, 500);
  }

  const pieces = [
    `Provider call failed (${provider}/${model}).`,
    detail ? `Details: ${detail}` : null,
    err?.message ? `Message: ${err.message}` : null,
    remoteMsg ? `Remote: ${remoteMsg}` : null,
    hint || null
  ].filter(Boolean);

  const e = new Error(pieces.join('\n'));
  e.name = 'ProtoForgeProviderError';
  e.cause = err;
  return e;
}

export async function generateResponse(messages, aiConfig = null) {
  const config = aiConfig || getAIConfig();
  const adapter = createAdapter(config);
  try {
    return await adapter.generate(messages);
  } catch (err) {
    throw formatProviderError(err, config);
  }
}

/**
 * Stream response from AI
 * @param {Array} messages - Conversation messages
 * @param {Object} aiConfig - AI configuration
 * @param {Object} callbacks - Callbacks for streaming
 * @returns {Promise<string>} Full response
 */
export async function streamResponse(messages, aiConfig = null, callbacks = {}) {
  const { onToken = () => {}, onProgress = () => {} } = callbacks;
  const config = aiConfig || getAIConfig();
  const adapter = createAdapter(config);

  let fullResponse = '';

  try {
    for await (const token of adapter.stream(messages)) {
      fullResponse += token;
      onToken(token);
      onProgress({ tokenCount: fullResponse.length });
    }
  } catch (err) {
    throw formatProviderError(err, config);
  }

  return fullResponse;
}

/**
 * Test connection to AI provider
 * @param {Object} aiConfig - AI configuration
 * @returns {Promise<Object>} Test result
 */
export async function testConnection(aiConfig = null) {
  const config = aiConfig || getAIConfig();
  const adapter = createAdapter(config);
  
  const testMessage = [
    { role: 'user', content: 'Respond with exactly: "Connection successful"' }
  ];

  try {
    const response = await adapter.generate(testMessage);
    const success = response.includes('Connection successful');
    
    return {
      success,
      message: success ? 'Connection successful' : 'Connection failed - unexpected response',
      provider: config.provider,
      model: config.model
    };
  } catch (error) {
    const e = formatProviderError(error, config);
    return {
      success: false,
      message: e.message,
      provider: config.provider,
      model: config.model
    };
  }
}

/**
 * Get available models for a provider
 * @param {string} provider - Provider name
 * @param {Object} config - AI configuration
 * @returns {Promise<Array>} List of available models
 */
export async function getAvailableModels(provider, config) {
  // Default model lists for each provider
  const defaultModels = {
    ollama: ['llama3.2', 'llama3.1', 'llama2', 'codellama', 'mistral', 'mixtral', 'qwen2', 'phi3'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    anthropic: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-3-20250514'],
    gemini: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    deepseek: ['deepseek-chat']
  };

  // For Ollama, try to fetch actual models
  if (provider === 'ollama') {
    try {
      const baseUrl = config.baseUrl || 'http://localhost:11434';
      const response = await axios.get(`${baseUrl}/api/tags`, { timeout: 5000 });
      return response.data.models?.map(m => m.name.split(':')[0]) || defaultModels.ollama;
    } catch {
      return defaultModels.ollama;
    }
  }

  return defaultModels[provider] || [];
}

export default {
  generateResponse,
  streamResponse,
  testConnection,
  getAvailableModels,
  createAdapter
};
