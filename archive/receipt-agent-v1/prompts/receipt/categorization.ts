/**
 * Transaction categorization prompts
 */

// Note: Using type imports to avoid circular dependencies
// These types are re-exported from their respective modules

/**
 * Available spending categories for transaction classification
 */
export const CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Healthcare',
  'Groceries',
  'Personal Care',
  'Education',
  'Travel & Vacation',
  'Tech Gadgets',
  'Subscriptions',
  'Others',
] as const;

export type Category = typeof CATEGORIES[number];

/**
 * Builds the categorization prompt with transaction details and historical context
 * @param transactionData - The extracted transaction data
 * @param history - Similar transactions from user's history
 * @returns Structured prompt for the LLM
 */
export function buildCategorizationPrompt(
  transactionData: any,
  history: any[]
): string {
  const historyContext = history.length > 0
    ? `\n\n**User's Transaction History for Similar Merchants:**\n${history
      .map(
        (t, i) =>
          `${i + 1}. ${t.merchant_name} - ${t.category} (${t.currency} ${t.amount})`
      )
      .join('\n')}`
    : '\n\n**No previous transactions found for this merchant.**';

  return `You are an expert at categorizing spending transactions. Analyze the transaction details and assign it to the most appropriate category.

**Transaction Details:**
- Merchant: ${transactionData.merchantName}
- Amount: ${transactionData.currency} ${transactionData.amount}
- Payment Method: ${transactionData.paymentMethod}
- Date/Time: ${transactionData.dateTime}
${transactionData.items && transactionData.items.length > 0
      ? `- Items: ${transactionData.items.map((item: any) => item.name).join(', ')}`
      : ''}
${historyContext}

**Available Categories:**
${CATEGORIES.map((cat, i) => `${i + 1}. ${cat}`).join('\n')}

**Categorization Guidelines:**
- Use the merchant name as the primary indicator
- Consider the items purchased if available
- Learn from the user's history - if they've categorized this merchant before, strongly prefer that category
- Be consistent with similar merchants (e.g., all restaurants should be "Food & Dining")
- Use "Groceries" for supermarkets and grocery stores
- Use "Food & Dining" for restaurants, cafes, and food delivery
- Use "Transportation" for ride-sharing, public transport, fuel, parking
- Use "Bills & Utilities" for recurring services like electricity, water, internet, phone
- Use "Shopping" for retail purchases, clothing, general merchandise
- Use "Entertainment" for movies, games, concerts, events
- Use "Healthcare" for medical, dental, pharmacy, insurance
- Use "Personal Care" for salons, spas, cosmetics
- Use "Education" for courses, books, tuition
- Use "Travel & Vacation" for flights, hotels, travel agencies, vacation packages, tourist attractions
- Use "Tech Gadgets" for electronics, computers, smartphones, tablets, tech accessories, software purchases
- Use "Subscriptions" for recurring digital services like Netflix, Spotify, cloud storage, software subscriptions, memberships
- Use "Others" only when no other category fits

**Confidence Scoring:**
- High confidence (0.8-1.0): Clear merchant type, matches history, or obvious category
- Medium confidence (0.5-0.8): Reasonable guess but some ambiguity
- Low confidence (0.0-0.5): Unclear merchant type or conflicting signals

**Response Format:**
Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):

{
  "category": "Category Name",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this category was chosen",
  "alternativeCategories": ["Alternative 1", "Alternative 2"]
}

The "alternativeCategories" should contain 2-3 other plausible categories, ordered by likelihood.

Now categorize this transaction:`;
}
