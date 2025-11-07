/**
 * Category suggestion prompt for low-confidence scenarios
 */

import { CATEGORIES } from './categorization';

/**
 * Builds a prompt to suggest alternative categories for a transaction
 * @param transactionData - The extracted transaction data
 * @returns Prompt for suggesting categories
 */
export function buildSuggestionPrompt(transactionData: any): string {
  return `Given this transaction, suggest 3 most likely spending categories in order of likelihood:

Merchant: ${transactionData.merchantName}
Amount: ${transactionData.currency} ${transactionData.amount}
${transactionData.items && transactionData.items.length > 0
    ? `Items: ${transactionData.items.map((item: any) => item.name).join(', ')}`
    : ''}

Available categories: ${CATEGORIES.join(', ')}

Return ONLY a JSON array of 3 category names, like: ["Category1", "Category2", "Category3"]`;
}
