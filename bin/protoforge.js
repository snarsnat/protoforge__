#!/usr/bin/env node

/**
 * ProtoForge CLI Entry Point
 * AI-powered prototype builder for hardware, software, and hybrid projects
 * 
 * ANTI-AI-DESIGN: Built with brutalist aesthetics, terminal-first philosophy,
 * and zero concessions to the "AI assistant" chat bubble paradigm.
 */

import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import chalk from 'chalk';
import figlet from 'figlet';

import App from '../lib/ui/App.js';
import { startWebServer } from '../lib/web/server.js';
import { setupWizard } from '../lib/ui/setup.js';
import { generatePrototype } from '../lib/core/generator.js';
import { loadConfig, ensureConfigDir } from '../lib/core/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8')
);

// ASCII Art Banner - No gradients, no glow, just raw terminal aesthetics
const BANNER = `
${chalk.cyan('╔════════════════════════════════════════════════════════════════════════════════╗')}
${chalk.cyan('║')}                                                                                ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.white('██████╗ ██████╗ ███████╗ █████╗  ██████╗██╗  ██╗   ')}                                ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.white('██╔═══██╗██╔══██╗██╔════╝██╔══██╗██╔════╝██║  ██║   ')}                                ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.white('██║   ██║██████╔╝█████╗  ███████║██║     ███████║   ')}                                ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.white('██║   ██║██╔══██╗██╔══╝  ██╔══██║██║     ██╔══██║   ')}                                ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.white('╚██████╔╝██║  ██║███████╗██║  ██║╚██████╗██║  ██║   ')}                                ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.white(' ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝   ')}                                ${chalk.cyan('║')}
${chalk.cyan('║')}                                                                                ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.yellow('AI-POWERED PROTOTYPE BUILDER')}                                              ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.dim('v' + packageJson.version + ' │ NO CHAT BUBBLES │ NO GRADIENTS │ TERMINAL FIRST')}                   ${chalk.cyan('║')}
${chalk.cyan('║')}                                                                                ${chalk.cyan('║')}
${chalk.cyan('╚════════════════════════════════════════════════════════════════════════════════╝')}
`;

/**
 * Display welcome banner with ASCII art
 */
function showBanner() {
  console.log(BANNER);
}

/**
 * Main CLI setup using Commander.js
 */
async function main() {
  const program = new Command();

  program
    .name('protoforge')
    .description('AI-powered prototype builder for hardware, software, and hybrid projects')
    .version(packageJson.version)
    .configureOutput({
      writeErr: (str) => process.stderr.write(chalk.red(str)),
      writeOut: (str) => process.stdout.write(str)
    });

  // Default command - enters interactive TUI
  program
    .command('start')
    .alias('run')
    .description('Start the interactive TUI interface')
    .option('--provider <type>', 'AI provider to use (ollama, openai, groq, anthropic, gemini)')
    .option('--model <name>', 'Model name to use')
    .action(async (options) => {
      showBanner();
      const config = await loadConfig();
      
      // Use command line options, fall back to config
      const provider = options.provider || config.get('chatbot.provider') || 'ollama';
      const model = options.model || config.get(`providers.${provider}.model`) || 'llama3.1';
      
      // Start TUI
      render(React.createElement(App, { 
        provider, 
        model,
        config 
      }));
    });

  // Install command - Install ProtoForge CLI globally
  program
    .command('install')
    .alias('i', 'add')
    .description('Install ProtoForge CLI globally (requires npm access)')
    .action(async () => {
      showBanner();
      
      console.log(chalk.white('┌─────────────────────────────────────────────────────────────────┐'));
      console.log(chalk.white('│ INSTALLATION OPTIONS                                           │'));
      console.log(chalk.white('├─────────────────────────────────────────────────────────────────┤'));
      console.log(chalk.white('│ 1. npm install -g protoforge                                  │'));
      console.log(chalk.white('│ 2. Local development: npm link                                │'));
      console.log(chalk.white('│ 3. Docker: docker run protoforge/cli                          │'));
      console.log(chalk.white('└─────────────────────────────────────────────────────────────────┘'));
      console.log();
      
      const { exec } = await import('child_process');
      
      try {
        // Check npm availability
        const npmCheck = exec('npm --version');
        let npmAvailable = false;
        npmCheck.stdout?.on('data', (data) => {
          if (data.trim()) npmAvailable = true;
        });
        
        // For now, just show instructions since global install requires confirmation
        console.log(chalk.cyan('To install ProtoForge globally, run:'));
        console.log();
        console.log(chalk.white('  $ ') + chalk.green('npm install -g protoforge'));
        console.log();
        console.log(chalk.dim('Or for local development:'));
        console.log();
        console.log(chalk.white('  $ ') + chalk.green('npm link'));
        console.log();
        console.log(chalk.yellow('Note: Global installation requires npm administrator privileges.'));
        console.log(chalk.yellow('On Linux/macOS, you may need: sudo npm install -g protoforge'));
        
      } catch (error) {
        console.log(chalk.red('Error checking npm availability.'));
        console.log(chalk.dim('Please ensure Node.js and npm are installed.'));
      }
    });

  // Setup wizard command
  program
    .command('setup')
    .description('Run the setup wizard to configure AI providers and integrations')
    .action(async () => {
      showBanner();
      await ensureConfigDir();
      await setupWizard();
    });

  // Build command - generate prototype from command line
  program
    .command('build <description>')
    .alias('generate', 'create')
    .description('Generate a prototype from a text description')
    .option('-t, --type <type>', 'Project type (hardware, software, hybrid)', 'hybrid')
    .option('-p, --provider <type>', 'AI provider to use')
    .option('-o, --output <dir>', 'Output directory', './protoforge-output')
    .option('--no-web', 'Skip opening web interface')
    .option('--zip', 'Create a zip archive of the output')
    .action(async (description, options) => {
      showBanner();
      
      const config = await loadConfig();
      const provider = options.provider || config.get('chatbot.provider') || 'ollama';
      const type = options.type || 'hybrid';
      
      console.log(chalk.cyan('Generating prototype...'));
      console.log(chalk.dim(`Description: ${description}`));
      console.log(chalk.dim(`Type: ${type}`));
      console.log(chalk.dim(`Provider: ${provider}`));
      console.log();
      
      try {
        const result = await generatePrototype(description, {
          type,
          provider,
          outputDir: options.output,
          config
        });
        
        console.log(chalk.green('✓ Prototype generated successfully!'));
        console.log(chalk.dim(`Output: ${result.outputDir}`));
        console.log();
        
        if (options.zip) {
          const zipPath = await createZipArchive(result.outputDir);
          console.log(chalk.green('✓ Zip archive created:'), chalk.cyan(zipPath));
        }
        
        if (!options.noWeb) {
          const open = await import('open');
          await open.default(`http://localhost:3000/project/${path.basename(result.outputDir)}`);
        }
      } catch (error) {
        console.error(chalk.red('✖ Error generating prototype:'), error.message);
        process.exit(1);
      }
    });

  // Web interface command
  program
    .command('web')
    .description('Start the local web interface')
    .option('-p, --port <port>', 'Port to run on', '3000')
    .action(async (options) => {
      showBanner();
      console.log(chalk.cyan('Starting web interface...'));
      await startWebServer(parseInt(options.port));
    });

  // Settings command
  program
    .command('config')
    .alias('settings')
    .description('View and edit configuration')
    .option('--get <key>', 'Get a config value')
    .option('--set <key> <value>', 'Set a config value')
    .option('--reset', 'Reset all configuration')
    .action(async (options) => {
      const config = await loadConfig();
      
      if (options.get) {
        const value = config.get(options.get);
        console.log(value !== undefined ? value : '(not set)');
      } else if (options.set) {
        const [key, ...valueParts] = options.set.split(' ');
        const value = valueParts.join(' ');
        config.set(key, value);
        console.log(chalk.green(`✓ Set ${key} = ${value}`));
      } else if (options.reset) {
        config.clear();
        console.log(chalk.green('✓ Configuration reset'));
      } else {
        // Show current config (masked)
        console.log(chalk.cyan('Current Configuration:'));
        console.log(chalk.dim('━'.repeat(30)));
        const allConfig = config.store;
        for (const [key, value] of Object.entries(allConfig)) {
          if (key.includes('key') || key.includes('secret')) {
            console.log(`${key}: ${value ? '***MASKED***' : '(not set)'}`);
          } else {
            console.log(`${key}: ${value || '(not set)'}`);
          }
        }
      }
    });

  // Help command alias
  program
    .command('help')
    .description('Show this help message')
    .action(() => {
      program.help();
    });

  // Parse arguments
  program.parse(process.argv);

  // Show help if no command provided
  if (process.argv.length === 2) {
    showBanner();
    program.help();
  }
}

// Run the CLI
main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error.message);
  process.exit(1);
});
