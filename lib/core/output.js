/**
 * ProtoForge Output Handler
 * Manages file creation, directory structure, and ZIP generation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Parse AI response and extract structured data
 * @param {string} response - Raw AI response
 * @returns {Object} Parsed response object
 */
export function parseAIResponse(response) {
  // Try to extract JSON from markdown code blocks
  let jsonStr = response;
  
  // Remove markdown code block markers
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  // Clean up the string
  jsonStr = jsonStr.trim();
  
  // Try to find JSON object in the response
  const braceStart = jsonStr.indexOf('{');
  const braceEnd = jsonStr.lastIndexOf('}');
  
  if (braceStart !== -1 && braceEnd !== -1) {
    jsonStr = jsonStr.substring(braceStart, braceEnd + 1);
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // If JSON parsing fails, return raw response
    return {
      rawResponse: response,
      error: 'Failed to parse JSON from response'
    };
  }
}

/**
 * Create project structure from parsed response
 * @param {Object} parsedResponse - Parsed AI response
 * @param {string} projectDir - Project directory path
 * @param {string} originalDescription - Original user description
 * @returns {Promise<Object>} Creation result with file list
 */
export async function generateProjectFromResponse(response, projectDir, originalDescription) {
  const parsed = parseAIResponse(response);
  
  // Create project structure
  await createProjectStructure(projectDir, parsed);
  
  // Write all code snippets
  const files = await writeCodeSnippets(projectDir, parsed);
  
  // Write documentation
  await writeDocumentation(projectDir, parsed, originalDescription);
  
  // Generate diagrams if present
  await generateDiagrams(projectDir, parsed);
  
  // Generate BOM if present
  await generateBOM(projectDir, parsed);

  return {
    success: true,
    files,
    parsed
  };
}

/**
 * Create directory structure for the project
 * @param {string} projectDir - Project root directory
 * @param {Object} parsed - Parsed response data
 */
async function createProjectStructure(projectDir, parsed) {
  const structure = parsed.projectStructure || parsed.structure || {};
  const overview = parsed.overview || {};
  const projectName = overview.projectName || 'ProtoForge Project';
  
  // Create default structure if not provided
  const defaultDirs = ['src', 'tests', 'docs', 'config'];
  
  for (const dir of defaultDirs) {
    await fs.promises.mkdir(path.join(projectDir, dir), { recursive: true });
  }
  
  // Create type-specific directories
  if (parsed.techStack?.recommendations) {
    const techs = parsed.techStack.recommendations.map(r => r.toLowerCase());
    if (techs.some(t => t.includes('react') || t.includes('vue') || t.includes('angular'))) {
      await fs.promises.mkdir(path.join(projectDir, 'src', 'components'), { recursive: true });
      await fs.promises.mkdir(path.join(projectDir, 'src', 'pages'), { recursive: true });
    }
    if (techs.some(t => t.includes('python'))) {
      await fs.promises.mkdir(path.join(projectDir, 'src', 'modules'), { recursive: true });
      await fs.promises.mkdir(path.join(projectDir, 'tests'), { recursive: true });
    }
  }
}

/**
 * Write all code snippets to files
 * @param {string} projectDir - Project directory path
 * @param {Object} parsed - Parsed response data
 * @returns {Promise<Array>} List of created files
 */
async function writeCodeSnippets(projectDir, parsed) {
  const files = [];
  const codeSnippets = parsed.codeSnippets || parsed.files || [];
  
  for (const snippet of codeSnippets) {
    const fileName = snippet.fileName || snippet.filename || snippet.name;
    const code = snippet.code || snippet.content;
    const language = snippet.language || snippet.extension || 'txt';
    
    if (!fileName || !code) continue;
    
    const filePath = path.join(projectDir, fileName);
    const dir = path.dirname(filePath);
    
    // Ensure directory exists
    await fs.promises.mkdir(dir, { recursive: true });
    
    // Write file
    await fs.promises.writeFile(filePath, code, 'utf-8');
    files.push({
      name: fileName,
      path: filePath,
      language
    });
  }
  
  return files;
}

/**
 * Write project documentation
 * @param {string} projectDir - Project directory path
 * @param {Object} parsed - Parsed response data
 * @param {string} originalDescription - Original user description
 */
async function writeDocumentation(projectDir, parsed, originalDescription) {
  const overview = parsed.overview || {};
  const techStack = parsed.techStack || {};
  const implementation = parsed.implementation || {};
  
  const readme = `# ${overview.projectName || 'ProtoForge Project'}\n\n` +
    `## Description\n${overview.description || originalDescription}\n\n` +
    `## Tech Stack\n${(techStack.recommendations || []).map(t => `- ${t}`).join('\n')}\n\n` +
    `## Architecture\n${implementation.architecture || 'See schematic diagram'}\n\n` +
    `## Quick Start\n\n` +
    `\`\`\`bash\n` +
    `${implementation.setupInstructions || '# Install dependencies\nnpm install\n\n# Run development server\nnpm run dev\n'}\n` +
    `\`\`\`\n\n` +
    `## Project Structure\n\n\`\`\`\n${implementation.fileStructure || 'See file tree'}\n\`\`\`\n`;
  
  await fs.promises.writeFile(path.join(projectDir, 'README.md'), readme, 'utf-8');
  
  // Write additional docs if present
  if (parsed.guides) {
    for (const guide of parsed.guides) {
      const guidePath = path.join(projectDir, 'docs', `${guide.title || 'guide'}.md`);
      await fs.promises.writeFile(guidePath, `# ${guide.title}\n\n${guide.content}`, 'utf-8');
    }
  }
}

/**
 * Generate and save diagram files
 * @param {string} projectDir - Project directory path
 * @param {Object} parsed - Parsed response data
 */
async function generateDiagrams(projectDir, parsed) {
  const schematic = parsed.schematic || parsed.diagram || {};
  
  // Save Mermaid diagram
  if (schematic.mermaid) {
    const mermaidPath = path.join(projectDir, 'docs', 'architecture.mmd');
    await fs.promises.writeFile(mermaidPath, schematic.mermaid, 'utf-8');
    
    // Also save as .mm for compatibility
    await fs.promises.writeFile(path.join(projectDir, 'docs', 'architecture.mermaid'), schematic.mermaid, 'utf-8');
  }
  
  // Save circuit diagram if hardware project
  if (schematic.circuit) {
    const circuitPath = path.join(projectDir, 'docs', 'circuit.txt');
    await fs.promises.writeFile(circuitPath, schematic.circuit, 'utf-8');
  }
}

/**
 * Generate Bill of Materials for hardware projects
 * @param {string} projectDir - Project directory path
 * @param {Object} parsed - Parsed response data
 */
async function generateBOM(projectDir, parsed) {
  const bom = parsed.bom || parsed.billOfMaterials || {};
  const components = bom.components || [];
  
  if (components.length === 0) return;
  
  const bomContent = `# Bill of Materials\n\n` +
    `| Component | Quantity | Description | Notes |\n` +
    `|-----------|----------|-------------|-------|\n` +
    components.map(c => 
      `| ${c.name || c.component} | ${c.quantity || c.count || 1} | ${c.description || ''} | ${c.notes || ''} |`
    ).join('\n') + '\n\n' +
    `**Total Estimated Cost:** ${bom.totalCost || 'N/A'}\n\n` +
    `**Supplier Notes:** ${bom.supplierNotes || 'See individual component datasheets'}\n`;
  
  await fs.promises.writeFile(path.join(projectDir, 'docs', 'BOM.md'), bomContent, 'utf-8');
}

/**
 * Create a ZIP archive of the project
 * @param {string} projectDir - Project directory path
 * @param {string} outputName - Output filename (without extension)
 * @returns {Promise<string>} Path to created ZIP file
 */
export async function createProjectZip(projectDir, outputName = null) {
  const zip = new JSZip();
  const baseName = outputName || path.basename(projectDir);
  
  // Add all files to ZIP
  await addDirToZip(zip, projectDir, '');
  
  // Generate ZIP file
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  const zipPath = `${projectDir}.zip`;
  await fs.promises.writeFile(zipPath, zipBuffer);
  
  return zipPath;
}

/**
 * Recursively add directory contents to ZIP
 * @param {JSZip} zip - JSZip instance
 * @param {string} dir - Directory path
 * @param {string} zipPath - Current path within ZIP
 */
async function addDirToZip(zip, dir, zipPath) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(zipPath, entry.name);
    
    // Skip hidden files and node_modules
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    
    if (entry.isDirectory()) {
      await addDirToZip(zip, fullPath, relativePath);
    } else if (entry.isFile()) {
      const content = await fs.promises.readFile(fullPath);
      zip.file(relativePath, content);
    }
  }
}

/**
 * Get file tree as string
 * @param {string} dir - Directory path
 * @param {string} prefix - Prefix for indentation
 * @returns {string} File tree string
 */
export async function getFileTree(dir, prefix = '') {
  let tree = '';
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  
  // Sort: directories first, then files, alphabetically
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });
  
  for (const entry of entries) {
    // Skip hidden files
    if (entry.name.startsWith('.')) continue;
    
    const fullPath = path.join(dir, entry.name);
    const isLast = entry === entries[entries.length - 1];
    
    if (entry.isDirectory()) {
      tree += `${prefix}${isLast ? '└── ' : '├── '}${entry.name}/\n`;
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      tree += await getFileTree(fullPath, newPrefix);
    } else {
      tree += `${prefix}${isLast ? '└── ' : '├── '}${entry.name}\n`;
    }
  }
  
  return tree;
}

/**
 * Clean up project output directory
 * @param {string} projectDir - Project directory path
 */
export async function cleanupProject(projectDir) {
  if (fs.existsSync(projectDir)) {
    await fs.promises.rm(projectDir, { recursive: true, force: true });
  }
}

export default {
  parseAIResponse,
  generateProjectFromResponse,
  createProjectZip,
  getFileTree,
  cleanupProject
};
export { parseAIResponse, generateProjectFromResponse, createProjectZip, getFileTree, cleanupProject };
