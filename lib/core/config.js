/**
 * ProtoForge Configuration Management
 * Manages application settings stored in ~/.protoforge/config.json
 */

import Conf from 'conf';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { loadUserEnv } from './env.js';

// Default configuration schema
const schema = {
  aiProvider: {
    type: 'string',
    default: 'openai',
    enum: ['ollama', 'openai', 'groq', 'anthropic', 'gemini', 'deepseek', 'custom', 'mock']
  },
  apiKey: {
    type: 'string',
    default: ''
  },
  apiKeyEnv: {
    type: 'string',
    default: ''
  },
  // Optional: store a secondary cloud provider key for quick switching (e.g., OpenAI/Groq free tier)
  cloudProvider: {
    type: 'string',
    default: 'openai'
  },
  cloudApiKey: {
    type: 'string',
    default: ''
  },
  // Meshy removed: 3D preview is generated as HTML instead.
  meshyApiKey: {
    type: 'string',
    default: ''
  },
  baseUrl: {
    type: 'string',
    default: 'http://localhost:11434'
  },
  model: {
    type: 'string',
    default: 'gpt-4o-mini'
  },
  temperature: {
    type: 'number',
    default: 0.7,
    minimum: 0,
    maximum: 2
  },
  maxTokens: {
    type: 'number',
    default: 4096,
    minimum: 1,
    maximum: 131072
  },
  outputDir: {
    type: 'string',
    default: path.join(process.cwd(), 'protoforge-output')
  },
  theme: {
    type: 'string',
    default: 'dark',
    enum: ['dark', 'light', 'auto']
  },
  autoOpenWeb: {
    type: 'boolean',
    default: false
  },
  webPort: {
    type: 'number',
    default: 3000
  },
  lastProject: {
    type: 'string',
    default: ''
  },
  recentProjects: {
    type: 'array',
    items: { type: 'string' },
    default: []
  },
  customProviders: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        baseUrl: { type: 'string' },
        models: { type: 'array', items: { type: 'string' } },
        apiKeyEnv: { type: 'string' }
      }
    },
    default: []
  }
};

// Create the Conf instance
const config = new Conf({
  projectName: 'protoforge',
  configName: 'config.json',
  cwd: path.join(os.homedir(), '.protoforge'),
  schema
});

/**
 * Ensure the config directory exists
 * @returns {string} Path to config directory
 */
export async function ensureConfigDir() {
  const dir = path.join(os.homedir(), '.protoforge');
  await fs.ensureDir(dir);
  return dir;
}

/**
 * Get the full configuration object
 * @returns {Object} Configuration object
 */
export function getConfig() {
  return config.store;
}

/**
 * Get a specific configuration value
 * @param {string} key - Configuration key
 * @param {*} defaultValue - Default value if key not found
 * @returns {*} Configuration value
 */
export function getConfigValue(key, defaultValue = null) {
  return config.get(key) ?? defaultValue;
}

/**
 * Set a configuration value
 * @param {string} key - Configuration key
 * @param {*} value - Value to set
 */
export function setConfigValue(key, value) {
  config.set(key, value);
}

/**
 * Get AI provider configuration
 * @returns {Object} AI configuration object
 */
export function getAIConfig() {
  // Load ~/.protoforge/.env once so provider keys can be resolved like OpenClaw.
  loadUserEnv();

  const provider = getConfigValue('aiProvider', 'openai');
  const baseUrl = getConfigValue('baseUrl', 'http://localhost:11434');
  const model = getConfigValue('model', 'gpt-4o-mini');
  const apiKey = getConfigValue('apiKey', '');
  const apiKeyEnv = getConfigValue('apiKeyEnv', '');
  const cloudProvider = getConfigValue('cloudProvider', 'none');
  const cloudApiKey = getConfigValue('cloudApiKey', '');
  const meshyApiKey = getConfigValue('meshyApiKey', '');
  const temperature = getConfigValue('temperature', 0.7);
  const maxTokens = getConfigValue('maxTokens', 4096);

  const result = {
    provider,
    model,
    temperature,
    maxTokens,
    apiKeyEnv,
    cloudProvider,
    cloudApiKey: cloudApiKey || '',
    meshyApiKey: meshyApiKey || ''
  };

  if (provider === 'custom') {
    const customProviders = getConfigValue('customProviders', []);
    const custom = customProviders.find(p => p.name === model);
    if (custom) {
      result.baseUrl = custom.baseUrl;
      result.apiKeyEnv = custom.apiKeyEnv;
    } else {
      result.baseUrl = baseUrl;
    }
  } else if (provider !== 'ollama') {
    // Cloud providers. Resolve apiKey in an OpenClaw-like order:
    // 1) provider-specific env var
    // 2) apiKeyEnv (if user set a custom env var name)
    // 3) apiKey stored in config (fallback)
    const providerEnv = getProviderDefaultApiKeyEnv(provider);
    result.apiKey =
      (providerEnv && process.env[providerEnv]) ||
      (apiKeyEnv && process.env[apiKeyEnv]) ||
      apiKey;
  } else {
    result.baseUrl = baseUrl;
  }

  // Helpful: expose which env var would be used for this provider.
  result.providerApiKeyEnv = getProviderDefaultApiKeyEnv(provider);


  return result;
}

/**
 * Set AI provider configuration
 * @param {Object} aiConfig - AI configuration object
 */
export function setAIConfig(aiConfig) {
  if (aiConfig.provider) setConfigValue('aiProvider', aiConfig.provider);
  if (aiConfig.baseUrl) setConfigValue('baseUrl', aiConfig.baseUrl);
  if (aiConfig.model) setConfigValue('model', aiConfig.model);
  if (aiConfig.apiKeyEnv !== undefined) setConfigValue('apiKeyEnv', aiConfig.apiKeyEnv);
  if (aiConfig.apiKey !== undefined) setConfigValue('apiKey', aiConfig.apiKey);
  if (aiConfig.cloudProvider !== undefined) setConfigValue('cloudProvider', aiConfig.cloudProvider);
  if (aiConfig.cloudApiKey !== undefined) setConfigValue('cloudApiKey', aiConfig.cloudApiKey);
  if (aiConfig.meshyApiKey !== undefined) setConfigValue('meshyApiKey', aiConfig.meshyApiKey);
  if (aiConfig.temperature !== undefined) setConfigValue('temperature', aiConfig.temperature);
  if (aiConfig.maxTokens) setConfigValue('maxTokens', aiConfig.maxTokens);
}

/**
 * Provider -> default env var name
 */
export function getProviderDefaultApiKeyEnv(provider) {
  const p = String(provider || '').toLowerCase();
  const map = {
    openai: 'OPENAI_API_KEY',
    groq: 'GROQ_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    gemini: 'GEMINI_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY'
  };
  return map[p] || '';
}

/**
 * Get list of available providers
 * @returns {Array} List of provider names
 */
export function getAvailableProviders() {
  return [
    { id: 'openai', name: 'OpenAI', requiresUrl: false, requiresApiKey: true, defaultModel: 'gpt-4o-mini', defaultApiKeyEnv: 'OPENAI_API_KEY' },
    { id: 'groq', name: 'Groq', requiresUrl: false, requiresApiKey: true, defaultModel: 'llama-3.1-70b-versatile', defaultApiKeyEnv: 'GROQ_API_KEY' },
    { id: 'anthropic', name: 'Anthropic', requiresUrl: false, requiresApiKey: true, defaultModel: 'claude-3-5-sonnet-20241022', defaultApiKeyEnv: 'ANTHROPIC_API_KEY' },
    { id: 'gemini', name: 'Google Gemini', requiresUrl: false, requiresApiKey: true, defaultModel: 'gemini-1.5-flash', defaultApiKeyEnv: 'GEMINI_API_KEY' },
    { id: 'deepseek', name: 'DeepSeek', requiresUrl: false, requiresApiKey: true, defaultModel: 'deepseek-chat', defaultApiKeyEnv: 'DEEPSEEK_API_KEY' },

    // Advanced/optional providers (not shown in the default setup wizard)
    { id: 'ollama', name: 'Ollama (Advanced)', requiresUrl: true, requiresApiKey: false, defaultUrl: 'http://localhost:11434', defaultModel: 'llama3.1' },
    { id: 'custom', name: 'Custom Provider (Advanced)', requiresUrl: true, requiresApiKey: false },

    { id: 'mock', name: 'Mock (DEV: PROTOFORGE_MOCK_RESPONSE)', requiresUrl: false, requiresApiKey: false, defaultModel: 'mock' }
  ];
}

/**
 * Add a custom provider
 * @param {Object} provider - Provider config object
 */
export function addCustomProvider(provider) {
  const customProviders = getConfigValue('customProviders', []);
  customProviders.push(provider);
  setConfigValue('customProviders', customProviders);
}

/**
 * Remove a custom provider
 * @param {string} name - Provider name to remove
 */
export function removeCustomProvider(name) {
  const customProviders = getConfigValue('customProviders', []);
  const filtered = customProviders.filter(p => p.name !== name);
  setConfigValue('customProviders', filtered);
}

/**
 * Reset all configuration to defaults
 */
export function resetConfig() {
  config.clear();
}

/**
 * Export config to file
 * @param {string} filePath - Path to save to
 */
export async function exportConfig(filePath) {
  await fs.writeJson(filePath, config.store, { spaces: 2 });
}

/**
 * Import config from file
 * @param {string} filePath - Path to load from
 */
export async function importConfig(filePath) {
  const imported = await fs.readJson(filePath);
  Object.entries(imported).forEach(([key, value]) => {
    config.set(key, value);
  });
}

// Export the config instance itself as default
export default config;