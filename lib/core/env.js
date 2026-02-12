/**
 * User environment loading + .env helpers
 *
 * ProtoForge uses environment variables for provider API keys, similar to OpenClaw.
 * We support a user-level env file at: ~/.protoforge/.env
 */

import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import dotenv from 'dotenv';

let loaded = false;

export function getUserEnvPath() {
  return path.join(os.homedir(), '.protoforge', '.env');
}

export function loadUserEnv() {
  if (loaded) return;
  const envPath = getUserEnvPath();
  try {
    dotenv.config({ path: envPath, override: false });
  } catch {
    // ignore
  }
  loaded = true;
}

/**
 * Upsert a KEY=value entry in ~/.protoforge/.env
 * Preserves existing lines/comments.
 */
export async function upsertUserEnvVar(key, value) {
  const envPath = getUserEnvPath();
  await fs.ensureDir(path.dirname(envPath));

  const exists = await fs.pathExists(envPath);
  const raw = exists ? await fs.readFile(envPath, 'utf-8') : '';
  const lines = raw.split(/\r?\n/);

  const kvLine = `${key}=${escapeEnvValue(value)}`;

  let found = false;
  const out = lines.map((line) => {
    if (line.trim().startsWith('#') || !line.includes('=')) return line;
    const idx = line.indexOf('=');
    const k = line.slice(0, idx).trim();
    if (k === key) {
      found = true;
      return kvLine;
    }
    return line;
  });

  if (!found) {
    if (out.length && out[out.length - 1].trim() !== '') out.push('');
    out.push(kvLine);
  }

  await fs.writeFile(envPath, out.join('\n').replace(/\n{3,}/g, '\n\n'), 'utf-8');
}

function escapeEnvValue(v) {
  const s = String(v ?? '');
  // Quote if it contains spaces or special chars.
  if (/[^A-Za-z0-9_\-.,/:@]/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
}
