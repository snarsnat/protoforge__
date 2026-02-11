// lib/ui/App.js
import React from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import { generatePrototype } from '../core/generator.js';
import { startWebServer } from '../web/server.js';

const ASCII_BANNER = chalk.cyan(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ██████╗ ██████╗ ███████╗ █████╗  ██████╗██╗  ██╗                            ║
║  ██╔═══██╗██╔══██╗██╔════╝██╔══██╗██╔════╝██║  ██║                            ║
║  ██║   ██║██████╔╝█████╗  ███████║██║     ███████║                            ║
║  ██║   ██║██╔══██╗██╔══╝  ██╔══██║██║     ██╔══██║                            ║
║  ╚██████╔╝██║  ██║███████╗██║  ██║╚██████╗██║  ██║                            ║
║   ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝                            ║
║                                                                              ║
║   AI-POWERED PROTOTYPE BUILDER                                                ║
║   v1.0.0  |  NO CHAT BUBBLES  |  NO GRADIENTS  |  TERMINAL FIRST             ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

export default function App() {
  const { exit } = useApp();

  // Clear screen for a clean TUI surface (no scrollback junk)
  React.useEffect(() => {
    try {
      process.stdout.write('\x1b[2J\x1b[H');
    } catch {}
  }, []);


  const [step, setStep] = React.useState('menu');
  const [menuIndex, setMenuIndex] = React.useState(0);
  const [prompt, setPrompt] = React.useState('');
  const [statusMessage, setStatusMessage] = React.useState('');

  const menuOptions = [
    { label: 'New Prototype' },
    { label: 'Web Interface (localhost)' },
    { label: 'Quit' }
  ];

  useInput((input, key) => {
    if (step === 'menu') {
      if (key.downArrow) setMenuIndex(i => (i + 1) % menuOptions.length);
      if (key.upArrow) setMenuIndex(i => (i - 1 + menuOptions.length) % menuOptions.length);

      if (key.return) {
        const selection = menuOptions[menuIndex].label;
        if (selection === 'Quit') exit();
        if (selection === 'New Prototype') setStep('input');
        if (selection.startsWith('Web Interface')) {
          setStatusMessage('Starting web server on http://localhost:3000 ...');
          startWebServer(3000).catch((err) =>
            setStatusMessage(`Web error: ${err.message}`)
          );
        }
      }

      if (input === 'q') exit();
    }

    if (step === 'input') {
      if (key.escape) setStep('menu');

      if (key.return) {
        setStatusMessage('Generating...');
        const silentLogger = { info: () => {}, success: () => {}, warn: () => {}, error: () => {}, debug: () => {}, banner: () => {}, header: () => {} };
        generatePrototype(prompt, { projectType: 'hybrid', logger: silentLogger })
          .then((res) => setStatusMessage(`Done! Output: ${res.projectDir}`))
          .catch((err) => setStatusMessage(`Error: ${err.message}`));
      }
    }
  });

  if (step === 'menu') {
    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(Text, null, ASCII_BANNER),
      React.createElement(
        Box,
        { marginTop: 1, flexDirection: 'column' },
        menuOptions.map((opt, idx) =>
          React.createElement(
            Text,
            { key: opt.label, color: idx === menuIndex ? 'yellow' : 'white' },
            `${idx === menuIndex ? '→ ' : '  '}${opt.label}`
          )
        )
      ),
      React.createElement(
        Text,
        { dimColor: true },
        statusMessage || '↑↓ Navigate | Enter Select | q Quit'
      )
    );
  }

  if (step === 'input') {
    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(Text, { color: 'cyan' }, 'Enter description:'),
      React.createElement(TextInput, {
        value: prompt,
        onChange: setPrompt
      }),
      React.createElement(Text, { dimColor: true }, statusMessage)
    );
  }

  return null;
}
