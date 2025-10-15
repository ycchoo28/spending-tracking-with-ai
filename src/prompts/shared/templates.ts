/**
 * Shared prompt templates and patterns
 */

/**
 * Standard JSON response format instruction
 */
export const JSON_RESPONSE_INSTRUCTION = `Return ONLY a valid JSON object (no markdown, no code blocks).`;

/**
 * Confidence scoring guidelines
 */
export const CONFIDENCE_GUIDELINES = `**Confidence Scoring:**
- High confidence (0.8-1.0): Clear and unambiguous
- Medium confidence (0.5-0.8): Reasonable guess with some ambiguity
- Low confidence (0.0-0.5): Unclear or conflicting signals`;

/**
 * Wraps a prompt with system role context
 * @param role - The role description
 * @param prompt - The main prompt content
 * @returns Formatted prompt with role
 */
export function withSystemRole(role: string, prompt: string): string {
  return `You are ${role}.\n\n${prompt}`;
}

/**
 * Adds JSON format validation reminder
 * @param prompt - The main prompt
 * @returns Prompt with JSON format reminder
 */
export function withJsonFormat(prompt: string): string {
  return `${prompt}\n\n${JSON_RESPONSE_INSTRUCTION}`;
}
