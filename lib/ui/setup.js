/**
 * Setup Wizard Module
 * Interactive setup wizard for configuring AI providers and integrations
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { ensureConfigDir, getAIConfig, getAvailableProviders, setAIConfig, getConfigValue, setConfigValue } from '../core/config.js';

/**
 * Run the setup wizard
 */
export async function setupWizard() {
  await ensureConfigDir();

  console.log(chalk.cyan('\n╔═══════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.white('         ProtoForge Setup Wizard') + chalk.cyan('                       ║'));
  console.log(chalk.cyan('╚═══════════════════════════════════════════════════════════╝\n'));

  try {
    const providers = getAvailableProviders();
    const current = getAIConfig();

    const step1 = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'AI provider (required):',
        choices: providers.map((p) => ({ name: p.name, value: p.id })),
        default: current.provider || 'ollama'
      },
      {
        type: 'input',
        name: 'baseUrl',
        message: 'Base URL (only for Ollama/Custom):',
        default: () => current.baseUrl || providers.find((p) => p.id === 'ollama')?.defaultUrl || 'http://localhost:11434',
        when: (a) => ['ollama', 'custom'].includes(a.provider)
      },
      {
        type: 'input',
        name: 'model',
        message: 'Model name:',
        default: (a) => providers.find((p) => p.id === a.provider)?.defaultModel || current.model || 'llama3.2'
      },
      {
        type: 'password',
        name: 'apiKey',
        message: 'API key (stored in local config):',
        when: (a) => !['ollama', 'custom'].includes(a.provider),
        validate: (v) => (v && v.length ? true : 'API key is required for this provider')
      },
      {
        type: 'input',
        name: 'temperature',
        message: 'Temperature (0.0 - 2.0):',
        default: String(current.temperature ?? 0.7),
        filter: (v) => Number(v)
      },
      {
        type: 'input',
        name: 'maxTokens',
        message: 'Max tokens:',
        default: String(current.maxTokens ?? 4096),
        filter: (v) => Number(v)
      }
    ]);

    setAIConfig({
      provider: step1.provider,
      baseUrl: step1.baseUrl,
      model: step1.model,
      apiKey: step1.apiKey,
      temperature: step1.temperature,
      maxTokens: step1.maxTokens
    });

    const step2 = await inquirer.prompt([
      {
        type: 'input',
        name: 'outputDir',
        message: 'Output directory for generated projects:',
        default: getConfigValue('outputDir', './protoforge-output')
      },
      {
        type: 'confirm',
        name: 'autoOpenWeb',
        message: 'Auto-open web browser when starting the web UI?',
        default: getConfigValue('autoOpenWeb', false)
      },
      {
        type: 'input',
        name: 'webPort',
        message: 'Web UI port:',
        default: String(getConfigValue('webPort', 3000)),
        filter: (v) => Number(v)
      }
    ]);

    setConfigValue('outputDir', step2.outputDir);
    setConfigValue('autoOpenWeb', step2.autoOpenWeb);
    setConfigValue('webPort', step2.webPort);

    console.log('\n' + chalk.green('✓ Setup complete'));
    console.log(chalk.dim('Next:'));
    console.log(`  • ${chalk.cyan('protoforge')}            (TUI)`);
    console.log(`  • ${chalk.cyan('protoforge build "..."')} (generate)`);
    console.log(`  • ${chalk.cyan('protoforge web')}        (web UI)`);
  } catch (error) {
    if (error?.isTtyError) {
      console.log(chalk.yellow('\nInteractive prompts not supported in this environment.'));
      console.log(chalk.dim('You can configure manually via: protoforge config --set key=value'));
      return;
    }
    throw error;
  }
}

/**
 * Get default model for a provider
 * @param {string} provider - Provider name
 * @returns {string} Default model name
 */
function getDefaultModel(provider) {
  const defaults = {
    ollama: 'llama3.1',
    openai: 'gpt-4-turbo',
    groq: 'llama-3.1-70b-versatile',
    anthropic: 'claude-sonnet-4-20250514',
    gemini: 'gemini-2.0-flash'
  };
  
  return defaults[provider] || 'llama3.1';
}

/**
 * Test provider connectivity
 * @param {Object} config - Configuration object
 * @param {string} provider - Provider name
 * @returns {Object} Test result
 */
export async function testProviderConnection(provider = 'ollama') {
  const ai = getAIConfig();
  const effectiveProvider = provider || ai.provider;

  if (effectiveProvider === 'ollama') {
    try {
      const url = ai.baseUrl || 'http://localhost:11434';
      const response = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (response.ok) return { success: true, message: 'Ollama is reachable' };
      return { success: false, message: 'Ollama not responding' };
    } catch {
      return { success: false, message: 'Cannot connect to Ollama' };
    }
  }

  if (['openai', 'groq', 'anthropic', 'gemini', 'deepseek'].includes(effectiveProvider)) {
    return ai.apiKey ? { success: true, message: 'API key configured' } : { success: false, message: 'API key not set' };
  }

  return { success: true, message: 'Provider configured' };
}

export default { setupWizard, testProviderConnection };
