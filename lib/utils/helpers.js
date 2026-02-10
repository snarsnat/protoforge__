/**
 * ProtoForge Utility Functions
 * Helper functions for colors, logging, file operations, and more
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Color codes for terminal output
 */
export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  // Foreground colors
  fg: {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
    crimson: '\x1b[38;5;196m'
  },
  
  // Background colors
  bg: {
    black: '\x1b[40m',
    red: '\x1b[41m',
    green: '\x1b[42m',
    yellow: '\x1b[43m',
    blue: '\x1b[44m',
    magenta: '\x1b[45m',
    cyan: '\x1b[46m',
    white: '\x1b[47m'
  }
};

/**
 * Logger with different log levels
 */
export const log = {
  info: (msg) => console.log(`${colors.fg.cyan}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.fg.green}[OK]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.fg.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.fg.red}[ERROR]${colors.reset} ${msg}`),
  debug: (msg) => {
    if (process.env.DEBUG) console.log(`${colors.fg.gray}[DEBUG]${colors.reset} ${msg}`);
  },
  banner: (msg) => console.log(`${colors.fg.cyan}${colors.bright}${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.fg.yellow}${colors.bright}━━━ ${msg} ━━━${colors.reset}\n`)
};

/**
 * Simple chalk-like color function
 * @param {string} color - Color name
 * @param {string} text - Text to color
 * @returns {string} Colored text
 */
export function chalk(color, text) {
  const colorMap = {
    cyan: colors.fg.cyan,
    green: colors.fg.green,
    yellow: colors.fg.yellow,
    red: colors.fg.red,
    blue: colors.fg.blue,
    magenta: colors.fg.magenta,
    white: colors.fg.white,
    gray: colors.fg.gray,
    black: colors.fg.black,
    bright: colors.bright,
    dim: colors.dim
  };
  
  const colorCode = colorMap[color] || colors.fg.white;
  return `${colorCode}${text}${colors.reset}`;
}

/**
 * Create a directory recursively
 * @param {string} dirPath - Directory path to create
 */
export async function ensureDir(dirPath) {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Check if directory exists
 * @param {string} dirPath - Directory path
 * @returns {boolean} True if exists
 */
export function dirExists(dirPath) {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if file exists
 * @param {string} filePath - File path
 * @returns {boolean} True if exists
 */
export function fileExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Sanitize filename
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
export function sanitizeFilename(filename) {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50);
}

/**
 * Get file extension
 * @param {string} filename - Filename
 * @returns {string} Extension without dot
 */
export function getFileExtension(filename) {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

/**
 * Format file size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format duration in milliseconds to human readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
}

/**
 * Get relative path from current directory
 * @param {string} filePath - Absolute file path
 * @returns {string} Relative path
 */
export function getRelativePath(filePath) {
  const cwd = process.cwd();
  return path.relative(cwd, filePath);
}

/**
 * Get project root directory
 * @returns {string} Project root path
 */
export function getProjectRoot() {
  return path.resolve(__dirname, '..', '..');
}

/**
 * Capitalize first letter of string
 * @param {string} str - Input string
 * @returns {string} Capitalized string
 */
export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncate string to max length
 * @param {string} str - Input string
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
export function truncate(str, maxLength = 50) {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} baseDelay - Base delay in ms
 * @returns {Promise<*>} Result of function
 */
export async function retry(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Debounce function calls
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Get ASCII art banner
 * @returns {string} ASCII art banner
 */
export function getBanner() {
  return `
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║    ███████╗███████╗████████╗██╗ ██████╗ █████╗ ██╗         ║
║    ██╔════╝██╔════╝╚══██╔══╝██║██╔════╝██╔══██╗██║         ║
║    █████╗  █████╗     ██║   ██║██║     ███████║██║         ║
║    ██╔══╝  ██╔══╝     ██║   ██║██║     ██╔══██║██║         ║
║    ███████╗███████╗   ██║   ██║╚██████╗██║  ██║███████╗    ║
║    ╚══════╝╚══════╝   ╚═╝   ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝    ║
║                                                               ║
║                    [ AI-Powered Prototype Builder ]          ║
║                                                               ║
║              Build Complete Projects with AI                 ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝`;
}

/**
 * Get loading animation
 * @param {number} index - Frame index
 * @returns {string} Animation frame
 */
export function getLoadingFrame(index) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  return frames[index % frames.length];
}

/**
 * Create a simple spinner
 * @param {string} message - Spinner message
 * @param {Function} callback - Async callback
 * @returns {Promise<*>} Callback result
 */
export async function withSpinner(message, callback) {
  let frameIndex = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r${colors.fg.cyan}${getLoadingFrame(frameIndex)} ${message}${colors.reset}`);
    frameIndex++;
  }, 100);

  try {
    const result = await callback();
    clearInterval(interval);
    process.stdout.write(`\r${colors.fg.green}✓ ${message}${colors.reset}\n`);
    return result;
  } catch (error) {
    clearInterval(process.stdout.write(`\r${colors.fg.red}✗ ${message}${colors.reset}\n`));
    throw error;
  }
}

export default {
  colors,
  log,
  chalk,
  ensureDir,
  dirExists,
  fileExists,
  sanitizeFilename,
  getFileExtension,
  formatFileSize,
  formatDuration,
  getRelativePath,
  getProjectRoot,
  capitalize,
  truncate,
  sleep,
  retry,
  debounce,
  getBanner,
  getLoadingFrame,
  withSpinner
};
