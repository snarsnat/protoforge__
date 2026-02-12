# ProtoForge

**AI-Powered Prototype Builder (CLI + TUI + Web Dashboard)**

ProtoForge generates complete prototype project packages (code, docs, BOM, diagrams, and a 3D HTML preview) from a natural language description.

## Anti-AI-Design Philosophy

ProtoForge rejects the typical AI interface clichés:

- No chat bubbles
- No gradients / glow / animations
- No rounded corners
- Monospace, dense, terminal-first UI
- Split-panel layout inspired by tmux/screen

---

## Install

### Prerequisites

- Node.js 18+
- npm

### Global install (recommended)

ProtoForge is published as a scoped package, but the command is still `protoforge`:

```bash
npm install -g @happinez/protoforge
protoforge --version
```

If you previously installed any other `protoforge`, you may need to uninstall it first:

```bash
npm uninstall -g protoforge
```

---

## First-time setup (API key)

Run:

```bash
protoforge setup
```

Setup flow:
1. Choose an AI provider (OpenAI / Groq / Anthropic / Gemini / DeepSeek)
2. Provide your API key
   - Recommended: save to `~/.protoforge/.env` as a provider env var (e.g. `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `DEEPSEEK_API_KEY`)
   - Fallback: store in `~/.protoforge/config.json`
3. Choose the model name
4. Choose output dir + web port

---

## Run

### TUI (terminal interface)

```bash
protoforge start
# or just:
protoforge
```

### Web dashboard (recommended main editing place)

```bash
protoforge web
```

Then open:

- http://localhost:3000

The web UI is split-panel:
- Left: prompt input + run log
- Right tabs: **Scripts** (file browser + editor + save), **Diagrams** (Mermaid), **3D Preview** (HTML), **BOM**, **Guide**

---

## Generate from CLI

```bash
protoforge build "A smart plant monitor with moisture sensor" --zip
```

Outputs are written to `./protoforge-output/` by default (configurable).

---

## Configuration

View config:

```bash
protoforge config
```

Set values:

```bash
protoforge config --set aiProvider=openai
protoforge config --set model=gpt-4o-mini
```

Reset:

```bash
protoforge config --reset
```

Config is stored at:

- `~/.protoforge/config.json`

---

## Development

Clone:

```bash
git clone https://github.com/snarsnat/protoforge.git
cd protoforge
npm install
```

Run:

```bash
npm start
```

Tests:

```bash
npm test
```

---

## License

MIT
