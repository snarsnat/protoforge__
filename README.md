# ProtoForge

**AI-Powered Prototype Builder for Hardware, Software, and Hybrid Projects**

ProtoForge is an open-source CLI tool that uses AI to generate complete prototype packages from natural language descriptions. It creates everything you need to build your project: code, schematics, BOMs, build guides, and documentation.

## Anti-AI-Design Philosophy

ProtoForge rejects the typical AI interface clichés:

```
┌─────────────────────────────────────────────────────────────────┐
│ NO CHAT BUBBLES        │ NO GRADIENTS         │ NO ROUNDED     │
│ NO FLOATING BUTTONS    │ NO GLOW EFFECTS      │ NO ANIMATIONS  │
│ NO MINIMALIST SPARSE   │ NO "COPILOT" STYLE   │ TERMINAL FIRST │
└─────────────────────────────────────────────────────────────────┘
```

Our interfaces are built for **efficiency** and **productivity**, not engagement metrics:

- **Split-panel layout** inspired by terminal multiplexers (tmux, screen)
- **Visible borders and grid lines** - no hidden boundaries
- **High contrast terminal colors** - no subtle gradients
- **Monospace typography everywhere** - including the web interface
- **Angular brutalist aesthetics** - 0px border-radius
- **Dense information display** - efficiency over white space
- **ASCII art banners** - real terminal culture, not AI marketing

## Installation

### Prerequisites

- Node.js 18+
- npm
- Optional: [Ollama](https://ollama.ai) for local AI generation

### Global Install (Recommended)

```bash
npm install -g protoforge
protoforge --version
```

After a global install, the `protoforge` command should work immediately (no `npm link` required).

#### Method 2: Using the Install Command

```bash
# Run the built-in install command
protoforge install

# This will show you the exact commands for your system
```

#### Method 3: From Source

```bash
# Clone and install locally
git clone https://github.com/protoforge/protoforge.git
cd protoforge
npm install
npm link

# Run locally without global install
npm start
```

#### Platform-Specific Notes

**Linux/macOS:**
```bash
# May require sudo for global install
sudo npm install -g protoforge

# Or use nvm to avoid sudo
nvm use --lts
npm install -g protoforge
```

**Windows:**
```bash
# Ensure Node.js is in your PATH
npm install -g protoforge
```

**Docker:**
```bash
# Run without installation
docker run --rm -it protoforge/cli
```

### Setup (API keys + preferences)

Run:

```bash
protoforge setup
```

The setup wizard prompts in this order:
1. **AI provider** (default: Ollama — local & free)
2. **Ollama URL** (default: http://localhost:11434) and **model** (default: llama3.1)
3. **Optional cloud AI key** (OpenAI or Groq)
4. **3D preview (HTML)** (no Meshy; generated locally as an HTML preview)
5. Web/output settings

Keys are stored locally via the `conf` module in `~/.protoforge/config.json`.

## Usage

### Interactive TUI Mode

```bash
protoforge start
```
(You can also run `protoforge` with no args to start the TUI.)

Navigate with arrow keys:
- **New Prototype**: Enter a description and generate
- **Recent Projects**: View previously generated projects
- **Settings**: Configure AI providers and preferences
- **Web Interface**: Launch the local web dashboard

### Command-Line Generation

Generate a prototype directly from the command line:

```bash
# Basic usage
protoforge build "A smart plant monitor with moisture sensor"

# With options
protoforge build "IoT weather station" \
  --type hardware \
  --provider ollama \
  --output ./my-projects \
  --zip

# Hybrid project
protoforge build "Smart doorbell with camera and mobile app" \
  --type hybrid
```

### Web Interface (Main Editing Place)

```bash
protoforge web
# or
protoforge --web
```

Opens http://localhost:3000 with a split-panel layout:
- Left: command input + generation log
- Right tabs: **Scripts** (file browser + editor), **Diagrams** (Mermaid), **3D Preview** (HTML), **BOM**, **Guide**
- ZIP export

Anti-AI-design enforced: no chat bubbles, no gradients, angular borders, monospace, dense info.

### Configuration Commands

View and edit configuration:

```bash
# View all settings
protoforge config

# Get specific setting
protoforge config --get chatbot.provider

# Set a value
protoforge config --set chatbot.provider ollama

# Reset all configuration
protoforge config --reset
```

## Output Structure

Generated prototypes are saved to `./protoforge-output/` (or custom directory):

```
project-name-timestamp/
├── code/
│   ├── main.ino          # Arduino/firmware code
│   ├── app.js            # Backend application
│   └── index.html        # Frontend interface
├── schematics/
│   ├── diagram.mmmd      # Mermaid diagram
│   └── 3d-description.md # 3D model specs
├── docs/
│   ├── overview.md       # Project overview
│   ├── tech-stack.md     # Technology recommendations
│   ├── build-guide.md    # Step-by-step guide
│   └── issues-and-fixes.md
├── bom.csv               # Bill of materials
├── report.md             # Complete project report
└── prototype.json        # Raw prototype data
```

## AI Providers

### Ollama (Recommended - Local)

Most private and cost-effective. Requires [Ollama](https://ollama.ai) installed:

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull recommended model
ollama pull llama3.1
```

Configure in ProtoForge:
```
Chatbot Provider: Ollama (Local)
URL: http://localhost:11434
Model: llama3.1
```

### Cloud Providers

All require API keys:

| Provider | Setup | Recommended Model |
|----------|-------|-------------------|
| OpenAI | Get key from [platform.openai.com](https://platform.openai.com) | gpt-4-turbo |
| Groq | Get key from [groq.com](https://groq.com) | llama-3.1-70b-versatile |
| Anthropic | Get key from [anthropic.com](https://anthropic.com) | claude-sonnet-4 |
| Gemini | Get key from [aistudio.google.com](https://aistudio.google.com) | gemini-2.0-flash |

## Example Prototypes

### IoT Weather Station
```bash
protoforge build "A weather station that measures temperature, humidity, and pressure using ESP32, displays on OLED, and sends data to MQTT"
```

### Smart Home Controller
```bash
protoforge build "Home automation controller with voice control, supporting Zigbee devices, with a React dashboard"
```

### Robotic Arm
```bash
protoforge build "4-DOF robotic arm with Arduino Uno, SG90 servos, and inverse kinematics code"
```

## Configuration File

ProtoForge stores configuration in `~/.protoforge/config.json`:

```json
{
  "chatbot": {
    "provider": "ollama"
  },
  "providers": {
    "ollama": {
      "url": "http://localhost:11434",
      "model": "llama3.1"
    }
  },
  "imageGen": {
    "provider": "none"
  },
  "meshy3d": {
    "enabled": false
  },
  "settings": {
    "outputDir": "./protoforge-output",
    "autoOpenBrowser": true
  }
}
```

## Development

### Tests

```bash
npm test
```

### Debugging generation failures

When generation fails, ProtoForge preserves the output directory and writes:
- `prototype.raw.txt` (raw model output)
- `prototype.parse-error.txt` (parse/validation error, if any)
- `.protoforge-error.txt` (stack trace / error context)

This makes it much easier to reproduce and file issues.

### Project Structure

```
protoforge/
├── bin/
│   └── protoforge.js      # CLI entry point
├── lib/
│   ├── ai/
│   │   └── adapter.js     # AI provider adapters
│   ├── core/
│   │   ├── config.js      # Configuration management
│   │   ├── generator.js   # Core generation logic
│   │   └── output.js      # File output handling
│   ├── prompts/
│   │   └── system.js      # LLM system prompts
│   ├── ui/
│   │   ├── App.jsx        # Ink TUI components
│   │   └── setup.js       # Setup wizard
│   ├── utils/
│   │   └── helpers.js     # Utility functions
│   └── web/
│       └── server.js      # Express web server
├── public/                # Static web assets
├── package.json
└── README.md
```

### Running from Source

```bash
# Development mode with hot reload
npm run dev

# Link for testing
npm link

# Run CLI
protoforge
```

### Adding New AI Providers

To add a new AI provider, extend `lib/ai/adapter.js`:

```javascript
// Add provider type
case 'newprovider':
  return this._initNewProviderClient();

// Implement initialization
_initNewProviderClient() {
  return {
    type: 'newprovider',
    async complete(prompt, options) {
      // Your API integration
    }
  };
}
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

### Ideas for Contributions

- Additional AI provider integrations
- Project templates and presets
- Export formats (PDF, Markdown variants)
- Enhanced TUI components
- Web dashboard improvements
- Documentation translations

## Roadmap

- [ ] Project templates (Arduino, Raspberry Pi, ESP32, etc.)
- [ ] Multi-file code generation with dependencies
- [ ] Interactive schematic editor
- [ ] 3D model viewer integration
- [ ] Collaborative features
- [ ] Cloud sync (optional)

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Ollama](https://ollama.ai) - Local LLM infrastructure
- [Ink](https://github.com/vadimdemedes/ink) - React for CLI
- [Mermaid](https://mermaid.js.org) - Diagram generation
- [OpenAI](https://openai.com) - Cloud AI APIs
- (3D preview is rendered locally as HTML; no Meshy dependency)

---

**Built with ❤️ by the ProtoForge Team**
