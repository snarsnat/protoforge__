/**
 * ProtoForge TUI - Main Application Component (Ink/React)
 * Interactive terminal user interface for ProtoForge
 * 
 * ANTI-AI-DESIGN PHILOSOPHY:
 * - No chat bubbles (they're overused AI clichés)
 * - No gradients, glow effects, or subtle shadows  
 * - Angular brutalist aesthetics
 * - Terminal-first philosophy
 * - High contrast, visible borders
 * - Monospace typography
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import chalk from 'chalk';

import { generatePrototype } from '../core/generator.js';
import { isProviderConfigured } from '../core/config.js';

// ASCII Art Banner - No gradients, no glow, just raw terminal aesthetics
const ASCII_BANNER = chalk.cyan(`
╔════════════════════════════════════════════════════════════════════════════════╗
║                                                                                ║
║   ██████╗ ██████╗ ███████╗ █████╗  ██████╗██╗  ██╗                              ║
║  ██╔═══██╗██╔══██╗██╔════╝██╔══██╗██╔════╝██║  ██║                              ║
║  ██║   ██║██████╔╝█████╗  ███████║██║     ███████║                              ║
║  ██║   ██║██╔══██╗██╔══╝  ██╔══██║██║     ██╔══██║                              ║
║  ╚██████╔╝██║  ██║███████╗██║  ██║╚██████╗██║  ██║                              ║
║   ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝                              ║
║                                                                                ║
║   AI-POWERED PROTOTYPE BUILDER                                                 ║
║   v1.0.0  |  NO CHAT BUBBLES  |  NO GRADIENTS  |  TERMINAL FIRST               ║
║                                                                                ║
╚════════════════════════════════════════════════════════════════════════════════╝
`);

// ASCII divider
const DIVIDER = chalk.dim('├' + '─'.repeat(78) + '┤');

// Status bar characters
const STATUS_BAR = {
  connected: chalk.green('●'),
  disconnected: chalk.red('○'),
  notSet: chalk.gray('○')
};

/**
 * Main App Component
 */
const App = ({ provider, model, config }) => {
  const { exit } = useApp();
  
  // State management
  const [step, setStep] = useState('welcome'); // welcome, menu, input, processing, success, error
  const [menuIndex, setMenuIndex] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [projectType, setProjectType] = useState('hybrid');
  const [statusMessage, setStatusMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  // Menu options
  const menuOptions = [
    { label: 'New Prototype    ', shortcut: '1' },
    { label: 'Recent Projects  ', shortcut: '2' },
    { label: 'Settings         ', shortcut: '3' },
    { label: 'Web Interface    ', shortcut: 'w' },
    { label: 'Install          ', shortcut: 'i' },
    { label: 'Help             ', shortcut: '?' },
    { label: 'Quit             ', shortcut: 'q' }
  ];
  
  // Keyboard input handling
  useInput((input, key) => {
    if (step === 'menu') {
      // Handle menu navigation
      if (key.downArrow) {
        setMenuIndex(prev => (prev + 1) % menuOptions.length);
      } else if (key.upArrow) {
        setMenuIndex(prev => (prev - 1 + menuOptions.length) % menuOptions.length);
      } else if (key.return) {
        handleMenuSelection(menuOptions[menuIndex].label.trim());
      } else {
        // Handle shortcut keys
        const optionIndex = menuOptions.findIndex(opt => opt.shortcut.toLowerCase() === input.toLowerCase());
        if (optionIndex >= 0) {
          handleMenuSelection(menuOptions[optionIndex].label.trim());
        }
      }
      
      // Direct shortcuts
      if (input.toLowerCase() === 'w') {
        handleMenuSelection('Web Interface');
      } else if (input.toLowerCase() === 'q') {
        exit();
      } else if (input === '?') {
        handleMenuSelection('Help');
      }
    } else if (step === 'projectType') {
      if (input.toLowerCase() === 'h') setProjectType('hardware');
      else if (input.toLowerCase() === 's') setProjectType('software');
      else if (input.toLowerCase() === 'b' || input.toLowerCase() === 'hy') setProjectType('hybrid');
      else if (key.return) setProjectType('hybrid');
    } else if (step === 'processing') {
      // No input during processing
    } else if (step === 'success' || step === 'error') {
      if (input.toLowerCase() === 'n') {
        // Start new project
        setStep('input');
        setPrompt('');
        setResult(null);
        setError(null);
      } else if (input.toLowerCase() === 'q' || key.escape) {
        exit();
      }
    }
  });
  
  /**
   * Handle menu selection
   */
  const handleMenuSelection = async (selection) => {
    switch (selection) {
      case 'New Prototype':
        // Check if AI is configured
        const configured = await isProviderConfigured(config, provider || 'ollama');
        if (!configured && provider !== 'ollama') {
          setError(`AI provider "${provider}" is not configured. Run 'protoforge setup' first.`);
          setStep('error');
        } else {
          setStep('projectType');
        }
        break;
        
      case 'Recent Projects':
        setStatusMessage('Recent projects feature coming soon!');
        setTimeout(() => setStatusMessage(''), 2000);
        break;
        
      case 'Settings':
        setStatusMessage('Settings feature coming soon! Use "protoforge setup" command.');
        setTimeout(() => setStatusMessage(''), 3000);
        break;
        
      case 'Web Interface':
        setStatusMessage('Launching web interface... Use "protoforge web" to launch.');
        setTimeout(() => setStatusMessage(''), 2000);
        break;
        
      case 'Install':
        setStatusMessage('Run: npm install -g protoforge');
        setTimeout(() => setStatusMessage(''), 3000);
        break;
        
      case 'Help':
        setStatusMessage('Commands: [1] New | [2] Recent | [3] Settings | [w] Web | [i] Install | [q] Quit');
        setTimeout(() => setStatusMessage(''), 5000);
        break;
        
      case 'Quit':
        exit();
        break;
    }
  };
  
  /**
   * Handle prompt submission
   */
  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    
    setStep('processing');
    setProgress(0);
    setStatusMessage('Initializing AI architect...');
    
    try {
      // Progress steps
      setProgress(10);
      setStatusMessage('Connecting to AI provider...');
      
      const result = await generatePrototype(prompt, {
        type: projectType,
        provider: provider || 'ollama',
        outputDir: config?.get('settings.outputDir') || './protoforge-output',
        config
      });
      
      setProgress(100);
      setStatusMessage('Complete!');
      setResult(result);
      setStep('success');
      
    } catch (err) {
      setError(err.message);
      setStep('error');
    }
  };
  
  // Render welcome screen with ASCII art
  if (step === 'welcome') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>{ASCII_BANNER}</Text>
        <Box marginTop={1}>
          {DIVIDER}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press any key to continue...</Text>
        </Box>
        
        {/* Auto-advance to menu */}
        <TimerComponent onComplete={() => setStep('menu')} />
      </Box>
    );
  }
  
  // Render main menu
  if (step === 'menu') {
    return (
      <Box flexDirection="column" padding={1}>
        {/* Header with ASCII */}
        <Box marginBottom={1}>
          <Text color="cyan">┌─ PROTOFORGE TERMINAL v1.0.0 ───────────────────────────────┐</Text>
        </Box>
        
        {/* Status bar - showing provider status */}
        <Box marginBottom={1}>
          <Text color="cyan">│</Text>
          <Text> </Text>
          <Text color="white">Provider:</Text>
          <Text> </Text>
          <Text color="green">{provider || 'ollama'}</Text>
          <Text>  </Text>
          <Text color="white">Image:</Text>
          <Text> </Text>
          <Text color={config?.get('imageGen.provider') !== 'none' ? 'green' : 'gray'}>
            {config?.get('imageGen.provider') !== 'none' ? 'ON ' : 'OFF'}
          </Text>
          <Text>  </Text>
          <Text color="white">3D:</Text>
          <Text> </Text>
          <Text color={config?.get('meshy3d.enabled') ? 'green' : 'gray'}>
            {config?.get('meshy3d.enabled') ? 'ON ' : 'OFF'}
          </Text>
          <Text>                                                  </Text>
          <Text color="cyan">│</Text>
        </Box>
        
        {DIVIDER}
        
        {/* Menu options - angular, no rounded anything */}
        <Box flexDirection="column" marginTop={1}>
          {menuOptions.map((option, index) => (
            <Box key={option.label}>
              <Text color="cyan">│</Text>
              <Text> </Text>
              {index === menuIndex ? (
                <Text color="yellow" bold>{'›'} </Text>
              ) : (
                <Text color="cyan"> </Text>
              )}
              {index === menuIndex ? (
                <Text color="yellow" bold>[{option.shortcut}]</Text>
              ) : (
                <Text color="gray">   </Text>
              )}
              <Text> </Text>
              {index === menuIndex ? (
                <Text color="yellow" bold>{option.label}</Text>
              ) : (
                <Text color="white">{option.label}</Text>
              )}
              <Text>                                                                              </Text>
              <Text color="cyan">│</Text>
            </Box>
          ))}
        </Box>
        
        {DIVIDER}
        
        {/* Help text */}
        <Box marginTop={1}>
          <Text color="cyan">│</Text>
          <Text> </Text>
          <Text dimColor>↑↓ Navigate | Enter Select | [w] Web | [i] Install | [?] Help | [q] Quit              </Text>
          <Text>                                                           </Text>
          <Text color="cyan">│</Text>
        </Box>
        
        {/* Status message */}
        <Box marginTop={0}>
          <Text color="cyan">│</Text>
          <Text> </Text>
          {statusMessage ? (
            <Text color="yellow">{statusMessage}</Text>
          ) : (
            <Text dimColor>Ready for commands...                                                                 </Text>
          )}
          <Text>                                                          </Text>
          <Text color="cyan">│</Text>
        </Box>
        
        <Box marginBottom={1}>
          <Text color="cyan">└────────────────────────────────────────────────────────────────┘</Text>
        </Box>
      </Box>
    );
  }
  
  // Render project type selection
  if (step === 'projectType') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan">┌─ SELECT PROJECT TYPE ──────────────────────────────────────────┐</Text>
        
        <Box marginTop={1}>
          <Text color="cyan">│</Text>
          <Text> </Text>
          <Text color="white">Choose your project category:</Text>
          <Text>                                                        </Text>
          <Text color="cyan">│</Text>
        </Box>
        
        <Box marginTop={1}>
          <Text color="cyan">│</Text>
          <Text> </Text>
          {projectType === 'hardware' ? (
            <Text color="yellow" bold>{'›'} </Text>
          ) : (
            <Text color="gray">  </Text>
          )}
          <Text> </Text>
          <Text color={projectType === 'hardware' ? 'yellow' : 'white'}>[H]</Text>
          <Text> </Text>
          <Text color={projectType === 'hardware' ? 'yellow' : 'white'}>HARDWARE</Text>
          <Text>    </Text>
          <Text dimColor>(IoT, Embedded, Sensors, Robotics)</Text>
          <Text>                                            </Text>
          <Text color="cyan">│</Text>
        </Box>
        
        <Box>
          <Text color="cyan">│</Text>
          <Text> </Text>
          {projectType === 'software' ? (
            <Text color="yellow" bold>{'›'} </Text>
          ) : (
            <Text color="gray">  </Text>
          )}
          <Text> </Text>
          <Text color={projectType === 'software' ? 'yellow' : 'white'}>[S]</Text>
          <Text> </Text>
          <Text color={projectType === 'software' ? 'yellow' : 'white'}>SOFTWARE</Text>
          <Text>    </Text>
          <Text dimColor>(Web, Mobile, API, Desktop)</Text>
          <Text>                                              </Text>
          <Text color="cyan">│</Text>
        </Box>
        
        <Box>
          <Text color="cyan">│</Text>
          <Text> </Text>
          {projectType === 'hybrid' ? (
            <Text color="yellow" bold>{'›'} </Text>
          ) : (
            <Text color="gray">  </Text>
          )}
          <Text> </Text>
          <Text color={projectType === 'hybrid' ? 'yellow' : 'white'}>[B]</Text>
          <Text> </Text>
          <Text color={projectType === 'hybrid' ? 'yellow' : 'white'}>HYBRID</Text>
          <Text>      </Text>
          <Text dimColor>(Combined hardware + software)</Text>
          <Text>                                      </Text>
          <Text color="cyan">│</Text>
        </Box>
        
        {DIVIDER}
        
        {/* Input area */}
        <Box marginTop={1}>
          <Text color="cyan">│</Text>
          <Text> </Text>
          <Text color="white">Description:</Text>
          <Text> </Text>
          <TextInput
            value={prompt}
            onChange={setPrompt}
            onSubmit={() => {
              if (projectType) handleSubmit();
            }}
            placeholder="Describe your prototype idea..."
          />
          <Text>                                                       </Text>
          <Text color="cyan">│</Text>
        </Box>
        
        <Box marginTop={1}>
          <Text color="cyan">│</Text>
          <Text> </Text>
          <Text dimColor>Press h/s/b to select type | Enter to generate | Esc for menu                            </Text>
          <Text>                                                    </Text>
          <Text color="cyan">│</Text>
        </Box>
        
        <Box marginBottom={1}>
          <Text color="cyan">└────────────────────────────────────────────────────────────────┘</Text>
        </Box>
      </Box>
    );
  }
  
  // Render processing state
  if (step === 'processing') {
    const filledBlocks = Math.floor(progress / 2.5);
    const emptyBlocks = 40 - filledBlocks;
    
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan">┌─ GENERATING PROTOTYPE ────────────────────────────────────────┐</Text>
        
        <Box marginTop={1}>
          <Text color="cyan">│</Text>
          <Text> </Text>
          <Text><Spinner type="dots" /></Text>
          <Text> </Text>
          <Text color="white">{statusMessage}</Text>
          <Text>                                                           </Text>
          <Text color="cyan">│</Text>
        </Box>
        
        {/* Progress bar - terminal style */}
        <Box marginTop={1}>
          <Text color="cyan">│</Text>
          <Text> </Text>
          <Text color="green">
            {'█'.repeat(filledBlocks)}
            {'░'.repeat(emptyBlocks)}
          </Text>
          <Text> </Text>
          <Text color="white">{progress}%</Text>
          <Text>                                                      </Text>
          <Text color="cyan">│</Text>
        </Box>
        
        {DIVIDER}
        
        <Box marginTop={1}>
          <Text color="cyan">│</Text>
          <Text> </Text>
          <Text dimColor>Type: {projectType.toUpperCase()} | Provider: {(provider || 'ollama').toUpperCase()}                                                  </Text>
          <Text>                                       </Text>
          <Text color="cyan">│</Text>
        </Box>
        
        <Box marginBottom={1}>
          <Text color="cyan">└────────────────────────────────────────────────────────────────┘</Text>
        </Box>
      </Box>
    );
  }
  
  // Render success state
  if (step === 'success') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan">┌─ PROTOTYPE GENERATED ──────────────────────────────────────────┐</Text>
        
        <Box marginTop={1}>
          <Text color="cyan">│</Text>
          <Text> </Text>
          <Text color="green" bold>{'✓'} </Text>
          <Text color="green" bold>SUCCESS!</Text>
          <Text>                                                          </Text>
          <Text color="cyan">│</Text>
        </Box>
        
        {DIVIDER}
        
        {result && (
          <Box flexDirection="column" marginTop={1}>
            <Box>
              <Text color="cyan">│</Text>
              <Text> </Text>
              <Text color="white">Output:</Text>
              <Text> </Text>
              <Text color="cyan">{result.outputDir}</Text>
              <Text>                                                        </Text>
              <Text color="cyan">│</Text>
            </Box>
            <Box>
              <Text color="cyan">│</Text>
              <Text> </Text>
              <Text dimColor>Files: code/, docs/, schematics/, bom.csv, report.md                     </Text>
              <Text>                                                    </Text>
              <Text color="cyan">│</Text>
            </Box>
          </Box>
        )}
        
        {DIVIDER}
        
        <Box marginTop={1}>
          <Text color="cyan">│</Text>
          <Text> </Text>
          <Text dimColor>Press [N] New Project | [Q] Quit                                           </Text>
          <Text>                                                    </Text>
          <Text color="cyan">│</Text>
        </Box>
        
        <Box marginBottom={1}>
          <Text color="cyan">└────────────────────────────────────────────────────────────────┘</Text>
        </Box>
      </Box>
    );
  }
  
  // Render error state
  if (step === 'error') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan">┌─ ERROR ──────────────────────────────────────────────────────┐</Text>
        
        <Box marginTop={1}>
          <Text color="cyan">│</Text>
          <Text> </Text>
          <Text color="red" bold>{'✖'} </Text>
          <Text color="red" bold>ERROR</Text>
          <Text>                                                             </Text>
          <Text color="cyan">│</Text>
        </Box>
        
        {DIVIDER}
        
        <Box marginTop={1}>
          <Text color="cyan">│</Text>
          <Text> </Text>
          <Text color="red">{error}</Text>
          <Text>                                                              </Text>
          <Text color="cyan">│</Text>
        </Box>
        
        {DIVIDER}
        
        <Box marginTop={1}>
          <Text color="cyan">│</Text>
          <Text> </Text>
          <Text dimColor>Press [N] New Project | [Q] Quit                                           </Text>
          <Text>                                                    </Text>
          <Text color="cyan">│</Text>
        </Box>
        
        <Box marginBottom={1}>
          <Text color="cyan">└────────────────────────────────────────────────────────────────┘</Text>
        </Box>
      </Box>
    );
  }
  
  return null;
};

/**
 * Timer component to auto-advance from welcome screen
 */
const TimerComponent = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);
  
  return null;
};

export default App;
