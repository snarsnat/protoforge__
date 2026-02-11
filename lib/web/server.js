/**
 * Web Server Module
 * Local Express server for the ProtoForge web interface
 * 
 * ANTI-AI-DESIGN PHILOSOPHY:
 * - No chat bubbles (they're overused AI clichés)
 * - No gradients, glow effects, or subtle shadows
 * - No rounded corners (brutalist angular design)
 * - No floating elements or floating action buttons
 * - No minimalist white space (density is efficiency)
 * - No "copilot" or "assistant" paradigms
 * - High contrast, visible borders, grid lines everywhere
 * - Split-panel layout inspired by terminal multiplexers
 * - Monospace typography for everything
 * - Terminal-first aesthetic with real ASCII art
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import open from 'open';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Start the web server
 * @param {number} port - Port to listen on
 * @returns {Promise<http.Server>} HTTP server instance
 */
export async function startWebServer(port = 3000) {
  const app = express();
  const server = createServer(app);
  
  // Socket.IO for real-time communication
  const io = new Server(server);
  
  // Middleware
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../../public')));
  
  // API Routes
  
  // Get list of projects
  app.get('/api/projects', async (req, res) => {
    try {
      const { getConfigValue } = await import('../core/config.js');
      const projectsDir = getConfigValue('outputDir', './protoforge-output');
      const projects = [];
      
      if (await fs.pathExists(projectsDir)) {
        const entries = await fs.readdir(projectsDir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const projectPath = path.join(projectsDir, entry.name);
            const configFile = path.join(projectPath, 'prototype.json');
            
            if (await fs.pathExists(configFile)) {
              const config = await fs.readJSON(configFile);
              projects.push({
                name: entry.name,
                path: projectPath,
                overview: config.overview,
                type: config.type,
                timestamp: (await fs.stat(projectPath)).mtime
              });
            }
          }
        }
      }
      
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get project details
  app.get('/api/project/:projectName', async (req, res) => {
    try {
      const { getConfigValue } = await import('../core/config.js');
      const outputDir = getConfigValue('outputDir', './protoforge-output');
      const projectPath = path.join(outputDir, req.params.projectName);

      if (!await fs.pathExists(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const configFile = path.join(projectPath, 'prototype.json');
      const config = await fs.readJSON(configFile);

      res.json({
        ...config,
        _meta: {
          name: req.params.projectName,
          outputDir,
          projectPath
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Generate new prototype via web
  app.post('/api/generate', async (req, res) => {
    const { description, type, provider } = req.body;
    
    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }
    
    try {
      // Import generator dynamically
      const { generatePrototype } = await import('../core/generator.js');
      const { getConfigValue, setConfigValue, setAIConfig } = await import('../core/config.js');

      // If the UI specifies a provider, store it for future runs.
      if (provider) {
        setAIConfig({ provider });
      }

      const result = await generatePrototype(description, {
        projectType: type || 'hybrid',
        outputDir: getConfigValue('outputDir', './protoforge-output')
      });
      
      // Emit socket event for real-time updates
      io.emit('generation-complete', result);
      
      res.json({ ...result, outputDir: result.projectDir });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get file tree for a project
  app.get('/api/project/:projectName/tree', async (req, res) => {
    try {
      const { getConfigValue } = await import('../core/config.js');
      const { normalizeRel, resolveInside } = await import('./fsSafe.js');
      const outputDir = getConfigValue('outputDir', './protoforge-output');
      const projectPath = path.join(outputDir, req.params.projectName);

      if (!await fs.pathExists(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Optional ?dir=subpath
      const relDir = normalizeRel(req.query.dir || '');
      const absDir = resolveInside(projectPath, relDir);

      const entries = await fs.readdir(absDir, { withFileTypes: true });
      const out = entries
        .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
        .map((e) => ({
          name: e.name,
          type: e.isDirectory() ? 'dir' : 'file'
        }))
        .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));

      res.json({
        base: relDir,
        entries: out
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Read a file from a project
  app.get('/api/project/:projectName/file', async (req, res) => {
    try {
      const { getConfigValue } = await import('../core/config.js');
      const { normalizeRel, resolveInside } = await import('./fsSafe.js');
      const outputDir = getConfigValue('outputDir', './protoforge-output');
      const projectPath = path.join(outputDir, req.params.projectName);

      if (!await fs.pathExists(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const rel = normalizeRel(req.query.path);
      if (!rel) return res.status(400).json({ error: 'path is required' });

      const abs = resolveInside(projectPath, rel);
      const stat = await fs.stat(abs);
      if (!stat.isFile()) return res.status(400).json({ error: 'Not a file' });

      // Basic size guard
      if (stat.size > 1024 * 1024) {
        return res.status(413).json({ error: 'File too large (>1MB)' });
      }

      const content = await fs.readFile(abs, 'utf-8');
      res.json({ path: rel, content });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Write (save) a file into a project (web editor)
  app.put('/api/project/:projectName/file', async (req, res) => {
    try {
      const { getConfigValue } = await import('../core/config.js');
      const { normalizeRel, resolveInside } = await import('./fsSafe.js');
      const outputDir = getConfigValue('outputDir', './protoforge-output');
      const projectPath = path.join(outputDir, req.params.projectName);

      if (!await fs.pathExists(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const rel = normalizeRel(req.body?.path);
      const content = req.body?.content;
      if (!rel) return res.status(400).json({ error: 'path is required' });
      if (typeof content !== 'string') return res.status(400).json({ error: 'content must be a string' });

      const abs = resolveInside(projectPath, rel);

      // Ensure directory exists
      await fs.ensureDir(path.dirname(abs));

      // Basic guard: block writing hidden files
      if (path.basename(abs).startsWith('.')) {
        return res.status(400).json({ error: 'Refusing to write hidden files' });
      }

      await fs.writeFile(abs, content, 'utf-8');
      res.json({ success: true, path: rel });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Download project as zip
  app.get('/api/project/:projectName/download', async (req, res) => {
    try {
      const { getConfigValue } = await import('../core/config.js');
      const projectPath = path.join(getConfigValue('outputDir', './protoforge-output'), req.params.projectName);
      
      if (!await fs.pathExists(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Import here to avoid circular dependency
      const { createProjectZip } = await import('../core/output.js');
      const zipPath = await createProjectZip(projectPath);
      
      res.download(zipPath, `${req.params.projectName}.zip`, (err) => {
        if (err) {
          console.error('Download error:', err);
        }
        // Clean up zip file after download
        fs.unlink(zipPath).catch(() => {});
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Serve the main HTML page
  app.get('/', (req, res) => {
    res.send(generateHTML());
  });
  
  // Start server
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(chalk.cyan('╔═══════════════════════════════════════════════════════════════════╗'));
      console.log(chalk.cyan('║') + chalk.white('         ProtoForge Web Interface') + chalk.cyan('                   ║'));
      console.log(chalk.cyan('║') + chalk.dim('   ANTI-AI-DESIGN: No Chat Bubbles | No Gradients | Terminal First') + chalk.cyan(' ║'));
      console.log(chalk.cyan('╚═══════════════════════════════════════════════════════════════════╝'));
      console.log();
      console.log(chalk.green('✓ Web interface running at: ') + chalk.cyan(`http://localhost:${port}`));
      console.log(chalk.dim('━'.repeat(70)));
      console.log();
      console.log(chalk.white('Press Ctrl+C to stop the server'));
      console.log();
      
      // Auto-open browser (configurable)
      import('../core/config.js').then(({ getConfigValue }) => {
        if (getConfigValue('autoOpenWeb', false)) {
          open(`http://localhost:${port}`).catch(() => {});
        }
      });
      
      resolve(server);
    });
  });
}

/**
 * Generate the main HTML page
 * ANTI-AI-DESIGN IMPLEMENTATION:
 * - Split panel layout (terminal multiplexer style)
 * - Visible grid lines and borders
 * - High contrast terminal colors
 * - Monospace fonts everywhere
 * - No rounded corners (0px border-radius)
 * - No gradients, no glow effects
 * - No floating elements
 * - Dense information display
 * - ASCII art header
 * - Terminal-style progress bars
 * @returns {string} HTML content
 */
function generateHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ProtoForge │ AI Prototype Builder</title>
  <style>
    /* ANTI-AI-DESIGN SYSTEM: Brutalist, Terminal-First, No Clichés */
    
    :root {
      /* Terminal palette - high contrast, no gradients */
      --bg-primary: #0a0a0a;
      --bg-secondary: #141414;
      --bg-tertiary: #1a1a1a;
      --border-color: #333333;
      --border-bright: #555555;
      --text-primary: #e0e0e0;
      --text-dim: #888888;
      --text-bright: #ffffff;
      --accent: #00ff88;  /* Not purple/blue - using terminal green */
      --accent-dim: #008855;
      --error: #ff4444;
      --warning: #ffaa00;
      --success: #00ff88;
      --panel-bg: #0d0d0d;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    /* NO ROUNDED CORNERS - Angular brutalism */
    body, html {
      border-radius: 0 !important;
      font-family: 'Courier New', Courier, monospace;  /* Monospace everywhere */
      background: var(--bg-primary);
      color: var(--text-primary);
      font-size: 13px;
      line-height: 1.4;
      overflow: hidden;  /* Terminal feel */
    }
    
    /* NO GRADIENTS - Flat colors only */
    .container {
      display: grid;
      grid-template-rows: auto 1fr;
      height: 100vh;
      width: 100vw;
    }
    
    /* HEADER: ASCII art, visible borders, no gradient */
    header {
      background: var(--bg-secondary);
      border-bottom: 2px solid var(--border-color);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .logo pre {
      font-size: 10px;
      line-height: 1;
      color: var(--accent);
      background: var(--bg-primary);
      padding: 8px;
      border: 1px solid var(--border-color);
    }
    
    .header-actions {
      display: flex;
      gap: 8px;
    }
    
    /* NO ROUNDED BUTTONS - Angular, border-only style */
    button, .btn {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      padding: 6px 12px;
      border: 1px solid var(--border-bright);
      background: var(--bg-tertiary);
      color: var(--text-primary);
      cursor: pointer;
      border-radius: 0 !important;
      transition: none;  /* No animations */
    }
    
    button:hover, .btn:hover {
      background: var(--accent);
      color: var(--bg-primary);
      border-color: var(--accent);
    }
    
    button:active {
      background: var(--accent-dim);
    }
    
    /* MAIN SPLIT PANEL LAYOUT - Terminal multiplexer style */
    .main-content {
      display: grid;
      grid-template-columns: 380px 1fr;
      height: calc(100vh - 100px);
      overflow: hidden;
    }
    
    /* LEFT PANEL - Command input (NO chat bubbles) */
    .command-panel {
      border-right: 2px solid var(--border-color);
      display: grid;
      grid-template-rows: auto 1fr auto;
      background: var(--panel-bg);
    }
    
    .panel-header {
      padding: 10px 12px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-dim);
    }
    
    /* NO CHAT BUBBLES - Terminal-style message list */
    .message-list {
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .message {
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      padding: 10px;
    }
    
    .message-user {
      border-left: 3px solid var(--text-dim);
    }
    
    .message-ai {
      border-left: 3px solid var(--accent);
    }
    
    .message-label {
      font-size: 10px;
      color: var(--text-dim);
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    
    .message-content {
      font-size: 12px;
      line-height: 1.5;
    }
    
    .message-content ul {
      margin-left: 16px;
      margin-top: 8px;
    }
    
    .message-content li {
      margin-bottom: 4px;
    }
    
    /* Command input - NO floating input, embedded in panel */
    .command-input-section {
      border-top: 2px solid var(--border-color);
      padding: 12px;
      background: var(--bg-secondary);
    }
    
    .input-prompt {
      color: var(--accent);
      margin-bottom: 8px;
      font-size: 11px;
    }
    
    .command-input {
      width: 100%;
      padding: 10px;
      border: 1px solid var(--border-color);
      background: var(--bg-primary);
      color: var(--text-bright);
      font-family: 'Courier New', monospace;
      font-size: 12px;
      border-radius: 0 !important;
    }
    
    .command-input:focus {
      outline: none;
      border-color: var(--accent);
    }
    
    /* RIGHT PANEL - File browser and code viewer */
    .output-panel {
      display: grid;
      grid-template-rows: auto 1fr;
      background: var(--panel-bg);
    }
    
    /* TABS - Angular, no rounded corners, visible borders */
    .tabs {
      display: flex;
      border-bottom: 2px solid var(--border-color);
      background: var(--bg-secondary);
    }
    
    .tab {
      padding: 10px 16px;
      border-right: 1px solid var(--border-color);
      cursor: pointer;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: var(--bg-secondary);
      color: var(--text-dim);
      border-radius: 0 !important;
    }
    
    .tab:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }
    
    .tab.active {
      background: var(--bg-primary);
      color: var(--accent);
      border-bottom: 2px solid var(--accent);
      margin-bottom: -2px;
    }
    
    /* NO ROUNDED CORNERS ON PANELS */
    .tab-content {
      display: none;
      padding: 12px;
      overflow: auto;
      border-radius: 0 !important;
    }
    
    .tab-content.active {
      display: block;
    }
    
    /* FILE BROWSER - Terminal style tree */
    .file-browser {
      font-family: 'Courier New', monospace;
    }
    
    .file-tree {
      padding: 8px;
      border: 1px solid var(--border-color);
      background: var(--bg-primary);
    }
    
    .file-tree-item {
      padding: 4px 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .file-tree-item:hover {
      background: var(--bg-tertiary);
    }
    
    .file-tree-item.selected {
      background: var(--accent-dim);
      color: var(--text-bright);
    }
    
    .file-icon {
      width: 16px;
      text-align: center;
    }
    
    /* CODE VIEW - No syntax highlighting animations, just raw text */
    .code-view {
      border: 1px solid var(--border-color);
      background: var(--bg-primary);
      padding: 12px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      white-space: pre-wrap;
      overflow: auto;
      height: 100%;
    }
    
    .code-line-number {
      color: var(--text-dim);
      display: inline-block;
      width: 40px;
      text-align: right;
      margin-right: 16px;
      user-select: none;
    }
    
    /* MERMAID DIAGRAM - Visible border */
    .mermaid-container {
      border: 1px solid var(--border-color);
      background: var(--bg-primary);
      padding: 16px;
    }
    
    /* BOM TABLE - Angular, visible grid lines */
    .bom-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid var(--border-color);
      font-family: 'Courier New', monospace;
      font-size: 12px;
    }
    
    .bom-table th,
    .bom-table td {
      border: 1px solid var(--border-color);
      padding: 8px 12px;
      text-align: left;
    }
    
    .bom-table th {
      background: var(--bg-secondary);
      color: var(--accent);
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    
    /* BUILD GUIDE - Simple list, no cards */
    .build-steps {
      counter-reset: step;
    }
    
    .build-step {
      display: flex;
      gap: 16px;
      padding: 12px;
      border: 1px solid var(--border-color);
      margin-bottom: 8px;
      background: var(--bg-secondary);
    }
    
    .step-number {
      font-size: 14px;
      font-weight: bold;
      color: var(--accent);
      min-width: 30px;
    }
    
    /* STATUS BAR - Terminal style at bottom */
    .status-bar {
      border-top: 2px solid var(--border-color);
      padding: 8px 16px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      background: var(--bg-secondary);
      color: var(--text-dim);
    }
    
    .status-item {
      display: flex;
      gap: 8px;
    }
    
    .status-label {
      color: var(--text-dim);
    }
    
    .status-value {
      color: var(--accent);
    }
    
    /* PROGRESS BAR - Terminal style, no animations */
    .progress-container {
      margin: 12px 0;
    }
    
    .progress-bar {
      height: 16px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      position: relative;
    }
    
    .progress-fill {
      height: 100%;
      background: var(--accent);
      width: 0%;
      transition: none;  /* No animations */
    }
    
    .progress-text {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 10px;
      color: var(--bg-primary);
    }
    
    /* QUICK ACTIONS - Grid, no floating */
    .quick-actions {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-top: 12px;
    }
    
    .quick-action {
      padding: 8px;
      border: 1px solid var(--border-color);
      background: var(--bg-tertiary);
      font-size: 11px;
      text-align: center;
      cursor: pointer;
      border-radius: 0 !important;
    }
    
    .quick-action:hover {
      background: var(--accent);
      color: var(--bg-primary);
    }
    
    /* SCROLLBARS - Angular, visible */
    ::-webkit-scrollbar {
      width: 12px;
      height: 12px;
    }
    
    ::-webkit-scrollbar-track {
      background: var(--bg-primary);
      border-left: 1px solid var(--border-color);
    }
    
    ::-webkit-scrollbar-thumb {
      background: var(--border-bright);
      border: 1px solid var(--bg-primary);
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: var(--accent-dim);
    }
    
    /* NO FLOATING ELEMENTS - Everything is anchored */
    
    /* HELP PANEL - Modal without rounded corners */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.8);
      z-index: 1000;
    }
    
    .modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--bg-secondary);
      border: 2px solid var(--accent);
      padding: 24px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow: auto;
      border-radius: 0 !important;
    }
    
    .modal h2 {
      color: var(--accent);
      margin-bottom: 16px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .keyboard-shortcut {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid var(--border-color);
    }
    
    .key {
      background: var(--bg-primary);
      padding: 2px 8px;
      border: 1px solid var(--border-color);
      font-size: 11px;
    }
    
    /* LINKS - Underlined, not blue */
    a {
      color: var(--accent);
      text-decoration: underline;
    }
    
    a:hover {
      background: var(--accent);
      color: var(--bg-primary);
      text-decoration: none;
    }
    
    /* SELECT - Native styling, no custom dropdowns */
    select {
      font-family: 'Courier New', monospace;
      padding: 6px 12px;
      border: 1px solid var(--border-color);
      background: var(--bg-tertiary);
      color: var(--text-primary);
      font-size: 12px;
      border-radius: 0 !important;
      cursor: pointer;
    }
    
    select:focus {
      outline: none;
      border-color: var(--accent);
    }
    
    /* LOADING - Terminal spinner, no fancy animations */
    .loading {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid var(--border-color);
      border-top-color: var(--accent);
      animation: none;  /* No animations */
    }
    
    /* Hide Mermaid default styling overrides */
    .mermaid {
      display: none;
    }
    
    .mermaid-render {
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- HEADER: ASCII art logo, visible borders -->
    <header>
      <div class="logo">
        <pre>
╔════════════════════╗
║ PROTOFORGE v1.0.0  ║
╚════════════════════╝
        </pre>
        <div>
          <div style="color: var(--accent); font-weight: bold;">AI PROTOTYPE BUILDER</div>
          <div style="color: var(--text-dim); font-size: 11px;">NO CHAT BUBBLES │ NO GRADIENTS │ TERMINAL FIRST</div>
        </div>
      </div>
      <div class="header-actions">
        <select id="aiProvider">
          <option value="ollama">Model: Ollama (llama3.1)</option>
          <option value="openai">Model: OpenAI (GPT-4)</option>
          <option value="groq">Model: Groq (Llama 3.1)</option>
          <option value="anthropic">Model: Claude (Sonnet)</option>
        </select>
        <button onclick="showHelp()">[ ? HELP ]</button>
        <button onclick="exportZip()">[ EXPORT ZIP ]</button>
        <button onclick="newProject()">[ NEW PROJECT ]</button>
      </div>
    </header>
    
    <!-- MAIN SPLIT PANEL: Terminal multiplexer style -->
    <div class="main-content">
      <!-- LEFT PANEL: Command input and messages (NO chat bubbles) -->
      <div class="command-panel">
        <div class="panel-header">
          ┌─ COMMAND INTERFACE
        </div>
        
        <div class="message-list" id="messageList">
          <div class="message message-ai">
            <div class="message-label">System</div>
            <div class="message-content">
              ProtoForge Ready. Describe your prototype idea below.
              <ul>
                <li>Hardware: IoT devices, embedded systems, sensors</li>
                <li>Software: Web apps, APIs, mobile applications</li>
                <li>Hybrid: Combined hardware + software projects</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div class="command-input-section">
          <div class="input-prompt">> Enter your prototype description:</div>
          <textarea 
            id="description" 
            class="command-input" 
            rows="3"
            placeholder="e.g., A smart plant monitor with moisture sensor that sends alerts to my phone..."
          ></textarea>
          <div style="margin-top: 8px; display: flex; gap: 8px; align-items: center;">
            <select id="projectType" style="flex: 0 0 150px;">
              <option value="hybrid">Type: HYBRID</option>
              <option value="hardware">Type: HARDWARE</option>
              <option value="software">Type: SOFTWARE</option>
            </select>
            <button onclick="generatePrototype()" style="flex: 1;">[ EXECUTE ]</button>
          </div>
          
          <!-- Progress bar (terminal style) -->
          <div class="progress-container" id="progressContainer" style="display: none;">
            <div class="progress-bar">
              <div class="progress-fill" id="progressFill"></div>
              <span class="progress-text" id="progressText">0%</span>
            </div>
          </div>
          
          <!-- Quick actions grid -->
          <div class="quick-actions">
            <div class="quick-action" onclick="improvePrompt()">IMPROVE PROMPT</div>
            <div class="quick-action" onclick="addFeature()">ADD FEATURE</div>
            <div class="quick-action" onclick="explainCode()">EXPLAIN CODE</div>
            <div class="quick-action" onclick="debugCode()">DEBUG CODE</div>
          </div>
        </div>
      </div>
      
      <!-- RIGHT PANEL: File browser and code viewer -->
      <div class="output-panel">
        <!-- TABS: Angular, visible borders -->
        <div class="tabs">
          <div class="tab active" data-tab="files" onclick="switchTab('files')">FILES</div>
          <div class="tab" data-tab="code" onclick="switchTab('code')">CODE</div>
          <div class="tab" data-tab="schematic" onclick="switchTab('schematic')">SCHEMATIC</div>
          <div class="tab" data-tab="bom" onclick="switchTab('bom')">BOM</div>
          <div class="tab" data-tab="models" onclick="switchTab('models')">3D MODELS</div>
          <div class="tab" data-tab="guide" onclick="switchTab('guide')">BUILD GUIDE</div>
        </div>
        
        <!-- TAB CONTENT: No cards, simple bordered containers -->
        <div class="tab-content active" id="tab-files">
          <div class="file-browser">
            <div class="file-tree" id="fileTree">
              <div class="file-tree-item" style="color: var(--text-dim);">
                <span class="file-icon">─</span>
                <span>No project loaded</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="tab-content" id="tab-code">
          <div style="display:flex; gap:8px; margin-bottom:8px;">
            <div style="color: var(--text-dim); flex: 1;">Editing: <span id="currentFile" style="color: var(--accent);">(none)</span></div>
            <button onclick="saveCurrentFile()">[ SAVE ]</button>
          </div>
          <textarea id="codeEditor" class="command-input" style="height: 60vh; white-space: pre;" spellcheck="false" placeholder="Select a file from FILES to open it here."></textarea>
          <div class="code-view" id="codeView" style="margin-top:8px; height:auto; max-height: 20vh;">
            <span style="color: var(--text-dim);">// Preview (read-only)</span>
          </div>
        </div>
        
        <div class="tab-content" id="tab-schematic">
          <div class="mermaid-container" id="mermaidContainer">
            <div style="color: var(--text-dim);">No schematic generated yet. Run a generation to see diagrams.</div>
          </div>
        </div>
        
        <div class="tab-content" id="tab-bom">
          <div id="bomContent">
            <div style="color: var(--text-dim);">No Bill of Materials generated yet.</div>
          </div>
        </div>
        
        <div class="tab-content" id="tab-models">
          <div id="modelsContent">
            <div style="color: var(--text-dim);">3D Preview renders a generated <code>schematics/3d-preview.html</code> (if present) inside this panel.</div>
            <div style="margin-top:12px; border:1px solid var(--border-color);">
              <iframe id="threePreview" style="width:100%; height:55vh; border:0; background: var(--bg-primary);"></iframe>
            </div>
          </div>
        </div>

        <div class="tab-content" id="tab-guide">
          <div id="guideContent">
            <div style="color: var(--text-dim);">No build guide generated yet.</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- STATUS BAR: Terminal style at bottom -->
    <div class="status-bar">
      <div class="status-item">
        <span class="status-label">Provider:</span>
        <span class="status-value" id="statusProvider">Ollama</span>
      </div>
      <div class="status-item">
        <span class="status-label">Status:</span>
        <span class="status-value" id="statusState">READY</span>
      </div>
      <div class="status-item">
        <span class="status-label">Output:</span>
        <span class="status-value">./protoforge-output/</span>
      </div>
    </div>
  </div>
  
  <!-- HELP MODAL -->
  <div class="modal-overlay" id="helpModal" onclick="hideHelp(event)">
    <div class="modal">
      <h2>Keyboard Shortcuts</h2>
      <div class="keyboard-shortcut">
        <span>New Project</span>
        <span><span class="key">CTRL+N</span></span>
      </div>
      <div class="keyboard-shortcut">
        <span>Execute</span>
        <span><span class="key">CTRL+ENTER</span></span>
      </div>
      <div class="keyboard-shortcut">
        <span>Switch Tabs</span>
        <span><span class="key">1-5</span></span>
      </div>
      <div class="keyboard-shortcut">
        <span>Export ZIP</span>
        <span><span class="key">CTRL+E</span></span>
      </div>
      <div class="keyboard-shortcut">
        <span>Save File</span>
        <span><span class="key">CTRL+S</span></span>
      </div>
      <div class="keyboard-shortcut">
        <span>Help</span>
        <span><span class="key">?</span></span>
      </div>
      <h2 style="margin-top: 20px;">Anti-AI-Design Philosophy</h2>
      <p style="margin-top: 12px; line-height: 1.6; color: var(--text-dim);">
        ProtoForge rejects the typical AI interface clichés: no chat bubbles, no gradients,
        no floating buttons, no rounded corners. This interface is built for efficiency,
        inspired by terminal multiplexers and brutalist design principles.
      </p>
      <button onclick="hideHelp()" style="margin-top: 20px; width: 100%;">[ CLOSE ]</button>
    </div>
  </div>
  
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({ 
      startOnLoad: true, 
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        background: '#0a0a0a',
        primaryColor: '#00ff88',
        lineColor: '#555555'
      }
    });
    
    let currentProjectPath = null;
    let projectFiles = [];
    let currentPrototype = null;
    
    async function render3DPreview() {
      try {
        if (!currentProjectPath) return;
        const projectName = currentProjectPath.split('/').pop();
        // best-effort: load schematics/3d-preview.html
        const r = await fetch('/api/project/' + projectName + '/file?path=' + encodeURIComponent('schematics/3d-preview.html'));
        const data = await r.json();
        const iframe = document.getElementById('threePreview');
        if (!iframe) return;
        if (data && !data.error && data.content) {
          iframe.srcdoc = data.content;
        } else {
          iframe.srcdoc = '<!doctype html><html><body style="background:#0a0a0a;color:#888;font-family:monospace;">No 3D preview generated. Ask for <b>threeDHtml</b> output or regenerate.</body></html>';
        }
      } catch {
        // ignore
      }
    }

    
    // Generate prototype
    async function generatePrototype() {
      const description = document.getElementById('description').value;
      const type = document.getElementById('projectType').value;
      const provider = document.getElementById('aiProvider').value;
      
      if (!description.trim()) {
        alert('Please enter a prototype description');
        return;
      }
      
      // Add user message (NO chat bubble - terminal style)
      addMessage('user', '> ' + description);
      
      // Show progress
      document.getElementById('progressContainer').style.display = 'block';
      updateProgress(10, 'Initializing AI architect...');
      document.getElementById('statusState').textContent = 'PROCESSING';
      
      try {
        updateProgress(30, 'Connecting to ' + provider + '...');
        
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description, type, provider })
        });
        
        updateProgress(60, 'Generating prototype...');
        
        const data = await response.json();
        
        if (data.success) {
          updateProgress(90, 'Writing files...');
          currentProjectPath = data.outputDir;
          currentPrototype = data.prototype;
          addMessage('ai', formatAIResponse(data.prototype));

          // Prefer real file tree from disk.
          const projectName = currentProjectPath.split('/').pop();
          await updateFileBrowserFromDisk(projectName);
          updateProgress(100, 'Complete');
          document.getElementById('statusState').textContent = 'READY';
          
          // Switch to files tab
          switchTab('files');
          await render3DPreview();
        } else {
          throw new Error(data.error || 'Generation failed');
        }
      } catch (error) {
        addMessage('ai', 'ERROR: ' + error.message);
        document.getElementById('statusState').textContent = 'ERROR';
      }
      
      setTimeout(() => {
        document.getElementById('progressContainer').style.display = 'none';
        updateProgress(0, '');
      }, 2000);
    }
    
    // Add message to list (NO chat bubble style)
    function addMessage(role, content) {
      const messageList = document.getElementById('messageList');
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message message-' + role;
      messageDiv.innerHTML = '<div class="message-label">' + (role === 'user' ? 'You' : 'ProtoForge') + '</div>' +
                            '<div class="message-content">' + content + '</div>';
      messageList.appendChild(messageDiv);
      messageList.scrollTop = messageList.scrollHeight;
    }
    
    // Format AI response
    function formatAIResponse(prototype) {
      let html = '<strong>' + (prototype.overview?.projectName || 'Untitled Project') + '</strong>';
      html += '<br><br>';
      html += prototype.overview?.description || '';
      html += '<br><br>';
      html += '<strong>Project Type:</strong> ' + (prototype.type || 'hybrid').toUpperCase();
      html += '<br><br>';
      html += '<strong>Files Created:</strong>';
      html += '<ul>';
      if (prototype.codeSnippets) {
        prototype.codeSnippets.forEach(snippet => {
          html += '<li>' + snippet.filename + '</li>';
        });
      }
      html += '</ul>';
      return html;
    }
    
    // Update progress bar (terminal style)
    function updateProgress(percent, text) {
      document.getElementById('progressFill').style.width = percent + '%';
      document.getElementById('progressText').textContent = percent + '% ' + text;
    }
    
    // Update file browser using real filesystem tree
    async function updateFileBrowserFromDisk(projectName) {
      const fileTree = document.getElementById('fileTree');
      fileTree.innerHTML = '<div class="file-tree-item" style="color: var(--text-dim);"><span class="file-icon">…</span><span>Loading tree…</span></div>';

      async function renderDir(relDir, indent) {
        const r = await fetch('/api/project/' + projectName + '/tree?dir=' + encodeURIComponent(relDir || ''));
        const data = await r.json();
        const entries = data.entries || [];

        let html = '';
        for (const entry of entries) {
          const relPath = (relDir ? relDir + '/' : '') + entry.name;
          if (entry.type === 'dir') {
            html += '<div class="file-tree-item" onclick="toggleDir(\'' + escapeAttr(relPath) + '\')">' +
              '<span class="file-icon">📁</span>' +
              '<span>' + escapeHtml(entry.name) + '/</span>' +
              '</div>';
            html += '<div id="dir-' + escapeAttr(relPath) + '" style="display:none; padding-left: 16px;"></div>';
          } else {
            html += '<div class="file-tree-item" onclick="openFile(\'' + escapeAttr(relPath) + '\')">' +
              '<span class="file-icon">📄</span>' +
              '<span>' + escapeHtml(entry.name) + '</span>' +
              '</div>';
          }
        }
        return html;
      }

      // root
      const rootHtml = await renderDir('', 0);
      fileTree.innerHTML = rootHtml || '<div class="file-tree-item" style="color: var(--text-dim);"><span class="file-icon">─</span><span>No files</span></div>';
    }
    
    // View file code
    async function openFile(relPath) {
      if (!currentProjectPath) return;
      const projectName = currentProjectPath.split('/').pop();
      const r = await fetch('/api/project/' + projectName + '/file?path=' + encodeURIComponent(relPath));
      const data = await r.json();
      if (data.error) {
        addMessage('ai', 'ERROR: ' + data.error);
        return;
      }

      // update editor state
      window.__protoforgeCurrentFile = relPath;
      document.getElementById('currentFile').textContent = relPath;
      document.getElementById('codeEditor').value = String(data.content || '');

      // preview with line numbers
      const codeView = document.getElementById('codeView');
      const lines = String(data.content || '').split('\\n');
      let html = '';
      lines.forEach((line, i) => {
        html += '<span class="code-line-number">' + (i + 1) + '</span>' + escapeHtml(line) + '<br>';
      });
      codeView.innerHTML = html;
    }

    async function toggleDir(relDir) {
      const el = document.getElementById('dir-' + relDir);
      if (!el) return;
      const isOpen = el.style.display !== 'none';
      if (isOpen) {
        el.style.display = 'none';
        return;
      }
      if (!currentProjectPath) return;
      const projectName = currentProjectPath.split('/').pop();

      const r = await fetch('/api/project/' + projectName + '/tree?dir=' + encodeURIComponent(relDir));
      const data = await r.json();
      const entries = data.entries || [];

      let html = '';
      for (const entry of entries) {
        const relPath = relDir + '/' + entry.name;
        if (entry.type === 'dir') {
          html += '<div class="file-tree-item" onclick="toggleDir(\'' + escapeAttr(relPath) + '\')">' +
            '<span class="file-icon">📁</span><span>' + escapeHtml(entry.name) + '/</span></div>' +
            '<div id="dir-' + escapeAttr(relPath) + '" style="display:none; padding-left: 16px;"></div>';
        } else {
          html += '<div class="file-tree-item" onclick="openFile(\'' + escapeAttr(relPath) + '\')">' +
            '<span class="file-icon">📄</span><span>' + escapeHtml(entry.name) + '</span></div>';
        }
      }
      el.innerHTML = html;
      el.style.display = 'block';
    }
    
    // View schematic (Mermaid)
    function viewSchematic() {
      switchTab('schematic');
      const s = currentPrototype?.schematic;
      const mermaidText =
        typeof s === 'string' ? s : (s && (s.mermaid || s.diagram)) || currentPrototype?.diagram?.mermaid;

      if (mermaidText) {
        const container = document.getElementById('mermaidContainer');
        container.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'mermaid-render';
        div.textContent = mermaidText;
        container.appendChild(div);
        mermaid.run({ querySelector: '.mermaid-render' });
      } else {
        document.getElementById('mermaidContainer').innerHTML =
          '<div style="color: var(--text-dim);">No schematic generated yet.</div>';
      }
    }
    
    // View BOM
    function viewBOM() {
      switchTab('bom');
      if (currentPrototype?.bom && currentPrototype.bom.length > 0) {
        let html = '<table class="bom-table"><thead><tr>';
        html += '<th>Item</th><th>Part Number</th><th>Description</th>';
        html += '<th>Qty</th><th>Price</th><th>Link</th>';
        html += '</tr></thead><tbody>';
        
        currentPrototype.bom.forEach((item, index) => {
          html += '<tr>';
          html += '<td>' + (index + 1) + '</td>';
          html += '<td>' + (item.partNumber || '-') + '</td>';
          html += '<td>' + (item.description || '-') + '</td>';
          html += '<td>' + (item.quantity || 1) + '</td>';
          html += '<td>' + (item.unitPrice || '-') + '</td>';
          html += '<td>' + (item.link ? '<a href="' + item.link + '" target="_blank">Link</a>' : '-') + '</td>';
          html += '</tr>';
        });
        
        html += '</tbody></table>';
        document.getElementById('bomContent').innerHTML = html;
      }
    }
    
    // View build guide
    function viewReport() {
      switchTab('guide');
      if (currentPrototype?.buildGuide) {
        document.getElementById('guideContent').innerHTML = 
          '<pre style="white-space: pre-wrap;">' + escapeHtml(currentPrototype.buildGuide) + '</pre>';
      }
    }
    
    // Switch tabs
    function switchTab(tabName) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');
      document.getElementById('tab-' + tabName).classList.add('active');
      if (tabName === 'models') {
        render3DPreview();
      }
    }
    
    async function saveCurrentFile() {
      if (!currentProjectPath || !window.__protoforgeCurrentFile) {
        addMessage('ai', 'ERROR: No file selected');
        return;
      }
      const projectName = currentProjectPath.split('/').pop();
      const pathRel = window.__protoforgeCurrentFile;
      const content = document.getElementById('codeEditor').value;

      const r = await fetch('/api/project/' + projectName + '/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathRel, content })
      });
      const data = await r.json();
      if (data.error) {
        addMessage('ai', 'ERROR: ' + data.error);
        return;
      }
      addMessage('ai', 'Saved: ' + pathRel);
      // refresh preview
      await openFile(pathRel);
    }

    // Export ZIP
    function exportZip() {
      if (currentProjectPath) {
        const projectName = currentProjectPath.split('/').pop();
        window.location.href = '/api/project/' + projectName + '/download';
      } else {
        alert('No project to export');
      }
    }
    
    // New project
    function newProject() {
      document.getElementById('description').value = '';
      document.getElementById('messageList').innerHTML = '<div class="message message-ai"><div class="message-label">System</div><div class="message-content">Ready for new project. Enter your description above.</div></div>';
      document.getElementById('fileTree').innerHTML = '<div class="file-tree-item" style="color: var(--text-dim);"><span class="file-icon">─</span><span>No project loaded</span></div>';
      document.getElementById('codeView').innerHTML = '<span style="color: var(--text-dim);">// Select a file from the FILES tab to view code</span>';
      currentProjectPath = null;
      currentPrototype = null;
      projectFiles = [];
    }
    
    // Quick actions
    function improvePrompt() {
      const desc = document.getElementById('description').value;
      if (desc) {
        document.getElementById('description').value = 'Improve this prompt: ' + desc + ' Make it more specific and detailed for better results.';
      }
    }
    
    function addFeature() {
      document.getElementById('description').value = 'Add feature: [Describe new feature to add to existing project]';
    }
    
    function explainCode() {
      addMessage('user', 'Explain the generated code');
    }
    
    function debugCode() {
      addMessage('user', 'Debug: [Describe the issue you are experiencing]');
    }
    
    // Help modal
    function showHelp() {
      document.getElementById('helpModal').style.display = 'block';
    }
    
    function hideHelp(event) {
      if (!event || event.target === document.getElementById('helpModal')) {
        document.getElementById('helpModal').style.display = 'none';
      }
    }
    
    // Escape HTML
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function escapeAttr(text) {
      return String(text || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        newProject();
      } else if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        exportZip();
      } else if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        generatePrototype();
      } else if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        saveCurrentFile();
      } else if (e.key === '?') {
        showHelp();
      }
    });

    // (Future) load recent projects list
  </script>
</body>
</html>`;
}

export default {
  startWebServer
};
