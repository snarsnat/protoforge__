#!/usr/bin/env node

/**
 * ProtoForge CLI Entry Point
 * AI-powered prototype builder for hardware, software, and hybrid projects
 *
 * ANTI-AI-DESIGN: Built with brutalist aesthetics, terminal-first philosophy,
 * and zero concessions to the "AI assistant" chat bubble paradigm.
 */

import { Command } from 'commander';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8')
);

const BANNER = `
${chalk.cyan('╔══════════════════════════════════════════════════════════════════════════════════════════════╗')}
${chalk.cyan('║')}                                                                                              ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.white('██████╗ ██████╗  ██████╗ ████████╗ ██████╗ ███████╗ ██████╗ ██████╗  ██████╗ ███████╗')}  ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.white('██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝██╔═══██╗██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██╔════╝')}  ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.white('██████╔╝██████╔╝██║   ██║   ██║   ██║   ██║█████╗  ██║   ██║██████╔╝██║  ███╗█████╗  ')}  ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.white('██╔═══╝ ██╔══██╗██║   ██║   ██║   ██║   ██║██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝  ')}  ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.white('██║     ██║  ██║╚██████╔╝   ██║   ╚██████╔╝██║     ╚██████╔╝██║  ██║╚██████╔╝███████╗')}  ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.white('╚═╝     ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝ ╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝')}  ${chalk.cyan('║')}
${chalk.cyan('║')}                                                                                              ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.yellow('AI-POWERED PROTOTYPE BUILDER')}                                                            ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.dim('v' + packageJson.version + ' │ NO CHAT BUBBLES │ NO GRADIENTS │ TERMINAL FIRST')}                             ${chalk.cyan('║')}
${chalk.cyan('║')}                                                                                              ${chalk.cyan('║')}
${chalk.cyan('╚══════════════════════════════════════════════════════════════════════════════════════════════╝')}
`;

function showBanner() {
  console.log(chalk.reset(BANNER));
}

async function startTUI() {
  if (!process.stdin.isTTY) {
    throw new Error(
      'TUI requires an interactive TTY. Try: protoforge build "..."  or  protoforge web'
    );
  }
  // Dynamic import to keep CLI fast when used non-interactively.
  const { render } = await import('ink');
  const React = (await import('react')).default;
  const { default: App } = await import('../lib/ui/App.js');
  render(React.createElement(App));
}

async function main() {
  const program = new Command();

  program
    .name('protoforge')
    .description('AI-powered prototype builder for hardware, software, and hybrid projects')
    .version(packageJson.version)
    .option('--web', 'Start the web interface')
    .configureOutput({
      writeErr: (str) => process.stderr.write(chalk.red(str)),
      writeOut: (str) => process.stdout.write(str)
    });

  program
    .command('start')
    .description('Start the interactive TUI')
    .action(async () => {
      showBanner();
      await startTUI();
    });

  program
    .command('build')
    .description('Generate a prototype package from a natural language description')
    .argument('<description...>', 'Prototype description in quotes')
    .option('-t, --type <type>', 'Project type: hardware|software|hybrid|auto', 'auto')
    .option('-o, --output <dir>', 'Output directory (default from config)')
    .option('--stream', 'Stream tokens to stdout', false)
    .option('--zip', 'Create a zip archive of the generated project', false)
    .action(async (descriptionParts, opts) => {
      const description = descriptionParts.join(' ').trim();
      const { generatePrototype } = await import('../lib/core/generator.js');
      const { createProjectZip } = await import('../lib/core/output.js');

      showBanner();

      const result = await generatePrototype(description, {
        projectType: opts.type,
        outputDir: opts.output,
        stream: Boolean(opts.stream),
        onToken: (t) => {
          if (opts.stream) process.stdout.write(t);
        }
      });

      if (opts.zip) {
        const zipPath = await createProjectZip(result.projectDir);
        process.stdout.write(`\n${chalk.green('✓ ZIP:')} ${zipPath}\n`);
      }
    });

  program
    .command('setup')
    .description('Run the interactive setup wizard')
    .action(async () => {
      showBanner();
      const { setupWizard } = await import('../lib/ui/setup.js');
      await setupWizard();
    });

  program
    .command('config')
    .description('View or edit ProtoForge configuration')
    .option('--get <key>', 'Get a value (e.g., aiProvider, model, outputDir)')
    .option('--set <pair...>', 'Set values: key=value (repeatable)')
    .option('--reset', 'Reset configuration to defaults')
    .action(async (opts) => {
      const { getConfig, getConfigValue, setConfigValue, resetConfig } = await import('../lib/core/config.js');

      if (opts.reset) {
        resetConfig();
        process.stdout.write(chalk.green('✓ Config reset to defaults\n'));
        return;
      }

      if (opts.get) {
        const v = getConfigValue(opts.get);
        process.stdout.write(`${v === undefined ? '' : JSON.stringify(v, null, 2)}\n`);
        return;
      }

      if (opts.set && opts.set.length) {
        for (const pair of opts.set) {
          const idx = pair.indexOf('=');
          if (idx === -1) throw new Error(`Invalid --set pair: ${pair} (expected key=value)`);
          const key = pair.slice(0, idx);
          let value = pair.slice(idx + 1);
          try {
            // allow JSON values
            value = JSON.parse(value);
          } catch {
            // keep as string
          }
          setConfigValue(key, value);
        }
        process.stdout.write(chalk.green('✓ Config updated\n'));
        return;
      }

      process.stdout.write(JSON.stringify(getConfig(), null, 2) + '\n');
    });

  program
    .command('web')
    .description('Start the local web dashboard')
    .option('-p, --port <port>', 'Port (default from config or 3000)', (v) => Number(v))
    .action(async (opts) => {
      showBanner();
      const { getConfigValue } = await import('../lib/core/config.js');
      const { startWebServer } = await import('../lib/web/server.js');
      const port = opts.port || getConfigValue('webPort', 3000);
      await startWebServer(port);
    });

  await program.parseAsync(process.argv);

  const parsedOpts = program.opts();

  // Default behavior: start TUI (or web) if no subcommand provided.
  if (!program.args.length) {
    showBanner();
    if (parsedOpts.web) {
      const { getConfigValue } = await import('../lib/core/config.js');
      const { startWebServer } = await import('../lib/web/server.js');
      await startWebServer(getConfigValue('webPort', 3000));
    } else {
      await startTUI();
    }
  }
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error?.stack || error?.message || String(error));
  process.exit(1);
});
