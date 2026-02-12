// lib/ui/App.js
import React from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import open from 'open';
import { generatePrototype } from '../core/generator.js';
import { getConfigValue } from '../core/config.js';
import { startWebServer } from '../web/server.js';

const TABS = ['Files', 'Diagrams', '3D', 'BOM', 'Guide'];

function bannerLine() {
  return chalk.cyan('PROTOFORGE') + chalk.dim('  | terminal-first prototype builder');
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export default function App() {
  const { exit } = useApp();

  // Clear screen for a clean TUI surface (no scrollback junk)
  React.useEffect(() => {
    try {
      process.stdout.write('\x1b[2J\x1b[H');
    } catch {}
  }, []);

  const [tabIndex, setTabIndex] = React.useState(0);
  const [prompt, setPrompt] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [logLines, setLogLines] = React.useState([bannerLine(), chalk.dim('Press Enter to run. Tab switches panels. Esc clears input.')]);
  const [history, setHistory] = React.useState([]);
  const [historyIndex, setHistoryIndex] = React.useState(-1);
  const [busy, setBusy] = React.useState(false);
  const [lastOutputDir, setLastOutputDir] = React.useState(getConfigValue('lastProject', ''));

  const appendLog = React.useCallback((line) => {
    setLogLines((prev) => {
      const next = [...prev, line];
      // keep it dense; avoid runaway memory
      return next.slice(-200);
    });
  }, []);

  const run = React.useCallback(async () => {
    const text = prompt.trim();
    if (!text) return;

    setBusy(true);
    setStatus('running');
    appendLog(chalk.yellow(`> ${text}`));

    // history
    setHistory((h) => [text, ...h].slice(0, 50));
    setHistoryIndex(-1);
    setPrompt('');

    const tuiLogger = {
      info: (m) => appendLog(chalk.dim(String(m))),
      success: (m) => appendLog(chalk.green(String(m))),
      warn: (m) => appendLog(chalk.yellow(String(m))),
      error: (m) => appendLog(chalk.red(String(m))),
      debug: () => {},
      banner: () => {},
      header: () => {}
    };

    try {
      const res = await generatePrototype(text, {
        projectType: 'hybrid',
        stream: true,
        logger: tuiLogger,
        onToken: () => {
          // We intentionally do not dump tokens into the log in TUI.
          // The web UI is the place to view/edit rich output.
        }
      });

      setLastOutputDir(res.projectDir);
      setStatus('done');
      appendLog(chalk.green(`✓ Done: ${res.projectDir}`));
      appendLog(chalk.dim('Tip: press W to open the web dashboard.'));
    } catch (e) {
      setStatus('error');
      appendLog(chalk.red(String(e?.message || e)));
    } finally {
      setBusy(false);
    }
  }, [prompt, appendLog]);

  const openWeb = React.useCallback(async () => {
    const port = Number(getConfigValue('webPort', 3000)) || 3000;
    appendLog(chalk.dim(`Starting web server on http://localhost:${port} ...`));
    try {
      await startWebServer(port);
      // startWebServer blocks; so if it returns, just open.
      await open(`http://localhost:${port}`);
    } catch (e) {
      appendLog(chalk.red(`Web error: ${e?.message || e}`));
    }
  }, [appendLog]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') exit();

    if (key.tab) {
      setTabIndex((i) => (i + 1) % TABS.length);
      return;
    }
    if (key.shift && key.tab) {
      setTabIndex((i) => (i - 1 + TABS.length) % TABS.length);
      return;
    }

    if (input === 'w' || input === 'W') {
      // fire and forget
      openWeb();
      return;
    }

    if (key.escape) {
      setPrompt('');
      setHistoryIndex(-1);
      setStatus('');
      return;
    }

    // Input history (OpenClaw-style)
    if (key.upArrow && history.length) {
      const next = clamp(historyIndex + 1, 0, history.length - 1);
      setHistoryIndex(next);
      setPrompt(history[next] || '');
      return;
    }
    if (key.downArrow && history.length) {
      const next = clamp(historyIndex - 1, -1, history.length - 1);
      setHistoryIndex(next);
      setPrompt(next === -1 ? '' : (history[next] || ''));
      return;
    }

    if (key.return) {
      if (!busy) run();
      return;
    }
  });

  const leftWidth = 0.62;

  return (
    <Box flexDirection="column" paddingX={1} paddingY={0}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text>{chalk.cyan('ProtoForge')}</Text>
        <Text dimColor>
          {busy ? chalk.yellow('RUNNING') : status === 'error' ? chalk.red('ERROR') : status === 'done' ? chalk.green('DONE') : chalk.dim('IDLE')}
          {lastOutputDir ? chalk.dim(`  |  last: ${lastOutputDir}`) : ''}
        </Text>
      </Box>

      <Box flexDirection="row" marginTop={1}>
        {/* Left panel: input + log */}
        <Box flexDirection="column" width={`${Math.floor(leftWidth * 100)}%`} paddingRight={1}>
          <Box flexDirection="column" borderStyle="round" borderColor="gray">
            <Box paddingX={1} paddingY={0}>
              <Text>{chalk.dim('Prompt')}</Text>
            </Box>
            <Box paddingX={1} paddingBottom={1}>
              <TextInput value={prompt} onChange={setPrompt} placeholder={busy ? 'Running…' : 'Describe what you want to build…'} />
            </Box>
          </Box>

          <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="gray" height={18}>
            <Box paddingX={1} paddingY={0}>
              <Text>{chalk.dim('Run log')}</Text>
            </Box>
            <Box flexDirection="column" paddingX={1} paddingBottom={1}>
              {logLines.slice(-14).map((l, idx) => (
                <Text key={idx}>{l}</Text>
              ))}
            </Box>
          </Box>
        </Box>

        {/* Right panel: tabs */}
        <Box flexDirection="column" width={`${100 - Math.floor(leftWidth * 100)}%`}>
          <Box borderStyle="round" borderColor="gray" flexDirection="column" height={20}>
            <Box paddingX={1} paddingY={0}>
              <Text>
                {TABS.map((t, i) => {
                  const active = i === tabIndex;
                  const label = active ? chalk.inverse(` ${t} `) : chalk.dim(` ${t} `);
                  return <Text key={t}>{label}</Text>;
                })}
              </Text>
            </Box>

            <Box paddingX={1} paddingY={1} flexDirection="column">
              {tabIndex === 0 && (
                <Text>
                  {lastOutputDir
                    ? `Project files are in: ${lastOutputDir}\nOpen the web dashboard (W) for editing + browsing.`
                    : 'No project yet. Run a prompt to generate one.'}
                </Text>
              )}
              {tabIndex === 1 && <Text>Diagrams (Mermaid) are generated into the output folder. Use Web (W) to view.</Text>}
              {tabIndex === 2 && <Text>3D preview is generated as HTML in the output folder. Use Web (W) to view.</Text>}
              {tabIndex === 3 && <Text>BOM is generated in the output folder (CSV/MD). Use Web (W) to view.</Text>}
              {tabIndex === 4 && <Text>Guide is generated as markdown in the output folder. Use Web (W) to view.</Text>}
            </Box>
          </Box>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          Enter run | ↑↓ history | Tab panels | W web | Ctrl+C quit
        </Text>
      </Box>
    </Box>
  );
}
