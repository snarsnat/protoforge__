/**
 * ProtoForge Core Generator
 * Orchestrates AI interactions and project generation
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getAIConfig, getConfigValue } from './config.js';
import { getSystemPrompt } from '../prompts/system.js';
import { generateResponse, streamResponse } from '../ai/adapter.js';
import { ensureDir, sanitizeFilename, log, colors } from '../utils/helpers.js';
import { generateProjectFromResponse } from './output.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Generate a complete prototype based on user description
 * @param {string} description - Project description
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generation result
 */
export async function generatePrototype(description, options = {}) {
  const {
    outputDir = getConfigValue('outputDir', './protoforge-output'),
    projectType = 'auto',
    stream = false,
    onProgress = () => {},
    onToken = () => {},
    logger = log
  } = options;

  logger.info('Starting prototype generation...');

  // Get AI configuration
  const aiConfig = getAIConfig();
  logger.info(`Using provider: ${aiConfig.provider}`);
  logger.info(`Model: ${aiConfig.model}`);

  // Build the conversation context
  const messages = [
    { role: 'system', content: getSystemPrompt(projectType) },
    { role: 'user', content: description }
  ];

  // Create output directory
  const timestamp = Date.now();
  const sanitizedDesc = sanitizeFilename(description.substring(0, 30));
  const projectDir = path.join(outputDir, `protoforge_${sanitizedDesc}_${timestamp}`);
  await ensureDir(projectDir);

  try {
    let fullResponse = '';

    if (stream) {
      // Streaming response
      logger.info('Streaming response...');
      await streamResponse(messages, aiConfig, {
        onToken: (token) => {
          fullResponse += token;
          onToken(token);
        },
        onProgress: (progress) => {
          onProgress(progress);
        }
      });
    } else {
      // Non-streaming response
      logger.info('Generating response (this may take a moment)...');
      const response = await generateResponse(messages, aiConfig);
      fullResponse = response;
      onProgress({ stage: 'complete', message: 'Response generated' });
    }

    // Parse and generate project files
    logger.info('Processing generated content...');
    const result = await generateProjectFromResponse(fullResponse, projectDir, description);

    // Save generation metadata
    const metadata = {
      description,
      provider: aiConfig.provider,
      model: aiConfig.model,
      timestamp,
      outputDir: projectDir,
      files: result.files
    };

    fs.writeFileSync(
      path.join(projectDir, '.protoforge-meta.json'),
      JSON.stringify(metadata, null, 2)
    );

    // Update recent projects
    updateRecentProjects(projectDir);

    logger.success(`Prototype generated successfully!`);
    logger.info(`Output directory: ${projectDir}`);

    return {
      success: true,
      projectDir,
      files: result.files,
      prototype: result.parsed,
      metadata
    };

  } catch (error) {
    logger.error(`Generation failed: ${error.message}`);

    // Preserve the output directory for debugging (prototype.raw.txt, parse errors, etc.).
    // If a caller really wants cleanup, they can remove it manually.
    if (fs.existsSync(projectDir)) {
      try {
        fs.writeFileSync(
          path.join(projectDir, '.protoforge-error.txt'),
          String(error?.stack || error?.message || error),
          'utf-8'
        );
      } catch {
        // ignore
      }
    }

    throw error;
  }
}

/**
 * Quick generate a simple prototype
 * @param {string} description - Project description
 * @returns {Promise<Object>} Quick generation result
 */
export async function quickGenerate(description) {
  return generatePrototype(description, {
    projectType: 'hybrid',
    onProgress: (progress) => {
      if (progress.stage) {
        log.info(`[${progress.stage}] ${progress.message || ''}`);
      }
    }
  });
}

/**
 * Generate with specific project type
 * @param {string} description - Project description
 * @param {string} type - Project type (web, hardware, mobile, api, etc.)
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Generation result
 */
export async function generateWithType(description, type, options = {}) {
  const typeMap = {
    web: 'web',
    hardware: 'hardware',
    mobile: 'mobile',
    api: 'api',
    cli: 'cli',
    desktop: 'desktop'
  };

  const projectType = typeMap[type] || 'hybrid';
  return generatePrototype(description, { ...options, projectType });
}

/**
 * Update recent projects list
 * @param {string} projectDir - Project directory path
 */
function updateRecentProjects(projectDir) {
  const recentProjects = getConfigValue('recentProjects', []);
  // Add to front and keep only last 10
  const updated = [projectDir, ...recentProjects.filter(p => p !== projectDir)].slice(0, 10);
  import('./config.js').then(({ setConfigValue }) => {
    setConfigValue('recentProjects', updated);
    setConfigValue('lastProject', projectDir);
  });
}

/**
 * Cancel ongoing generation (for future streaming implementation)
 */
export function cancelGeneration() {
  // Placeholder for cancellation logic
  log.warn('Generation cancellation not yet implemented');
}

/**
 * Get generation status
 * @returns {Object} Current generation status
 */
export function getGenerationStatus() {
  return {
    status: 'idle',
    provider: getAIConfig().provider,
    model: getAIConfig().model
  };
}

export default {
  generatePrototype,
  quickGenerate,
  generateWithType,
  cancelGeneration,
  getGenerationStatus
};
