/**
 * Setup Wizard Module
 * Interactive setup wizard for configuring AI providers and integrations
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { loadConfig, getConfigDir } from '../core/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Run the setup wizard
 */
export async function setupWizard() {
  console.log(chalk.cyan('\n╔═══════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.white('         ProtoForge Setup Wizard') + chalk.cyan('                       ║'));
  console.log(chalk.cyan('╚═══════════════════════════════════════════════════════════╝\n'));
  
  const config = await loadConfig();
  
  try {
    // Step 1: Chatbot Configuration
    console.log(chalk.white('Step 1/4: ') + chalk.cyan('Chatbot Configuration (Required)'));
    console.log(chalk.dim('━'.repeat(60)));
    
    const chatbotAnswers = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Which AI chatbot provider do you want to use?',
        choices: [
          { name: 'Ollama (Local - Recommended)', value: 'ollama' },
          { name: 'OpenAI (GPT-4, GPT-3.5)', value: 'openai' },
          { name: 'Groq (Fast inference)', value: 'groq' },
          { name: 'Anthropic (Claude)', value: 'anthropic' },
          { name: 'Google (Gemini)', value: 'gemini' }
        ],
        default: 'ollama'
      },
      {
        type: 'input',
        name: 'model',
        message: 'Model name:',
        default: (answers) => getDefaultModel(answers.provider),
        when: (answers) => answers.provider !== 'ollama'
      },
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your API key:',
        when: (answers) => answers.provider !== 'ollama',
        validate: (input) => input.length > 0 || 'API key is required'
      },
      {
        type: 'input',
        name: 'ollamaUrl',
        message: 'Ollama URL:',
        default: 'http://localhost:11434',
        when: (answers) => answers.provider === 'ollama'
      },
      {
        type: 'input',
        name: 'ollamaModel',
        message: 'Ollama model:',
        default: 'llama3.1',
        when: (answers) => answers.provider === 'ollama'
      }
    ]);
    
    // Save chatbot config
    config.set('chatbot.provider', chatbotAnswers.provider);
    
    const providerKey = `providers.${chatbotAnswers.provider}`;
    config.set(`${providerKey}.model`, chatbotAnswers.model || getDefaultModel(chatbotAnswers.provider));
    
    if (chatbotAnswers.apiKey) {
      config.set(`${providerKey}.apiKey`, chatbotAnswers.apiKey);
    }
    
    if (chatbotAnswers.ollamaUrl) {
      config.set(`${providerKey}.url`, chatbotAnswers.ollamaUrl);
    }
    
    // Step 2: Image Generation (Optional)
    console.log('\n' + chalk.white('Step 2/4: ') + chalk.cyan('Image Generation (Optional)'));
    console.log(chalk.dim('━'.repeat(60)));
    
    const imageAnswers = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Image generation provider:',
        choices: [
          { name: 'Skip (Use text descriptions only)', value: 'none' },
          { name: 'OpenAI DALL-E', value: 'openai' },
          { name: 'Groq Flux', value: 'groq' },
          { name: 'Local Stable Diffusion', value: 'local' }
        ],
        default: 'none'
      },
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your image generation API key:',
        when: (answers) => answers.provider !== 'none' && answers.provider !== 'local'
      }
    ]);
    
    config.set('imageGen.provider', imageAnswers.provider);
    if (imageAnswers.apiKey) {
      config.set('imageGen.apiKey', imageAnswers.apiKey);
    }
    
    // Step 3: 3D Generation (Optional - Meshy AI)
    console.log('\n' + chalk.white('Step 3/4: ') + chalk.cyan('3D Model Generation (Optional)'));
    console.log(chalk.dim('━'.repeat(60)));
    
    const meshyAnswers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'enabled',
        message: 'Enable Meshy AI for 3D model generation?',
        default: false
      },
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your Meshy API key:',
        when: (answers) => answers.enabled,
        validate: (input) => input.length > 0 || 'API key is required'
      }
    ]);
    
    config.set('meshy3d.enabled', meshyAnswers.enabled);
    if (meshyAnswers.apiKey) {
      config.set('meshy3d.apiKey', meshyAnswers.apiKey);
    }
    
    // Step 4: General Settings
    console.log('\n' + chalk.white('Step 4/4: ') + chalk.cyan('General Settings'));
    console.log(chalk.dim('━'.repeat(60)));
    
    const settingsAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'outputDir',
        message: 'Output directory for generated projects:',
        default: './protoforge-output'
      },
      {
        type: 'confirm',
        name: 'autoOpenBrowser',
        message: 'Auto-open web browser when generating?',
        default: true
      }
    ]);
    
    config.set('settings.outputDir', settingsAnswers.outputDir);
    config.set('settings.autoOpenBrowser', settingsAnswers.autoOpenBrowser);
    
    // Summary
    console.log('\n' + chalk.cyan('═'.repeat(60)));
    console.log(chalk.cyan('  Setup Complete!'));
    console.log(chalk.cyan('═'.repeat(60)));
    console.log();
    
    console.log(chalk.white('Configuration Summary:'));
    console.log(`  • Chatbot: ${chatbotAnswers.provider}`);
    console.log(`  • Image Gen: ${imageAnswers.provider}`);
    console.log(`  • 3D (Meshy): ${meshyAnswers.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`  • Output: ${settingsAnswers.outputDir}`);
    console.log();
    
    console.log(chalk.dim(`Config saved to: ${getConfigDir()}/config.json`));
    console.log();
    
    console.log(chalk.green('Next steps:'));
    console.log(`  • Run ${chalk.cyan('protoforge')} to start the TUI`);
    console.log(`  • Run ${chalk.cyan('protoforge build "your idea"')} to generate a prototype`);
    console.log(`  • Run ${chalk.cyan('protoforge --web')} for web interface`);
    console.log();
    
  } catch (error) {
    if (error.isTtyError) {
      console.log(chalk.yellow('\n⚠ Interactive prompts not supported in this environment.'));
      console.log(chalk.white('Please manually create a config file at:'));
      console.log(chalk.cyan(`${getConfigDir()}/config.json`));
    } else {
      throw error;
    }
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
export async function testProviderConnection(config, provider) {
  const providerConfig = config.get(`providers.${provider}`);
  
  switch (provider) {
    case 'ollama': {
      try {
        const url = providerConfig.url || 'http://localhost:11434';
        const response = await fetch(`${url}/api/tags`, {
          signal: AbortSignal.timeout(5000)
        });
        if (response.ok) {
          return { success: true, message: 'Ollama is running' };
        }
        return { success: false, message: 'Ollama not responding' };
      } catch {
        return { success: false, message: 'Cannot connect to Ollama' };
      }
    }
    
    case 'openai':
    case 'groq':
    case 'anthropic':
    case 'gemini': {
      // Would need to make an actual API call to test
      if (providerConfig.apiKey && providerConfig.apiKey.length > 0) {
        return { success: true, message: 'API key configured' };
      }
      return { success: false, message: 'API key not set' };
    }
    
    default:
      return { success: false, message: 'Unknown provider' };
  }
}

export default {
  setupWizard,
  testProviderConnection
};
