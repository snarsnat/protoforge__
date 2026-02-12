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
      console.log(chalk.cyan('┌────────────────────────────────────────────┐'));
      console.log(chalk.cyan('│') + chalk.white('      ProtoForge Web Interface') + chalk.cyan('            │'));
      console.log(chalk.cyan('│') + chalk.dim('  Modern. Clean. Simple.') + chalk.cyan('                  │'));
      console.log(chalk.cyan('└────────────────────────────────────────────┘'));
      console.log();
      console.log(chalk.green('✓ Web interface running at: ') + chalk.cyan(`http://localhost:${port}`));
      console.log();
      console.log(chalk.dim('Press Ctrl+C to stop the server'));
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
 * MINIMALIST DESIGN: Clean, modern chat interface
 * @returns {string} HTML content
 */
function generateHTML() {
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
/**
 * Generate the main HTML page
 * MINIMALIST DESIGN: Clean, modern chat interface
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
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body, html {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f7;
      color: #1d1d1f;
      font-size: 14px;
      line-height: 1.5;
      height: 100vh;
      overflow: hidden;
    }
    
    .container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      max-width: 1400px;
      margin: 0 auto;
      background: #fff;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    
    /* Header */
    header {
      padding: 16px 24px;
      background: #fff;
      border-bottom: 1px solid #e5e5e7;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .logo h1 {
      font-size: 20px;
      font-weight: 600;
      color: #1d1d1f;
    }
    
    .logo span {
      color: #86868b;
      font-size: 13px;
    }
    
    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    
    select {
      padding: 8px 12px;
      border: 1px solid #d2d2d7;
      border-radius: 8px;
      font-size: 13px;
      background: #fff;
      cursor: pointer;
      outline: none;
    }
    
    select:focus {
      border-color: #0071e3;
    }
    
    button {
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .btn-primary {
      background: #0071e3;
      color: #fff;
    }
    
    .btn-primary:hover {
      background: #0077ed;
    }
    
    .btn-secondary {
      background: #f5f5f7;
      color: #1d1d1f;
    }
    
    .btn-secondary:hover {
      background: #e8e8ed;
    }
    
    /* Main content */
    .main-content {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    
    /* Left panel - Chat */
    .chat-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 400px;
    }
    
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .message {
      display: flex;
      gap: 12px;
      max-width: 85%;
    }
    
    .message.user {
      align-self: flex-end;
      flex-direction: row-reverse;
    }
    
    .message-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 600;
      flex-shrink: 0;
    }
    
    .message.user .message-avatar {
      background: #0071e3;
      color: #fff;
    }
    
    .message.assistant .message-avatar {
      background: #34c759;
      color: #fff;
    }
    
    .message-bubble {
      padding: 12px 16px;
      border-radius: 18px;
      font-size: 14px;
      line-height: 1.5;
    }
    
    .message.user .message-bubble {
      background: #0071e3;
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    
    .message.assistant .message-bubble {
      background: #f5f5f7;
      color: #1d1d1f;
      border-bottom-left-radius: 4px;
    }
    
    .message-bubble ul {
      margin: 8px 0 0 16px;
    }
    
    .message-bubble li {
      margin-bottom: 4px;
    }
    
    /* Chat input area */
    .chat-input-area {
      padding: 20px 24px;
      background: #fff;
      border-top: 1px solid #e5e5e7;
    }
    
    .chat-input-wrapper {
      display: flex;
      gap: 12px;
      align-items: flex-end;
    }
    
    .chat-input {
      flex: 1;
      padding: 14px 18px;
      border: 1px solid #d2d2d7;
      border-radius: 24px;
      font-size: 14px;
      resize: none;
      outline: none;
      font-family: inherit;
      max-height: 120px;
    }
    
    .chat-input:focus {
      border-color: #0071e3;
    }
    
    .chat-send-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #0071e3;
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    
    .chat-send-btn:hover {
      background: #0077ed;
      transform: scale(1.05);
    }
    
    .chat-send-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
      transform: none;
    }
    
    .input-options {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    
    .input-options select {
      padding: 6px 10px;
      font-size: 12px;
    }
    
    /* Progress bar */
    .progress-container {
      padding: 0 24px 16px;
      display: none;
    }
    
    .progress-container.active {
      display: block;
    }
    
    .progress-bar {
      height: 6px;
      background: #e5e5e7;
      border-radius: 3px;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #0071e3, #34c759);
      border-radius: 3px;
      transition: width 0.3s ease;
    }
    
    .progress-text {
      font-size: 12px;
      color: #86868b;
      margin-top: 6px;
      text-align: center;
    }
    
    /* Right panel - Output */
    .output-panel {
      width: 400px;
      background: #fafafa;
      border-left: 1px solid #e5e5e7;
      display: flex;
      flex-direction: column;
    }
    
    .output-tabs {
      display: flex;
      border-bottom: 1px solid #e5e5e7;
      background: #fff;
    }
    
    .output-tab {
      padding: 14px 20px;
      font-size: 13px;
      font-weight: 500;
      color: #86868b;
      border: none;
      background: none;
      cursor: pointer;
      position: relative;
      transition: color 0.2s ease;
    }
    
    .output-tab:hover {
      color: #1d1d1f;
    }
    
    .output-tab.active {
      color: #0071e3;
    }
    
    .output-tab.active::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: #0071e3;
    }
    
    .output-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }
    
    .tab-panel {
      display: none;
    }
    
    .tab-panel.active {
      display: block;
    }
    
    /* File tree */
    .file-tree {
      font-size: 13px;
    }
    
    .file-tree-item {
      padding: 8px 12px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    
    .file-tree-item:hover {
      background: #f0f0f0;
    }
    
    .file-tree-item.selected {
      background: #e8f2ff;
      color: #0071e3;
    }
    
    .file-tree-item.folder {
      font-weight: 500;
    }
    
    /* Code section */
    .code-section {
      margin-bottom: 16px;
      background: #fff;
      border-radius: 12px;
      padding: 16px;
      border: 1px solid #e5e5e7;
    }
    
    .code-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .code-filename {
      font-size: 12px;
      color: #86868b;
      font-weight: 500;
    }
    
    .code-content {
      background: #f5f5f7;
      border-radius: 8px;
      padding: 12px;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      font-size: 12px;
      white-space: pre-wrap;
      max-height: 200px;
      overflow-y: auto;
    }
    
    /* Status bar */
    .status-bar {
      padding: 10px 24px;
      background: #fff;
      border-top: 1px solid #e5e5e7;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #86868b;
    }
    
    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
    }
    
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    
    ::-webkit-scrollbar-thumb {
      background: #d2d2d7;
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: #c7c7cc;
    }
    
    /* Welcome message */
    .welcome-message {
      text-align: center;
      padding: 40px 20px;
      color: #86868b;
    }
    
    .welcome-message h2 {
      font-size: 18px;
      color: #1d1d1f;
      margin-bottom: 12px;
    }
    
    .welcome-suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      margin-top: 20px;
    }
    
    .suggestion-chip {
      padding: 8px 16px;
      background: #f5f5f7;
      border-radius: 20px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .suggestion-chip:hover {
      background: #e8e8ed;
    }
    
    /* Loading animation */
    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 12px 16px;
    }
    
    .typing-dot {
      width: 8px;
      height: 8px;
      background: #999;
      border-radius: 50%;
      animation: typing 1.4s infinite ease-in-out;
    }
    
    .typing-dot:nth-child(2) {
      animation-delay: 0.2s;
    }
    
    .typing-dot:nth-child(3) {
      animation-delay: 0.4s;
    }
    
    @keyframes typing {
      0%, 60%, 100% {
        transform: translateY(0);
      }
      30% {
        transform: translateY(-8px);
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header>
      <div class="logo">
        <h1>ProtoForge</h1>
        <span>AI Prototype Builder</span>
      </div>
      <div class="header-actions">
        <select id="aiProvider">
          <option value="ollama">Ollama (llama3.1)</option>
          <option value="openai">OpenAI (GPT-4)</option>
          <option value="groq">Groq (Llama 3.1)</option>
          <option value="anthropic">Claude (Sonnet)</option>
        </select>
        <button class="btn-secondary" onclick="newProject()">New Project</button>
        <button class="btn-secondary" onclick="exportZip()">Export ZIP</button>
      </div>
    </header>
    
    <!-- Main Content -->
    <div class="main-content">
      <!-- Left Panel - Chat -->
      <div class="chat-panel">
        <div class="chat-messages" id="chatMessages">
          <div class="welcome-message" id="welcomeMessage">
            <h2>What would you like to build?</h2>
            <p>Describe your prototype idea and I'll generate everything you need.</p>
            <div class="welcome-suggestions">
              <div class="suggestion-chip" onclick="setPrompt('A smart plant monitor with moisture sensor')">Smart plant monitor</div>
              <div class="suggestion-chip" onclick="setPrompt('Weather station with ESP32 and display')">Weather station</div>
              <div class="suggestion-chip" onclick="setPrompt('Web dashboard for IoT devices')">IoT dashboard</div>
              <div class="suggestion-chip" onclick="setPrompt('Bluetooth LE sensor logger')">BLE sensor logger</div>
            </div>
          </div>
        </div>
        
        <div class="progress-container" id="progressContainer">
          <div class="progress-bar">
            <div class="progress-fill" id="progressFill"></div>
          </div>
          <div class="progress-text" id="progressText">Generating...</div>
        </div>
        
        <div class="chat-input-area">
          <div class="chat-input-wrapper">
            <textarea 
              id="description" 
              class="chat-input" 
              rows="1"
              placeholder="Describe your prototype..."
              onkeydown="handleKeydown(event)"
            ></textarea>
            <button class="chat-send-btn" id="sendBtn" onclick="generatePrototype()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"/>
              </svg>
            </button>
          </div>
          <div class="input-options">
            <select id="projectType">
              <option value="hybrid">Hybrid Project</option>
              <option value="hardware">Hardware Only</option>
              <option value="software">Software Only</option>
            </select>
          </div>
        </div>
      </div>
      
      <!-- Right Panel - Output -->
      <div class="output-panel">
        <div class="output-tabs">
          <button class="output-tab active" data-tab="files" onclick="switchTab('files')">Files</button>
          <button class="output-tab" data-tab="code" onclick="switchTab('code')">Code</button>
          <button class="output-tab" data-tab="schematic" onclick="switchTab('schematic')">Schematic</button>
          <button class="output-tab" data-tab="bom" onclick="switchTab('bom')">BOM</button>
          <button class="output-tab" data-tab="guide" onclick="switchTab('guide')">Guide</button>
        </div>
        
        <div class="output-content">
          <div class="tab-panel active" id="tab-files">
            <div class="file-tree" id="fileTree">
              <div style="color: #999; font-size: 13px; padding: 20px; text-align: center;">
                No project loaded yet.<br>Start a conversation to generate files.
              </div>
            </div>
          </div>
          
          <div class="tab-panel" id="tab-code">
            <div id="codeContent">
              <div style="color: #999; font-size: 13px; padding: 20px; text-align: center;">
                Select a file from the Files tab to view code.
              </div>
            </div>
          </div>
          
          <div class="tab-panel" id="tab-schematic">
            <div id="schematicContent">
              <div style="color: #999; font-size: 13px; padding: 20px; text-align: center;">
                No schematic generated yet.
              </div>
            </div>
          </div>
          
          <div class="tab-panel" id="tab-bom">
            <div id="bomContent">
              <div style="color: #999; font-size: 13px; padding: 20px; text-align: center;">
                No Bill of Materials yet.
              </div>
            </div>
          </div>
          
          <div class="tab-panel" id="tab-guide">
            <div id="guideContent">
              <div style="color: #999; font-size: 13px; padding: 20px; text-align: center;">
                Build guide will appear here.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Status Bar -->
    <div class="status-bar">
      <span id="statusProvider">Provider: Ollama</span>
      <span id="statusState">Ready</span>
    </div>
  </div>
  
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'default' });
    
    let currentProjectPath = null;
    let currentPrototype = null;
    let isGenerating = false;
    
    function setPrompt(text) {
      document.getElementById('description').value = text;
      document.getElementById('description').focus();
    }
    
    function handleKeydown(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (!isGenerating) {
          generatePrototype();
        }
      }
    }
    
    function autoResize(event) {
      const textarea = event.target;
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
    
    document.getElementById('description').addEventListener('input', autoResize);
    
    async function generatePrototype() {
      const description = document.getElementById('description').value;
      const type = document.getElementById('projectType').value;
      const provider = document.getElementById('aiProvider').value;
      
      if (!description.trim() || isGenerating) return;
      
      // Hide welcome message
      const welcomeEl = document.getElementById('welcomeMessage');
      if (welcomeEl) welcomeEl.style.display = 'none';
      
      // Add user message
      addMessage('user', description);
      
      // Show loading
      isGenerating = true;
      document.getElementById('sendBtn').disabled = true;
      showProgress(10, 'Connecting to ' + provider + '...');
      updateStatus('Processing...', provider);
      
      try {
        showProgress(30, 'Generating prototype...');
        
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description, type, provider })
        });
        
        showProgress(60, 'Writing files...');
        
        const data = await response.json();
        
        if (data.success) {
          showProgress(90, 'Finalizing...');
          currentProjectPath = data.outputDir;
          currentPrototype = data.prototype;
          
          // Add AI response
          addMessage('assistant', formatAIResponse(data.prototype));
          
          // Update file browser
          const projectName = currentProjectPath.split('/').pop();
          await updateFileBrowser(projectName);
          
          showProgress(100, 'Complete!');
          updateStatus('Ready', provider);
        } else {
          throw new Error(data.error || 'Generation failed');
        }
      } catch (error) {
        addMessage('assistant', 'Sorry, something went wrong: ' + error.message);
        updateStatus('Error', provider);
      }
      
      isGenerating = false;
      document.getElementById('sendBtn').disabled = false;
      document.getElementById('description').value = '';
      document.getElementById('description').style.height = 'auto';
      
      setTimeout(() => {
        document.getElementById('progressContainer').classList.remove('active');
      }, 1000);
    }
    
    function addMessage(role, content) {
      const messagesEl = document.getElementById('chatMessages');
      
      // Remove welcome message
      const welcomeEl = document.getElementById('welcomeMessage');
      if (welcomeEl) welcomeEl.remove();
      
      const messageEl = document.createElement('div');
      messageEl.className = 'message ' + role;
      
      const avatar = role === 'user' ? 'U' : 'AI';
      
      messageEl.innerHTML = '<div class="message-avatar">' + avatar + '</div>' +
                            '<div class="message-bubble">' + content + '</div>';
      
      messagesEl.appendChild(messageEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    
    function showProgress(percent, text) {
      const container = document.getElementById('progressContainer');
      container.classList.add('active');
      document.getElementById('progressFill').style.width = percent + '%';
      document.getElementById('progressText').textContent = text;
    }
    
    function updateStatus(state, provider) {
      document.getElementById('statusState').textContent = state;
      document.getElementById('statusProvider').textContent = 'Provider: ' + provider;
    }
    
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
    
    async function updateFileBrowser(projectName) {
      const fileTree = document.getElementById('fileTree');
      fileTree.innerHTML = '<div style="color: #999;">Loading...</div>';
      
      async function renderDir(relDir) {
        const r = await fetch('/api/project/' + projectName + '/tree?dir=' + encodeURIComponent(relDir || ''));
        const data = await r.json();
        const entries = data.entries || [];
        
        let html = '';
        for (const entry of entries) {
          const relPath = (relDir ? relDir + '/' : '') + entry.name;
          if (entry.type === 'dir') {
            html += '<div class="file-tree-item folder" onclick="toggleDir(\'' + escapeAttr(relPath) + '\')">';
            html += '<span>📁</span><span>' + escapeHtml(entry.name) + '</span></div>';
            html += '<div id="dir-' + escapeAttr(relPath) + '" style="display:none; padding-left: 16px;"></div>';
          } else {
            html += '<div class="file-tree-item" onclick="openFile(\'' + escapeAttr(relPath) + '\')">';
            html += '<span>📄</span><span>' + escapeHtml(entry.name) + '</span></div>';
          }
        }
        return html;
      }
      
      const rootHtml = await renderDir('');
      fileTree.innerHTML = rootHtml || '<div style="color: #999;">No files</div>';
    }
    
    async function openFile(relPath) {
      if (!currentProjectPath) return;
      const projectName = currentProjectPath.split('/').pop();
      const r = await fetch('/api/project/' + projectName + '/file?path=' + encodeURIComponent(relPath));
      const data = await r.json();
      
      if (data.error) {
        alert('Error loading file: ' + data.error);
        return;
      }
      
      // Highlight selected file
      document.querySelectorAll('.file-tree-item').forEach(el => el.classList.remove('selected'));
      event.target.closest('.file-tree-item').classList.add('selected');
      
      // Switch to code tab
      switchTab('code');
      
      // Show code content
      const content = String(data.content || '');
      const lines = content.split('\\n').slice(0, 50).join('\\n');
      
      document.getElementById('codeContent').innerHTML = 
        '<div class="code-section">' +
        '<div class="code-header"><span class="code-filename">' + escapeHtml(relPath) + '</span></div>' +
        '<div class="code-content">' + escapeHtml(lines) + '</div></div>';
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
          html += '<div class="file-tree-item folder" onclick="toggleDir(\'' + escapeAttr(relPath) + '\')">';
          html += '<span>📁</span><span>' + escapeHtml(entry.name) + '</span></div>';
          html += '<div id="dir-' + escapeAttr(relPath) + '" style="display:none; padding-left: 16px;"></div>';
        } else {
          html += '<div class="file-tree-item" onclick="openFile(\'' + escapeAttr(relPath) + '\')">';
          html += '<span>📄</span><span>' + escapeHtml(entry.name) + '</span></div>';
        }
      }
      el.innerHTML = html;
      el.style.display = 'block';
    }
    
    function switchTab(tabName) {
      document.querySelectorAll('.output-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      
      document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');
      document.getElementById('tab-' + tabName).classList.add('active');
      
      if (tabName === 'schematic' && currentPrototype) renderSchematic();
      if (tabName === 'bom' && currentPrototype) renderBOM();
      if (tabName === 'guide' && currentPrototype) renderGuide();
    }
    
    function renderSchematic() {
      const s = currentPrototype?.schematic;
      const mermaidText = typeof s === 'string' ? s : (s?.mermaid || s?.diagram || '');
      
      if (mermaidText) {
        document.getElementById('schematicContent').innerHTML = 
          '<div class="mermaid">' + mermaidText + '</div>';
        mermaid.run({ querySelector: '#schematicContent .mermaid' });
      } else {
        document.getElementById('schematicContent').innerHTML = 
          '<div style="color: #999; padding: 20px; text-align: center;">No schematic generated.</div>';
      }
    }
    
    function renderBOM() {
      if (currentPrototype?.bom?.length > 0) {
        let html = '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
        html += '<tr style="background: #f5f5f7;"><th style="padding: 10px; text-align: left;">#</th>';
        html += '<th style="padding: 10px; text-align: left;">Part</th>';
        html += '<th style="padding: 10px; text-align: left;">Qty</th>';
        html += '<th style="padding: 10px; text-align: left;">Description</th></tr>';
        
        currentPrototype.bom.forEach((item, i) => {
          html += '<tr><td style="padding: 10px; border-bottom: 1px solid #eee;">' + (i + 1) + '</td>';
          html += '<td style="padding: 10px; border-bottom: 1px solid #eee;">' + (item.partNumber || '-') + '</td>';
          html += '<td style="padding: 10px; border-bottom: 1px solid #eee;">' + (item.quantity || 1) + '</td>';
          html += '<td style="padding: 10px; border-bottom: 1px solid #eee;">' + (item.description || '-') + '</td></tr>';
        });
        html += '</table>';
        document.getElementById('bomContent').innerHTML = html;
      } else {
        document.getElementById('bomContent').innerHTML = 
          '<div style="color: #999; padding: 20px; text-align: center;">No BOM for this project.</div>';
      }
    }
    
    function renderGuide() {
      if (currentPrototype?.buildGuide) {
        document.getElementById('guideContent').innerHTML = 
          '<div style="white-space: pre-wrap; font-size: 13px; line-height: 1.6;">' + escapeHtml(currentPrototype.buildGuide) + '</div>';
      } else {
        document.getElementById('guideContent').innerHTML = 
          '<div style="color: #999; padding: 20px; text-align: center;">No build guide yet.</div>';
      }
    }
    
    function newProject() {
      document.getElementById('description').value = '';
      document.getElementById('chatMessages').innerHTML = 
        '<div class="welcome-message" id="welcomeMessage"><h2>What would you like to build?</h2><p>Describe your prototype idea and I will generate everything you need.</p><div class="welcome-suggestions"><div class="suggestion-chip" onclick="setPrompt(\'A smart plant monitor with moisture sensor\')">Smart plant monitor</div><div class="suggestion-chip" onclick="setPrompt(\'Weather station with ESP32 and display\')">Weather station</div><div class="suggestion-chip" onclick="setPrompt(\'Web dashboard for IoT devices\')">IoT dashboard</div><div class="suggestion-chip" onclick="setPrompt(\'Bluetooth LE sensor logger\')">BLE sensor logger</div></div></div>';
      document.getElementById('fileTree').innerHTML = 
        '<div style="color: #999; font-size: 13px; padding: 20px; text-align: center;">No project loaded yet.</div>';
      document.getElementById('codeContent').innerHTML = 
        '<div style="color: #999; font-size: 13px; padding: 20px; text-align: center;">Select a file to view code.</div>';
      currentProjectPath = null;
      currentPrototype = null;
      updateStatus('Ready', document.getElementById('aiProvider').value);
    }
    
    function exportZip() {
      if (currentProjectPath) {
        const projectName = currentProjectPath.split('/').pop();
        window.location.href = '/api/project/' + projectName + '/download';
      } else {
        alert('No project to export');
      }
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    function escapeAttr(text) {
      return String(text || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  </script>
</body>
</html>`;
}

export default {
  startWebServer
};
