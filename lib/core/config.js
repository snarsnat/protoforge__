/**
 * ProtoForge Configuration Management
 * Manages application settings stored in ~/.config/protoforge/config.json
 */

import Conf from 'conf';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create configuration store with schema validation
 */
const config = new Conf({
  projectName: 'protoforge',
  projectVersion: '1.0.0',
  configName: 'config.json',
  cwd: path.join(__dirname, '..', '..'),
  schema: {
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
      default: path.join(process.cwd(), 'output')
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
  }
});

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
  const provider = config.get('aiProvider');
  const baseUrl = config.get('baseUrl');
  const model = config.get('model');
  const apiKey = config.get('apiKey');
  const temperature = config.get('temperature');
  const maxTokens = config.get('maxTokens');

  const result = {
    provider,
    model,
    temperature,
    maxTokens
  };

  // Add provider-specific configuration
  if (provider === 'custom') {
    const customProviders = config.get('customProviders') || [];
    const customProvider = customProviders.find(p => p.name === model);
    if (customProvider) {
      result.baseUrl = customProvider.baseUrl;
      result.apiKeyEnv = customProvider.apiKeyEnv;
    } else {
      result.baseUrl = baseUrl;
    }
  } else if (provider !== 'ollama') {
    // Cloud providers need API key
    result.apiKey = apiKey;
  } else {
    // Ollama uses baseUrl
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
    { id: 'openai', name: 'OpenAI (GPT-4)', requiresUrl: false, requiresApiKey: true, defaultModel: 'gpt-4' },
    { id: 'groq', name: 'Groq (Llama models)', requiresUrl: false, requiresApiKey: true, defaultModel: 'llama-3.3-70b-versatile' },
    { id: 'anthropic', name: 'Anthropic (Claude)', requiresUrl: false, requiresApiKey: true, defaultModel: 'claude-sonnet-4-20250514' },
    { id: 'gemini', name: 'Google Gemini', requiresUrl: false, requiresApiKey: true, defaultModel: 'gemini-2.0-flash' },
    { id: 'deepseek', name: 'DeepSeek', requiresUrl: false, requiresApiKey: true, defaultModel: 'deepseek-chat' },
    { id: 'custom', name: 'Custom Provider', requiresUrl: true, requiresApiKey: false, defaultUrl: 'http://localhost:8000/v1', defaultModel: '' }
  ];
}

/**
 * Add a custom provider configuration
 * @param {Object} provider - Custom provider configuration
 */
export function addCustomProvider(provider) {
  const customProviders = config.get('customProviders') || [];
  customProviders.push(provider);
  setConfigValue('customProviders', customProviders);
}

/**
 * Remove a custom provider configuration
 * @param {string} name - Provider name to remove
 */
export function removeCustomProvider(name) {
  const customProviders = config.get('customProviders') || [];
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
 * Export configuration to a file
 * @param {string} filePath - Path to export to
 */
export async function exportConfig(filePath) {
  const fs = await import('fs');
  fs.writeFileSync(filePath, JSON.stringify(config.store, null, 2));
}

/**
 * Import configuration from a file
 * @param {string} filePath - Path to import from
 */
export async function importConfig(filePath) {
  const fs = await import('fs');
  const importedConfig = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  config.store = { ...config.store, ...importedConfig };
}

export default config;
export { config, getConfig, getConfigValue, setConfigValue, getAIConfig, setAIConfig, getAvailableProviders, addCustomProvider, removeCustomProvider, resetConfig, exportConfig, importConfig };
