/**
 * ProtoForge AI Adapter
 * Unified interface for multiple AI providers (Ollama, OpenAI, Groq, Anthropic, etc.)
 */

import axios from 'axios';
import { getAIConfig } from '../core/config.js';

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
    return this.config.baseUrl || 'http://localhost:11434';
  }

  getHeaders() {
    return { 'Content-Type': 'application/json' };
  }

  formatMessages(messages) {
    // Ollama uses a simpler message format
    return messages.map(m => ({
      role: m.role,
      content: m.content
    }));
  }

  async generate(messages) {
    const url = `${this.getBaseUrl()}/api/generate`;
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
      timeout: 300000 // 5 minutes
    });

    return response.data.response;
  }

  async *stream(messages) {
    const url = `${this.getBaseUrl()}/api/generate`;
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

    const stream = response.data;

    return await new Promise((resolve, reject) => {
      let buffer = '';

      stream.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.response) {
              resolve(data.response);
            }
            if (data.done) {
              return;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      });

      stream.on('error', reject);
      stream.on('end', () => {
        resolve(buffer);
      });
    });
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
 */
class AnthropicAdapter extends OpenAICompatibleAdapter {
  getHeaders() {
    const headers = { 'Content-Type': 'application/json', 'x-api-key': this.config.apiKey };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  formatMessages(messages) {
    // Anthropic uses a different format
    return messages.map(m => ({
      role: m.role === 'system' ? 'user' : m.role, // System messages become part of first user message
      content: m.content
    }));
  }

  async generate(messages) {
    const url = 'https://api.anthropic.com/v1/messages';
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

    return response.data.content[0].text;
  }
}

/**
 * Google Gemini Adapter
 */
class GeminiAdapter extends BaseAdapter {
  getBaseUrl() {
    return `https://generativelanguage.googleapis.com/v1beta`;
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
    const url = `${this.getBaseUrl()}/models/${this.config.model}:generateContent`;
    const data = this.formatMessages(messages);

    const response = await axios.post(url, data, {
      headers: this.getHeaders(),
      timeout: 300000
    });

    return response.data.candidates[0].content.parts[0].text;
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
export async function generateResponse(messages, aiConfig = null) {
  const config = aiConfig || getAIConfig();
  const adapter = createAdapter(config);
  return await adapter.generate(messages);
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
  
  for await (const token of adapter.stream(messages)) {
    fullResponse += token;
    onToken(token);
    onProgress({ tokenCount: fullResponse.length });
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
    return {
      success: false,
      message: error.message,
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
export { generateResponse, streamResponse, testConnection, getAvailableModels, createAdapter };
