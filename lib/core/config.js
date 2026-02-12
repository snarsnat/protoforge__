/**
 * ProtoForge Configuration System
 * Inspired by OpenClaw's config architecture
 */

import Conf from 'conf';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import inquirer from 'inquirer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Schema with validation (OpenClaw-style)
const schema = {
  // Core settings
  outputDir: { type: 'string', default: path.join(os.homedir(), 'protoforge-output') },
  webPort: { type: 'number', default: 3000 },
  autoOpenWeb: { type: 'boolean', default: false },
  
  // AI configuration (OpenClaw model-style)
  model: {
    type: 'object',
    properties: {
      primary: { type: 'string', default: 'openai/gpt-4o-mini' },
      fallback: { type: 'array', items: { type: 'string' }, default: ['anthropic/claude-sonnet-4-5'] },
      image: { type: 'string', default: 'openai/gpt-4o-mini' },
      temperature: { type: 'number', default: 0.7 },
      maxTokens: { type: 'number', default: 8192 },
    },
    default: {}
  },
  
  // Providers with auth profiles
  providers: {
    type: 'object',
    default: {
      openai: { enabled: true, apiKeyEnv: 'OPENAI_API_KEY', baseUrl: 'https://api.openai.com/v1' },
      anthropic: { enabled: true, apiKeyEnv: 'ANTHROPIC_API_KEY', baseUrl: 'https://api.anthropic.com' },
      groq: { enabled: true, apiKeyEnv: 'GROQ_API_KEY', baseUrl: 'https://api.groq.com/openai/v1' },
      gemini: { enabled: true, apiKeyEnv: 'GEMINI_API_KEY', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
      ollama: { enabled: true, baseUrl: 'http://localhost:11434' },
    }
  },
  
  // Auth profiles (OpenClaw-style)
  auth: {
    type: 'object',
    default: {
      profiles: {},
      order: [],
    }
  },
  
  // Recent projects
  recentProjects: { type: 'array', items: { type: 'string' }, default: [] },
  lastProject: { type: 'string', default: '' },
  
  // Gateway settings
  gateway: {
    type: 'object',
    properties: {
      port: { type: 'number', default: 18789 },
      bind: { type: 'string', default: '127.0.0.1' },
    },
    default: {}
  },
};

// Create Conf instance
const config = new Conf({
  projectName: 'protoforge',
  configName: 'config.json',
  cwd: path.join(os.homedir(), '.protoforge'),
  schema,
  fileMode: 0o600,
});

/**
 * Get full config object
 */
export function getConfig() {
  return config.store;
}

/**
 * Get specific config value with env var substitution
 */
export function getConfigValue(key, defaultValue = null) {
  let value = config.get(key);
  
  // Env var substitution: ${VAR_NAME}
  if (typeof value === 'string') {
    value = value.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, varName) => {
      return process.env[varName] || '';
    });
  }
  
  return value !== undefined ? value : defaultValue;
}

/**
 * Set config value
 */
export function setConfigValue(key, value) {
  config.set(key, value);
}

/**
 * Unset config value
 */
export function unsetConfigValue(key) {
  config.delete(key);
}

/**
 * Reset all config to defaults
 */
export function resetConfig() {
  config.clear();
}

/**
 * Export config to JSON
 */
export async function exportConfig(filePath = null) {
  const exportPath = filePath || path.join(os.homedir(), 'protoforge-config.json');
  await fs.writeJson(exportPath, config.store, { spaces: 2 });
  return exportPath;
}

/**
 * Import config from JSON
 */
export async function importConfig(filePath) {
  const imported = await fs.readJson(filePath);
  Object.entries(imported).forEach(([key, value]) => {
    config.set(key, value);
  });
}

/**
 * Get AI configuration (resolved)
 */
export function getModelConfig() {
  const model = getConfigValue('model', {});
  return {
    primary: model.primary || 'openai/gpt-4o-mini',
    fallback: model.fallback || [],
    image: model.image || 'openai/gpt-4o-mini',
    temperature: model.temperature ?? 0.7,
    maxTokens: model.maxTokens ?? 8192,
  };
}

/**
 * Set AI configuration
 */
export function setModelConfig(modelConfig) {
  const current = getConfigValue('model', {});
  if (modelConfig.primary) current.primary = modelConfig.primary;
  if (modelConfig.fallback) current.fallback = modelConfig.fallback;
  if (modelConfig.image) current.image = modelConfig.image;
  if (modelConfig.temperature !== undefined) current.temperature = modelConfig.temperature;
  if (modelConfig.maxTokens) current.maxTokens = modelConfig.maxTokens;
  setConfigValue('model', current);
}

/**
 * Get provider auth (OpenClaw-style)
 */
export function getProviderAuth(provider) {
  const auth = getConfigValue('auth', {});
  const profiles = auth.profiles || {};
  const order = auth.order || [];
  
  // Try order first, then default profile
  const profileId = order.find(id => profiles[id]) || 'default';
  const profile = profiles[profileId] || {};
  
  const providers = getConfigValue('providers', {});
  const providerConfig = providers[provider] || {};
  const apiKeyEnv = providerConfig.apiKeyEnv || '';
  
  return {
    apiKey: (apiKeyEnv && process.env[apiKeyEnv]) || profile[`${provider}_api_key`] || '',
    apiKeyEnv,
    profile,
    hasAuth: !!(apiKeyEnv && process.env[apiKeyEnv]) || profile[`${provider}_api_key`],
  };
}

/**
 * Set provider auth
 */
export function setProviderAuth(provider, apiKey) {
  const auth = getConfigValue('auth', {});
  const profiles = auth.profiles || {};
  const order = auth.order || [];
  
  if (!profiles['default']) {
    profiles['default'] = {};
    if (!order.includes('default')) order.unshift('default');
  }
  
  profiles['default'][`${provider}_api_key`] = apiKey;
  
  if (!order.includes(provider)) order.push(provider);
  
  auth.profiles = profiles;
  auth.order = order;
  setConfigValue('auth', auth);
}

/**
 * Get available providers
 */
export function getAvailableProviders() {
  return [
    { id: 'openai', name: 'OpenAI', requiresKey: true, defaultModel: 'gpt-4o-mini', apiKeyEnv: 'OPENAI_API_KEY' },
    { id: 'anthropic', name: 'Anthropic', requiresKey: true, defaultModel: 'claude-sonnet-4-5', apiKeyEnv: 'ANTHROPIC_API_KEY' },
    { id: 'groq', name: 'Groq', requiresKey: true, defaultModel: 'llama-3.1-70b-versatile', apiKeyEnv: 'GROQ_API_KEY' },
    { id: 'gemini', name: 'Google Gemini', requiresKey: true, defaultModel: 'gemini-1.5-flash', apiKeyEnv: 'GEMINI_API_KEY' },
    { id: 'ollama', name: 'Ollama', requiresKey: false, defaultModel: 'llama3.1', baseUrl: 'http://localhost:11434' },
  ];
}

/**
 * Interactive setup wizard (OpenClaw-style)
 */
export async function runSetupWizard() {
  console.log(chalk.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.white('         ProtoForge Setup Wizard') + chalk.cyan('                     ║'));
  console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝\n'));
  
  const providers = getAvailableProviders();
  
  // Step 1: Select provider
  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Select AI provider:',
      choices: providers.map(p => ({ name: `${p.name} ${p.requiresKey ? '(API key required)' : ''}`, value: p.id })),
      default: 'openai'
    }
  ]);
  
  // Step 2: API key
  const selectedProvider = providers.find(p => p.id === provider);
  let apiKey = '';
  
  if (selectedProvider.requiresKey) {
    const { key } = await inquirer.prompt([
      {
        type: 'password',
        name: 'key',
        message: `Enter ${selectedProvider.name} API key (or press Enter to use ${selectedProvider.apiKeyEnv}):`,
        mask: '*'
      }
    ]);
    apiKey = key;
    
    if (apiKey) {
      setProviderAuth(provider, apiKey);
      console.log(chalk.green('✓ API key saved securely'));
    } else {
      console.log(chalk.dim(`  Using ${selectedProvider.apiKeyEnv} from environment`));
    }
  }
  
  // Step 3: Select model
  const modelMap = {
    openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
    anthropic: ['claude-sonnet-4-5', 'claude-opus-4-6', 'claude-haiku-3-5'],
    groq: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant'],
    gemini: ['gemini-1.5-flash', 'gemini-1.5-pro'],
    ollama: ['llama3.1', 'llama3', 'mistral', 'codellama']
  };
  
  const models = modelMap[provider] || [selectedProvider.defaultModel];
  const { model } = await inquirer.prompt([
    {
      type: 'list',
      name: 'model',
      message: 'Select model:',
      choices: models,
      default: models[0]
    }
  ]);
  
  // Step 4: Output directory
  const { outputDir } = await inquirer.prompt([
    {
      type: 'input',
      name: 'outputDir',
      message: 'Output directory:',
      default: path.join(os.homedir(), 'protoforge-output'),
      filter: input => path.resolve(input)
    }
  ]);
  
  // Apply settings
  setModelConfig({ primary: `${provider}/${model}` });
  setConfigValue('outputDir', outputDir);
  
  console.log(chalk.green('\n✓ Setup complete!'));
  console.log(chalk.dim('  Run: protoforge web\n'));
  
  return { provider, model, outputDir };
}

/**
 * Display config status (OpenClaw models status-style)
 */
export function printConfigStatus() {
  const config = getConfig();
  const model = getModelConfig();
  const auth = getProviderAuth(model.primary.split('/')[0]);
  
  console.log(chalk.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.white('              ProtoForge Configuration') + chalk.cyan('              ║'));
  console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝\n'));
  
  console.log(chalk.white('Model Settings:'));
  console.log(chalk.dim('  Primary:   ') + model.primary);
  console.log(chalk.dim('  Fallback: ') + (model.fallback.length ? model.fallback.join(', ') : '(none)'));
  console.log(chalk.dim('  Image:    ') + model.image);
  console.log(chalk.dim('  Temp:     ') + model.temperature);
  
  console.log(chalk.white('\nAuth Status:'));
  const provider = model.primary.split('/')[0];
  console.log(chalk.dim('  Provider: ') + provider);
  console.log(chalk.dim('  API Key:  ') + (auth.hasAuth ? chalk.green('[CONFIGURED]') : chalk.yellow('[NOT SET]')));
  if (auth.apiKeyEnv) {
    console.log(chalk.dim('  Env Var:  ') + auth.apiKeyEnv);
  }
  
  console.log(chalk.white('\nPaths:'));
  console.log(chalk.dim('  Output:   ') + config.outputDir);
  console.log(chalk.dim('  Web:      ') + `http://localhost:${config.webPort}`);
  console.log(chalk.dim('  Config:   ') + path.join(os.homedir(), '.protoforge', 'config.json'));
  console.log('');
}

/**
 * Ensure config directory exists
 */
export async function ensureConfigDir() {
  const dir = path.dirname(config.path);
  await fs.ensureDir(dir);
  return dir;
}

export default config;
