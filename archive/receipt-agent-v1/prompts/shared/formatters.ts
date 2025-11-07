/**
 * Prompt formatting utilities
 */

/**
 * Formats a list of items for inclusion in prompts
 * @param items - Array of items to format
 * @param numbered - Whether to number the items
 * @returns Formatted string
 */
export function formatList(items: string[], numbered: boolean = true): string {
  if (numbered) {
    return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
  }
  return items.map(item => `- ${item}`).join('\n');
}

/**
 * Formats transaction history for context
 * @param history - Array of historical transactions
 * @returns Formatted history string
 */
export function formatTransactionHistory(
  history: Array<{ merchant: string; category: string; amount: string }>
): string {
  if (history.length === 0) {
    return 'No previous transactions found.';
  }
  
  return history
    .map((t, i) => `${i + 1}. ${t.merchant} - ${t.category} (${t.amount})`)
    .join('\n');
}

/**
 * Cleans LLM response by removing markdown code blocks
 * @param response - Raw LLM response
 * @returns Cleaned response
 */
export function cleanJsonResponse(response: string): string {
  let cleaned = response.trim();
  cleaned = cleaned.replace(/```json\s*/g, '');
  cleaned = cleaned.replace(/```\s*/g, '');
  return cleaned.trim();
}
