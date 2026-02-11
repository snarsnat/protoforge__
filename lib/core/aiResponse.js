/**
 * ProtoForge AI Response Parsing + Validation
 *
 * Goal: robustly extract JSON from LLM output (markdown, chatter, partials)
 * and validate it against a flexible schema.
 */

import { z } from 'zod';

// ---- Schema (intentionally flexible; we accept extra keys) ----

const CodeSnippetSchema = z
  .object({
    fileName: z.string().optional(),
    filename: z.string().optional(),
    name: z.string().optional(),
    path: z.string().optional(),

    language: z.string().optional(),
    extension: z.string().optional(),

    code: z.string().optional(),
    content: z.string().optional()
  })
  .passthrough();

const BomItemSchema = z
  .object({
    partNumber: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    quantity: z.union([z.number(), z.string()]).optional(),
    unitPrice: z.union([z.number(), z.string()]).optional(),
    link: z.string().optional()
  })
  .passthrough();

const TechStackSchema = z
  .object({
    hardware: z.array(z.string()).optional(),
    software: z.array(z.string()).optional(),
    protocols: z.array(z.string()).optional(),
    tools: z.array(z.string()).optional(),

    hw: z.array(z.string()).optional(),
    softwareStack: z.array(z.string()).optional()
  })
  .passthrough();

export const PrototypeSchema = z
  .object({
    overview: z
      .object({
        projectName: z.string().optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        difficulty: z.string().optional(),
        estimatedTime: z.string().optional()
      })
      .passthrough()
      .optional(),

    techStack: TechStackSchema.optional(),

    // Code can appear under either key depending on provider/prompt.
    codeSnippets: z.array(CodeSnippetSchema).optional(),
    files: z.array(CodeSnippetSchema).optional(),

    schematic: z.union([
      z.string(),
      z.object({ mermaid: z.string().optional(), diagram: z.string().optional() }).passthrough()
    ]).optional(),

    diagram: z.object({ mermaid: z.string().optional() }).passthrough().optional(),

    bom: z.union([
      z.array(BomItemSchema),
      z.object({ components: z.array(BomItemSchema).optional() }).passthrough()
    ]).optional(),
    billOfMaterials: z.union([
      z.array(BomItemSchema),
      z.object({ components: z.array(BomItemSchema).optional() }).passthrough()
    ]).optional(),

    buildGuide: z.union([z.string(), z.array(z.string()), z.record(z.any())]).optional(),
    issuesAndFixes: z.array(z.record(z.any())).optional(),
    nextSteps: z.array(z.string()).optional(),
    guides: z.array(z.object({ title: z.any().optional(), content: z.any().optional() }).passthrough()).optional(),

    threeDHtml: z.string().optional(),

    // keep room for more
  })
  .passthrough();

// ---- Extraction helpers ----

/**
 * Extract the "best" JSON candidate from a free-form LLM response.
 * Strategy:
 * 1) Prefer fenced code block ```json ...```
 * 2) Fallback to the first {...} block (from first '{' to last '}')
 */
export function extractJsonCandidate(text) {
  if (typeof text !== 'string') return '';

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1).trim();
  }

  return trimmed;
}

/**
 * Parse JSON with helpful error context.
 */
export function parseJsonOrThrow(jsonStr, { sourceText } = {}) {
  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    const prefix = (jsonStr || '').slice(0, 800);
    const suffix = (jsonStr || '').slice(-800);

    const message =
      `Failed to parse JSON from AI response. ` +
      `Tip: ensure the model outputs a single JSON object (no trailing commentary).\n\n` +
      `Parse error: ${err?.message || String(err)}\n\n` +
      `--- JSON candidate (start) ---\n${prefix}\n--- JSON candidate (end) ---\n${suffix}\n`;

    const e = new Error(message);
    e.name = 'ProtoForgeParseError';
    e.cause = err;
    e.rawResponse = sourceText;
    e.jsonCandidate = jsonStr;
    throw e;
  }
}

/**
 * Extract -> parse -> validate.
 * Returns: { parsed, warnings }
 */
export function parseAndValidateAIResponse(text) {
  const candidate = extractJsonCandidate(text);
  const obj = parseJsonOrThrow(candidate, { sourceText: text });

  const validation = PrototypeSchema.safeParse(obj);
  if (!validation.success) {
    const issues = validation.error.issues
      .slice(0, 25)
      .map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');

    const message =
      `AI response JSON parsed but did not match expected structure.\n` +
      `This usually means the model returned the wrong shape or missing fields.\n\n` +
      `${issues}\n\n` +
      `Tip: Try re-running with a stricter model or ask the provider to output JSON only.`;

    const e = new Error(message);
    e.name = 'ProtoForgeValidationError';
    e.rawResponse = text;
    e.parsed = obj;
    throw e;
  }

  const warnings = [];
  const parsed = validation.data;

  // Soft warnings (don’t fail generation)
  const codeSnippets = parsed.codeSnippets || parsed.files || [];
  if (!Array.isArray(codeSnippets) || codeSnippets.length === 0) {
    warnings.push('No codeSnippets/files array found; output may be documentation-only.');
  }

  return { parsed, warnings };
}
