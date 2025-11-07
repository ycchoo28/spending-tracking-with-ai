/**
 * Transaction Agent - Neu-Translator Style
 * 
 * Key differences from current implementation:
 * 1. No LangGraph - simple while loop
 * 2. LLM decides which tool to call via tool calling
 * 3. Tools are self-contained with schemas
 * 4. Human-in-loop built into tool execution
 * 5. State is just message history + context
 */

import { generateText, tool, type ToolCallPart, type ToolResultPart, type ModelMessage } from "ai";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";

// ============================================================================
// TYPES
// ============================================================================

type NextActor = "user" | "agent";

type ToolExecutor<TInput = any, TOutput = any> = (
  input: TInput,
  options: { name: string; callId: string },
  userResponse?: UserResponse
) => Promise<
  | { type: "user-request"; payload: UserRequest }
  | { type: "tool-result"; payload: TOutput }
>;

type UserRequest = {
  tool: { name: string; callId: string };
  message: string;
  data?: any;
};

type UserResponse = {
  tool: { name: string; callId: string };
  userInput: string;
  parsedData?: any;
};

type TransactionData = {
  merchantName: string;
  amount: number;
  currency: string;
  category: string;
  dateTime: string;
  paymentMethod: string;
  confidence: number;
};

// ============================================================================
// CONTEXT MANAGEMENT
// ============================================================================

class TransactionContext {
  private messages: ModelMessage[] = [];
  private userResponses: UserResponse[] = [];
  private transactionData: Partial<TransactionData> = {};
  
  constructor(
    private userId: string,
    private conversationId: string,
    private imageData?: Buffer
  ) {}

  addMessages(messages: ModelMessage[]) {
    this.messages.push(...messages);
  }

  addUserResponse(response: UserResponse) {
    this.userResponses.push(response);
  }

  getUserResponse(toolCallId: string): UserResponse | undefined {
    return this.userResponses.find(r => r.tool.callId === toolCallId);
  }

  getMessages(): ModelMessage[] {
    return this.messages;
  }

  updateTransactionData(data: Partial<TransactionData>) {
    this.transactionData = { ...this.transactionData, ...data };
  }

  getTransactionData(): Partial<TransactionData> {
    return this.transactionData;
  }

  getImageData(): Buffer | undefined {
    return this.imageData;
  }
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

// Tool 1: Extract Receipt Data
const extractReceiptTool = tool({
  name: "extract_receipt",
  description: `Extract transaction data from a receipt image.
  
Use this tool when:
- User sends a receipt image
- You need to get merchant name, amount, date, etc.
- This is typically the first step

The tool will use vision AI to extract structured data from the image.`,
  
  parameters: z.object({
    reason: z.string().describe("Why you're extracting the receipt now")
  }),
  
  // No output schema needed - will be in tool result
});

const extractReceiptExecutor: ToolExecutor = async (input, options, userResponse) => {
  // In real implementation, call vision API
  // For now, simulate extraction
  
  const mockExtraction: TransactionData = {
    merchantName: "Starbucks",
    amount: 15.50,
    currency: "MYR",
    category: "",
    dateTime: new Date().toISOString(),
    paymentMethod: "Credit Card",
    confidence: 0.85
  };

  return {
    type: "tool-result",
    payload: {
      success: true,
      data: mockExtraction,
      message: "Extracted transaction data from receipt"
    }
  };
};

// Tool 2: Request Missing Information
const requestInfoTool = tool({
  name: "request_info",
  description: `Request missing or unclear information from the user.

Use this tool when:
- Merchant name is missing or unclear
- Amount is missing or unclear  
- Any critical field needs clarification
- You want to confirm extracted data with user

This will pause the agent and wait for user response.`,

  parameters: z.object({
    field: z.enum(["merchant", "amount", "category", "confirmation"]).describe("Which field to request"),
    currentValue: z.string().optional().describe("Current value if any"),
    reason: z.string().describe("Why you need this information"),
    suggestedQuestion: z.string().describe("The question to ask the user")
  })
});

const requestInfoExecutor: ToolExecutor = async (input, options, userResponse) => {
  // If no user response yet, request it
  if (!userResponse) {
    return {
      type: "user-request",
      payload: {
        tool: { name: options.name, callId: options.callId },
        message: input.suggestedQuestion,
        data: {
          field: input.field,
          currentValue: input.currentValue
        }
      }
    };
  }

  // User responded, parse their input
  const parsedValue = userResponse.parsedData || userResponse.userInput;

  return {
    type: "tool-result",
    payload: {
      field: input.field,
      value: parsedValue,
      userInput: userResponse.userInput,
      message: `User provided ${input.field}: ${parsedValue}`
    }
  };
};

// Tool 3: Categorize Transaction
const categorizeTool = tool({
  name: "categorize_transaction",
  description: `Automatically categorize the transaction based on merchant and context.

Use this tool when:
- You have merchant name and amount
- Category is missing
- You want to suggest a category to the user

Returns suggested categories with confidence scores.`,

  parameters: z.object({
    merchantName: z.string(),
    amount: z.number(),
    userContext: z.string().optional().describe("Any context from user's message")
  })
});

const categorizeExecutor: ToolExecutor = async (input, options, userResponse) => {
  // Simple categorization logic
  const merchant = input.merchantName.toLowerCase();
  
  let category = "Other";
  let confidence = 0.5;
  let suggestions = ["Other"];

  if (merchant.includes("starbucks") || merchant.includes("coffee")) {
    category = "Food & Dining";
    confidence = 0.9;
    suggestions = ["Food & Dining", "Coffee Shops"];
  } else if (merchant.includes("grab") || merchant.includes("uber")) {
    category = "Transportation";
    confidence = 0.9;
    suggestions = ["Transportation", "Ride Sharing"];
  }

  // If confidence is low, might want to ask user
  if (confidence < 0.7 && !userResponse) {
    return {
      type: "user-request",
      payload: {
        tool: { name: options.name, callId: options.callId },
        message: `I think this is "${category}" but I'm not sure. What category should this be?`,
        data: { suggestions }
      }
    };
  }

  return {
    type: "tool-result",
    payload: {
      category: userResponse?.parsedData || category,
      confidence,
      suggestions,
      message: `Categorized as: ${category}`
    }
  };
};

// Tool 4: Validate Transaction
const validateTool = tool({
  name: "validate_transaction",
  description: `Validate that all required transaction fields are present and valid.

Use this tool to:
- Check if merchant name exists and is valid
- Check if amount is present and positive
- Check if category is assigned
- Get validation status before storing

Returns which fields are missing or invalid.`,

  parameters: z.object({
    transactionData: z.object({
      merchantName: z.string().optional(),
      amount: z.number().optional(),
      category: z.string().optional()
    })
  })
});

const validateExecutor: ToolExecutor = async (input) => {
  const data = input.transactionData;
  const issues: string[] = [];
  const missing: string[] = [];

  if (!data.merchantName || data.merchantName === "" || data.merchantName === "Unknown") {
    missing.push("merchant");
    issues.push("Merchant name is missing or unclear");
  }

  if (!data.amount || data.amount <= 0) {
    missing.push("amount");
    issues.push("Amount is missing or invalid");
  }

  if (!data.category || data.category === "") {
    missing.push("category");
    issues.push("Category is not assigned");
  }

  const isValid = issues.length === 0;

  return {
    type: "tool-result",
    payload: {
      isValid,
      missing,
      issues,
      message: isValid 
        ? "All fields are valid" 
        : `Validation failed: ${issues.join(", ")}`
    }
  };
};

// Tool 5: Store Transaction
const storeTransactionTool = tool({
  name: "store_transaction",
  description: `Store the validated transaction to the database.

Use this tool when:
- All required fields are validated
- You're ready to save the transaction
- This is typically the final step

Returns the transaction ID on success.`,

  parameters: z.object({
    transactionData: z.object({
      merchantName: z.string(),
      amount: z.number(),
      currency: z.string(),
      category: z.string(),
      dateTime: z.string(),
      paymentMethod: z.string()
    }),
    confirmWithUser: z.boolean().optional().describe("Whether to confirm with user before storing")
  })
});

const storeTransactionExecutor: ToolExecutor = async (input, options, userResponse) => {
  // If confirmation requested and no response yet
  if (input.confirmWithUser && !userResponse) {
    const data = input.transactionData;
    return {
      type: "user-request",
      payload: {
        tool: { name: options.name, callId: options.callId },
        message: `Ready to save this transaction:

🏪 ${data.merchantName}
💰 ${data.currency} ${data.amount.toFixed(2)}
📁 ${data.category}
📅 ${new Date(data.dateTime).toLocaleDateString()}

Should I save this?`,
        data: input.transactionData
      }
    };
  }

  // Check if user confirmed (if confirmation was requested)
  if (input.confirmWithUser && userResponse) {
    const confirmed = userResponse.userInput.toLowerCase().includes("yes") ||
                     userResponse.userInput.toLowerCase().includes("ok") ||
                     userResponse.userInput.toLowerCase().includes("save");
    
    if (!confirmed) {
      return {
        type: "tool-result",
        payload: {
          success: false,
          message: "Transaction not saved - user cancelled"
        }
      };
    }
  }

  // Store to database (mock)
  const transactionId = `txn_${Date.now()}`;

  return {
    type: "tool-result",
    payload: {
      success: true,
      transactionId,
      message: `✅ Transaction saved! ID: ${transactionId}`
    }
  };
};

// ============================================================================
// AGENT LOOP
// ============================================================================

class TransactionAgentLoop {
  private context: TransactionContext;
  private llm: ChatOpenAI;
  private tools: Record<string, any>;
  private toolExecutors: Record<string, ToolExecutor>;

  constructor(
    userId: string,
    conversationId: string,
    imageData?: Buffer
  ) {
    this.context = new TransactionContext(userId, conversationId, imageData);
    this.llm = new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 });
    
    this.tools = {
      extract_receipt: extractReceiptTool,
      request_info: requestInfoTool,
      categorize_transaction: categorizeTool,
      validate_transaction: validateTool,
      store_transaction: storeTransactionTool
    };

    this.toolExecutors = {
      extract_receipt: extractReceiptExecutor,
      request_info: requestInfoExecutor,
      categorize_transaction: categorizeExecutor,
      validate_transaction: validateExecutor,
      store_transaction: storeTransactionExecutor
    };
  }

  async next(): Promise<{
    actor: NextActor;
    userRequests: UserRequest[];
    messages: ModelMessage[];
    completed: boolean;
  }> {
    // Get unprocessed tool calls
    const unprocessedToolCalls = this.getUnprocessedToolCalls();

    // If there are pending tool calls, execute them
    if (unprocessedToolCalls.length > 0) {
      const userResponseMap = this.getUserResponseMap(unprocessedToolCalls);
      
      const results = await Promise.all(
        unprocessedToolCalls.map(call => 
          this.executeTool(call, userResponseMap[call.toolCallId])
        )
      );

      const toolResults: ToolResultPart[] = [];
      const userRequests: UserRequest[] = [];

      for (const result of results) {
        if (result.type === "tool-result-part") {
          toolResults.push(result.payload);
          
          // Update transaction data if tool returned data
          if (result.payload.result?.data) {
            this.context.updateTransactionData(result.payload.result.data);
          }
        } else {
          userRequests.push(result.payload);
        }
      }

      // If we have user requests, pause and return
      if (userRequests.length > 0) {
        return {
          actor: "agent",
          userRequests,
          messages: this.context.getMessages(),
          completed: false
        };
      }

      // Add tool results to context
      if (toolResults.length > 0) {
        this.context.addMessages([{
          role: "tool",
          content: toolResults
        }]);
      }

      // Continue to next iteration
      return this.next();
    }

    // No pending tools, call LLM to decide next action
    const systemPrompt = this.buildSystemPrompt();
    const messages = this.context.getMessages();

    const { response } = await generateText({
      model: this.llm,
      system: systemPrompt,
      messages,
      tools: this.tools
    });

    // Add LLM response to context
    this.context.addMessages(response.messages);

    // Check if we have new tool calls
    const lastMessage = response.messages[response.messages.length - 1];
    const hasToolCalls = lastMessage.role === "assistant" && 
                        Array.isArray(lastMessage.content) &&
                        lastMessage.content.some(p => p.type === "tool-call");

    if (hasToolCalls) {
      // Continue loop to execute tools
      return this.next();
    }

    // No tool calls, check if completed
    const completed = this.isCompleted();

    return {
      actor: "user",
      userRequests: [],
      messages: this.context.getMessages(),
      completed
    };
  }

  async addUserInput(message: string) {
    this.context.addMessages([{
      role: "user",
      content: [{ type: "text", text: message }]
    }]);
  }

  async addUserResponse(response: UserResponse) {
    this.context.addUserResponse(response);
  }

  private buildSystemPrompt(): string {
    const transactionData = this.context.getTransactionData();
    const hasImage = !!this.context.getImageData();

    return `You are a transaction processing assistant. Your job is to help users record their expenses from receipts.

Current transaction data:
${JSON.stringify(transactionData, null, 2)}

Available context:
- User has ${hasImage ? "uploaded" : "not uploaded"} a receipt image
- Conversation ID: ${this.context["conversationId"]}

Your workflow:
1. If user sent an image and you haven't extracted it yet, use extract_receipt
2. If any required fields (merchant, amount) are missing, use request_info to ask user
3. If category is missing, use categorize_transaction to suggest one
4. Before storing, use validate_transaction to check all fields
5. When everything is valid, use store_transaction to save

Guidelines:
- Be conversational and helpful
- Don't ask for information the user already provided
- If user gives approximate values, ask for confirmation
- Always validate before storing
- Keep responses concise

Remember: You decide which tool to use based on the current state. Think about what's missing and what to do next.`;
  }

  private getUnprocessedToolCalls(): ToolCallPart[] {
    const messages = this.context.getMessages();
    const pending: Record<string, ToolCallPart> = {};

    for (const msg of messages) {
      if (msg.role === "assistant" && Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === "tool-call") {
            pending[part.toolCallId] = part;
          }
        }
      }

      if (msg.role === "tool") {
        for (const part of msg.content) {
          if (part.type === "tool-result") {
            delete pending[part.toolCallId];
          }
        }
      }
    }

    return Object.values(pending);
  }

  private getUserResponseMap(toolCalls: ToolCallPart[]): Record<string, UserResponse> {
    const map: Record<string, UserResponse> = {};
    for (const call of toolCalls) {
      const response = this.context.getUserResponse(call.toolCallId);
      if (response) {
        map[call.toolCallId] = response;
      }
    }
    return map;
  }

  private async executeTool(
    toolCall: ToolCallPart,
    userResponse?: UserResponse
  ): Promise<
    | { type: "tool-result-part"; payload: ToolResultPart }
    | { type: "user-request"; payload: UserRequest }
  > {
    const executor = this.toolExecutors[toolCall.toolName];
    if (!executor) {
      throw new Error(`Tool executor not found: ${toolCall.toolName}`);
    }

    const result = await executor(
      toolCall.args,
      { name: toolCall.toolName, callId: toolCall.toolCallId },
      userResponse
    );

    if (result.type === "user-request") {
      return { type: "user-request", payload: result.payload };
    }

    return {
      type: "tool-result-part",
      payload: {
        type: "tool-result",
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        result: result.payload
      }
    };
  }

  private isCompleted(): boolean {
    const data = this.context.getTransactionData();
    return !!(data.merchantName && data.amount && data.category);
  }
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

async function exampleUsage() {
  const agent = new TransactionAgentLoop(
    "user123",
    "conv456",
    Buffer.from("fake-image-data") // receipt image
  );

  // User sends initial message
  await agent.addUserInput("Here's my Starbucks receipt");

  // Agent loop iteration 1
  let result = await agent.next();
  console.log("Iteration 1:", result);
  // Agent decides to extract_receipt
  // Then validate_transaction
  // Then finds merchant and amount are good, but category missing
  // Calls categorize_transaction
  // Returns: "I think this is Food & Dining. Should I save it?"

  // User responds
  await agent.addUserResponse({
    tool: { name: "categorize_transaction", callId: result.userRequests[0].tool.callId },
    userInput: "Yes, that's correct",
    parsedData: "Food & Dining"
  });

  // Agent loop iteration 2
  result = await agent.next();
  console.log("Iteration 2:", result);
  // Agent validates again
  // All fields valid
  // Calls store_transaction
  // Returns: "✅ Transaction saved! ID: txn_123"

  console.log("Completed:", result.completed);
}

// ============================================================================
// COMPARISON SUMMARY
// ============================================================================

/*

KEY DIFFERENCES FROM YOUR CURRENT IMPLEMENTATION:

1. NO LANGGRAPH
   - Current: StateGraph with nodes and edges
   - Neu-style: Simple while loop with tool calling

2. LLM DECIDES WORKFLOW
   - Current: Hardcoded if-else in agentDecideActionNode
   - Neu-style: LLM reads tool descriptions and decides which to call

3. TOOLS VS NODES
   - Current: Nodes are workflow steps (requestMerchantNode, requestAmountNode)
   - Neu-style: Tools are capabilities (request_info with field parameter)

4. STATE MANAGEMENT
   - Current: Explicit StateAnnotation with 15+ fields
   - Neu-style: Message history + simple context object

5. HUMAN-IN-LOOP
   - Current: Nodes end with __end__, orchestrator handles resumption
   - Neu-style: Tools return user-request, loop pauses naturally

6. RESUMPTION
   - Current: Load state from DB, invoke graph with updated state
   - Neu-style: Add user response to context, continue loop

7. FLEXIBILITY
   - Current: Adding new request type = new node + new edge
   - Neu-style: Adding new capability = new tool (LLM figures out when to use)

8. DECISION MAKING
   - Current: "If merchant invalid, go to request_merchant node"
   - Neu-style: "LLM, here are tools. Figure out what's needed."

PROS OF NEU-STYLE:
✅ More flexible - adapts to unexpected situations
✅ Simpler code - no graph wiring
✅ Natural conversations - LLM understands context
✅ Easy to extend - just add tools
✅ Better UX - can combine requests ("What's the merchant and amount?")

CONS OF NEU-STYLE:
❌ Less predictable - LLM might make unexpected choices
❌ Slower - LLM call each iteration
❌ More expensive - more tokens used
❌ Harder to debug - no clear workflow visualization
❌ Requires good prompting - system prompt is critical

WHEN TO USE NEU-STYLE:
- Conversational interfaces
- Ambiguous user inputs
- Flexible workflows
- User experience priority
- Budget for LLM calls

WHEN TO USE YOUR CURRENT STYLE:
- Structured workflows
- Predictable paths
- Performance critical
- Cost sensitive
- Need audit trail

*/
