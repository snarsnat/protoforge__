/**
 * ProtoForge Configuration Management
 * Manages application settings stored in ~/.protoforge/config.json
 */

import Conf from 'conf';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';

// Default configuration schema
const schema = {
  aiProvider: {
    type: 'string',
    default: 'ollama',
    enum: ['ollama', 'openai', 'groq', 'anthropic', 'gemini', 'deepseek', 'custom']
  },
  apiKey: {
    type: 'string',
    default: ''
  },
  baseUrl: {
    type: 'string',
    default: 'http://localhost:11434'
  },
  model: {
    type: 'string',
    default: 'llama3.2'
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
  const provider = getConfigValue('aiProvider', 'ollama');
  const baseUrl = getConfigValue('baseUrl', 'http://localhost:11434');
  const model = getConfigValue('model', 'llama3.2');
  const apiKey = getConfigValue('apiKey', '');
  const temperature = getConfigValue('temperature', 0.7);
  const maxTokens = getConfigValue('maxTokens', 4096);

  const result = {
    provider,
    model,
    temperature,
    maxTokens
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
    result.apiKey = apiKey;
  } else {
    result.baseUrl = baseUrl;
  }

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
  if (aiConfig.apiKey) setConfigValue('apiKey', aiConfig.apiKey);
  if (aiConfig.temperature !== undefined) setConfigValue('temperature', aiConfig.temperature);
  if (aiConfig.maxTokens) setConfigValue('maxTokens', aiConfig.maxTokens);
}

/**
 * Get list of available providers
 * @returns {Array} List of provider names
 */
export function getAvailableProviders() {
  return [
    { id: 'ollama', name: 'Ollama (Local)', requiresUrl: true, requiresApiKey: false, defaultUrl: 'http://localhost:11434', defaultModel: 'llama3.2' },
    { id: 'openai', name: 'OpenAI', requiresUrl: false, requiresApiKey: true, defaultModel: 'gpt-4o-mini' },
    { id: 'groq', name: 'Groq', requiresUrl: false, requiresApiKey: true, defaultModel: 'llama3-70b-8192' },
    { id: 'anthropic', name: 'Anthropic', requiresUrl: false, requiresApiKey: true, defaultModel: 'claude-3-5-sonnet-20241022' },
    { id: 'gemini', name: 'Google Gemini', requiresUrl: false, requiresApiKey: true, defaultModel: 'gemini-1.5-flash' },
    { id: 'deepseek', name: 'DeepSeek', requiresUrl: false, requiresApiKey: true, defaultModel: 'deepseek-chat' },
    { id: 'custom', name: 'Custom Provider', requiresUrl: true, requiresApiKey: false }
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