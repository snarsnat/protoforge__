#!/usr/bin/env node

/**
 * ProtoForge CLI
 * Inspired by OpenClaw's CLI design
 */

import 'esbuild-register';

import { Command } from 'commander';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import chalk from 'chalk';
import { loadUserEnv } from './lib/core/env.js';
import {
  getConfig, getConfigValue, setConfigValue, getModelConfig, setModelConfig,
  runSetupWizard, printConfigStatus, resetConfig, exportConfig, importConfig
} from './lib/core/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8')
);

const BANNER = `
${chalk.cyan('╔══════════════════════════════════════════════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.white('██████╗ ██████╗  ██████╗ ████████╗ ██████╗ ███████╗')}               ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.white('██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝██╔═══██╗██╔════╝')}               ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.white('██████╔╝██████╔╝██║   ██║   ██║   ██║   ██║█████╗')}               ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.white('██╔═══╝ ██╔══██╗██║   ██║   ██║   ██║   ██║██╔══╝')}               ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.white('██║     ██║  ██║╚██████╔╝   ██║   ╚██████╔╝██║')}'  + chalk.white('     ╚██████╔╝')}               ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.white('╚═╝     ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝ ╚═╝      ╚═════╝')}               ${chalk.cyan('║')}
${chalk.cyan('║')}                                                                              ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.yellow('AI-POWERED PROTOTYPE BUILDER')}  ${chalk.dim('│')}  ${chalk.white('Hardware + Software + Hybrid')}              ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.dim('v' + packageJson.version + ' │ protoforge [command] │ protoforge web │ protoforge tui')}               ${chalk.cyan('║')}
${chalk.cyan('╚══════════════════════════════════════════════════════════════════════════════╝')}
`;

function showBanner() {
  console.log(chalk.reset(BANNER));
}

async function startTUI() {
  if (!process.stdin.isTTY) {
    throw new Error('TUI requires interactive terminal. Try: protoforge build "..."');
  }
  const { render } = await import('ink');
  const React = (await import('react')).default;
  const { default: App } = await import('./lib/ui/App.js');
  render(React.createElement(App));
}

async function main() {
  loadUserEnv();

  const program = new Command();

  program
    .name('protoforge')
    .description('AI-powered prototype builder for hardware, software, and hybrid projects')
    .version(packageJson.version)
    .configureOutput({
      writeErr: (str) => process.stderr.write(chalk.red(str)),
      writeOut: (str) => process.stdout.write(str)
    });

  // ═══════════════════════════════════════════════════════
  // TUI Command
  // ═══════════════════════════════════════════════════════
  program
    .command('tui')
    .alias('start')
    .description('Start the interactive TUI')
    .action(async () => {
      showBanner();
      await startTUI();
    });

  // ═══════════════════════════════════════════════════════
  // Build Command
  // ═══════════════════════════════════════════════════════
  program
    .command('build')
    .description('Generate a prototype from description')
    .argument('<description...>', 'Prototype description')
    .option('-t, --type <type>', 'Project type: hardware|software|hybrid|auto', 'auto')
    .option('-o, --output <dir>', 'Output directory')
    .option('--provider <provider>', 'AI provider override')
    .option('--model <model>', 'Model override')
    .option('--stream', 'Stream output', false)
    .option('--zip', 'Create zip archive', false)
    .action(async (descParts, opts) => {
      const description = descParts.join(' ').trim();
      const { generatePrototype } = await import('./lib/core/generator.js');
      const { createProjectZip } = await import('./lib/core/output.js');
      
      if (opts.provider || opts.model) {
        setModelConfig({ primary: `${opts.provider}/${opts.model}` });
      }

      showBanner();

      const result = await generatePrototype(description, {
        projectType: opts.type,
        outputDir: opts.output,
        stream: Boolean(opts.stream),
        onToken: (t) => { if (opts.stream) process.stdout.write(t); }
      });

      if (opts.zip) {
        const zipPath = await createProjectZip(result.projectDir);
        console.log(chalk.green('✓ ZIP:'), zipPath);
      }
    });

  // ═══════════════════════════════════════════════════════
  // Setup Wizard (OpenClaw-style)
  // ═══════════════════════════════════════════════════════
  program
    .command('onboard')
    .alias('setup', 'wizard')
    .description('Run the interactive setup wizard')
    .action(async () => {
      showBanner();
      await runSetupWizard();
    });

  // ═══════════════════════════════════════════════════════
  // Config Management (OpenClaw-style)
  // ═══════════════════════════════════════════════════════
  program
    .command('config')
    .description('View or edit configuration')
    .option('--get <key>', 'Get a config value')
    .option('--set <pair...>', 'Set values: key=value')
    .option('--unset <key>', 'Unset a value')
    .option('--reset', 'Reset all config')
    .option('--export [file]', 'Export config to JSON')
    .option('--import <file>', 'Import config from JSON')
    .option('--status', 'Show config status')
    .action(async (opts) => {
      if (opts.status) {
        printConfigStatus();
        return;
      }

      if (opts.reset) {
        resetConfig();
        console.log(chalk.green('✓ Config reset to defaults'));
        return;
      }

      if (opts.export) {
        const file = await exportConfig(opts.export === true ? null : opts.export);
        console.log(chalk.green('✓ Config exported to:'), file);
        return;
      }

      if (opts.import) {
        await importConfig(opts.import);
        console.log(chalk.green('✓ Config imported'));
        return;
      }

      if (opts.get) {
        const value = getConfigValue(opts.get);
        console.log(value === undefined ? '' : JSON.stringify(value, null, 2));
        return;
      }

      if (opts.set && opts.set.length) {
        for (const pair of opts.set) {
          const idx = pair.indexOf('=');
          if (idx === -1) throw new Error(`Invalid --set pair: ${pair} (expected key=value)`);
          const key = pair.slice(0, idx);
          let value = pair.slice(idx + 1);
          try { value = JSON.parse(value); } catch {}
          setConfigValue(key, value);
        }
        console.log(chalk.green('✓ Config updated'));
        return;
      }

      if (opts.unset) {
        unsetConfigValue(opts.unset);
        console.log(chalk.green('✓ Config value unset'));
        return;
      }

      console.log(JSON.stringify(getConfig(), null, 2));
    });

  // ═══════════════════════════════════════════════════════
  // Model Management (OpenClaw models-style)
  // ═══════════════════════════════════════════════════════
  program
    .command('model')
    .description('Model discovery and configuration')
    .option('--list', 'List available models')
    .option('--status', 'Show model status')
    .option('--set <provider/model>', 'Set primary model')
    .option('--fallback <provider/model>', 'Add fallback model')
    .action(async (opts) => {
      if (opts.status) {
        const model = getModelConfig();
        printConfigStatus();
        return;
      }

      if (opts.list) {
        console.log(chalk.white('\nAvailable providers:'));
        const { getAvailableProviders } = await import('./lib/core/config.js');
        const providers = getAvailableProviders();
        providers.forEach(p => {
          console.log(`  ${chalk.cyan(p.id)}: ${p.name}`);
        });
        return;
      }

      if (opts.set) {
        const [provider, model] = opts.set.split('/');
        setModelConfig({ primary: `${provider}/${model}` });
        console.log(chalk.green('✓ Model set:'), `${provider}/${model}`);
        return;
      }

      if (opts.fallback) {
        const model = getModelConfig();
        model.fallback.push(opts.fallback);
        setModelConfig({ fallback: model.fallback });
        console.log(chalk.green('✓ Fallback added:'), opts.fallback);
        return;
      }

      const model = getModelConfig();
      console.log(model.primary);
    });

  // ═══════════════════════════════════════════════════════
  // Web Interface
  // ═══════════════════════════════════════════════════════
  program
    .command('web')
    .description('Start the web dashboard')
    .option('-p, --port <port>', 'Port number', v => Number(v))
    .action(async (opts) => {
      showBanner();
      const port = opts.port || getConfigValue('webPort', 3000);
      const { startWebServer } = await import('./lib/web/server.js');
      await startWebServer(port);
    });

  // ═══════════════════════════════════════════════════════
  // Install Command
  // ═══════════════════════════════════════════════════════
  program
    .command('install')
    .description('Print install commands')
    .action(() => {
      showBanner();
      console.log([
        'Install (npm):',
        '  npm install -g protoforge',
        '',
        'From source:',
        '  git clone https://github.com/snarsnat/protoforge.git',
        '  cd protoforge',
        '  npm install',
        '  npm link',
        ''
      ].join('\n'));
    });

  await program.parseAsync(process.argv);
  const parsedOpts = program.opts();

  if (!program.args.length) {
    showBanner();
    console.log(chalk.dim('Commands:'));
    console.log(chalk.dim('  protoforge tui        ') + 'Interactive TUI');
    console.log(chalk.dim('  protoforge web        ') + 'Web interface');
    console.log(chalk.dim('  protoforge onboard    ') + 'Setup wizard');
    console.log(chalk.dim('  protoforge build ".." ') + 'Generate prototype');
    console.log(chalk.dim('  protoforge config     ') + 'Manage config');
    console.log(chalk.dim('  protoforge model     ') + 'Manage models');
    console.log('');
    
    if (parsedOpts.web) {
      const port = getConfigValue('webPort', 3000);
      const { startWebServer } = await import('./lib/web/server.js');
      await startWebServer(port);
    } else {
      await startTUI();
    }
  }
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error?.stack || error?.message || String(error));
  process.exit(1);
});
