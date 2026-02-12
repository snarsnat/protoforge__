import { describe, expect, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { generateProjectFromResponse } from '../lib/core/output.js';

describe('output generation', () => {
  test('generates expected structure and files', async () => {
    const projectDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'protoforge-out-'));

    const response = JSON.stringify({
      overview: { projectName: 'Demo', description: 'demo' },
      techStack: { software: ['node'] },
      codeSnippets: [{ filename: 'hello.txt', language: 'txt', code: 'hi' }],
      schematic: { mermaid: 'graph TD;A-->B;' },
      bom: [{ partNumber: 'X', description: 'Y', quantity: 1, unitPrice: '1.00' }],
      nextSteps: ['ship']
    });

    const result = await generateProjectFromResponse(response, projectDir, 'demo');
    expect(result.success).toBe(true);

    // Required directories
    for (const d of ['code', 'docs', 'schematics']) {
      expect(fs.existsSync(path.join(projectDir, d))).toBe(true);
    }

    // Prototype files
    expect(fs.existsSync(path.join(projectDir, 'prototype.raw.txt'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'prototype.json'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'report.md'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'bom.csv'))).toBe(true);

    // Code file written under code/
    expect(fs.existsSync(path.join(projectDir, 'code', 'hello.txt'))).toBe(true);
    const code = await fs.promises.readFile(path.join(projectDir, 'code', 'hello.txt'), 'utf-8');
    expect(code).toBe('hi');

    // Diagram
    expect(fs.existsSync(path.join(projectDir, 'schematics', 'diagram.mmd'))).toBe(true);

    await fs.promises.rm(projectDir, { recursive: true, force: true });
  }, 20000);
});
