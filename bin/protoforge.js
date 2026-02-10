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

// ASCII Art Banner
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

/**
 * Display welcome banner
 */
function showBanner() {
  console.log(chalk.reset(BANNER));
}

/**
 * Main CLI setup
 */
async function main() {
  const program = new Command();

  program
    .name('protoforge')
    .description(
      'AI-powered prototype builder for hardware, software, and hybrid projects'
    )
    .version(packageJson.version)
    .configureOutput({
      writeErr: (str) => process.stderr.write(chalk.red(str)),
      writeOut: (str) => process.stdout.write(str)
    });

  program.parse(process.argv);

  if (process.argv.length === 2) {
    showBanner();
    program.help();
  }
}

// Run CLI
main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error.message);
  process.exit(1);
});
