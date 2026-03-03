/**
 * Sanitizes user-provided strings before injection into LLM system prompts.
 *
 * Prevents prompt injection by:
 * 1. Stripping known injection patterns (role overrides, instruction overrides)
 * 2. Removing XML/markdown-style delimiters that could break prompt structure
 * 3. Truncating excessively long inputs
 */

const INJECTION_PATTERNS = [
  // Role/identity overrides
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/gi,
  /you\s+are\s+now\s+/gi,
  /act\s+as\s+(if\s+you\s+are\s+)?/gi,
  /pretend\s+(to\s+be|you\s+are)\s+/gi,
  /your\s+new\s+(instructions?|role|persona)\s+(is|are)/gi,
  /disregard\s+(all\s+)?(previous|prior|above)/gi,
  /forget\s+(everything|all|your)\s+(previous|prior|above)/gi,
  // System prompt manipulation
  /system\s*:\s*/gi,
  /\[system\]/gi,
  /\[INST\]/gi,
  /<<\s*SYS\s*>>/gi,
  /<\|im_start\|>/gi,
  // Instruction injection
  /IMPORTANT\s*:/gi,
  /CRITICAL\s*:/gi,
  /OVERRIDE\s*:/gi,
  /NEW\s+INSTRUCTIONS?\s*:/gi,
  /REGRA\s*#?\d*\s*:/gi,
];

const MAX_FIELD_LENGTH: Record<string, number> = {
  business_name: 100,
  bot_name: 50,
  description: 500,
  location: 200,
  website: 200,
  greeting_message: 300,
  unavailable_message: 300,
  confirmation_message: 500,
  ai_instructions: 1000,
};

const DEFAULT_MAX_LENGTH = 200;

/**
 * Sanitizes a single field value for safe prompt injection.
 *
 * @param value - The raw user input
 * @param fieldName - The field name (for length limits)
 * @returns Sanitized string safe for prompt inclusion
 */
export function sanitizePromptField(value: string, fieldName?: string): string {
  if (!value) return value;

  let sanitized = value;

  // Strip injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Remove XML-style tags that could break prompt structure
  sanitized = sanitized.replace(/<\/?[a-zA-Z_][a-zA-Z0-9_-]*(?:\s[^>]*)?>/g, '');

  // Collapse multiple whitespace/newlines left by removals
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n').replace(/\s{2,}/g, ' ').trim();

  // Truncate to max length
  const maxLen = (fieldName && MAX_FIELD_LENGTH[fieldName]) || DEFAULT_MAX_LENGTH;
  if (sanitized.length > maxLen) {
    sanitized = sanitized.slice(0, maxLen);
  }

  return sanitized;
}

/**
 * Wraps user-provided data in clear delimiters for the LLM.
 * This helps the model distinguish between system instructions and user data.
 */
export function delimitUserData(label: string, value: string): string {
  if (!value) return '';
  return `[${label}: ${value}]`;
}
