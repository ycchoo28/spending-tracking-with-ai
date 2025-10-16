import { MessagingAdapter } from '../../../core/messaging/messaging-adapter';
import {
  UserContext,
  ImageInput,
  TransactionSummary,
  OptionsMessage
} from '../../../core/messaging/types';
import { createWorkflowGraph } from './workflow';
import { WorkflowState } from './types';
import { DatabaseClient } from '../../../core/database/database';
import { TransactionCategorizer } from '../categorizer/categorizer';
import { ExtractedTransaction } from '../vision/vision-processor';
import { logger } from '../../../core/utils/logger';

interface PendingWorkflowContext {
  type: 'merchant_correction' | 'amount_correction' | 'retry_extraction';
  timestamp: number;
  extractedData?: ExtractedTransaction;
}

export class WorkflowOrchestrator {
  private workflowGraph: ReturnType<typeof createWorkflowGraph>;
  private messagingAdapter: MessagingAdapter | null = null;
  private database: DatabaseClient;
  private categorizer: TransactionCategorizer;
  private config: any;
  private pendingWorkflows: Map<string, PendingWorkflowContext>;

  constructor(
    workflowGraph: ReturnType<typeof createWorkflowGraph>,
    database: DatabaseClient,
    categorizer: TransactionCategorizer,
    config: any
  ) {
    this.workflowGraph = workflowGraph;
    this.database = database;
    this.categorizer = categorizer;
    this.config = config;
    this.pendingWorkflows = new Map();
  }

  setAdapter(adapter: MessagingAdapter): void {
    this.messagingAdapter = adapter;
  }

  private getAdapter(): MessagingAdapter {
    if (!this.messagingAdapter) {
      throw new Error('MessagingAdapter not set. Call setAdapter() first.');
    }
    return this.messagingAdapter;
  }

  async handleImageReceived(context: UserContext, image: ImageInput): Promise<void> {
    // Generate a unique workflow execution ID for this run
    const workflowExecutionId = `wf_${context.userId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const adapter = this.getAdapter();

    try {
      logger.logImageReceived(context.userId, image.data.length);
      logger.startPerformanceTracking(workflowExecutionId, 'process_photo', {
        userId: context.userId,
      });

      const workflowState: WorkflowState = {
        telegramUserId: context.userId,
        chatId: parseInt(context.sessionId),
        imageUrl: image.url,
        imageData: image.data,
        awaitingUserInput: false,
        needsClarification: false,
        extractionValid: false,
        workflowExecutionId: workflowExecutionId,
      };

      const config = {
        metadata: {
          userId: context.userId,
          sessionId: context.sessionId,
          workflowExecutionId: workflowExecutionId,
        }
      };

      const result = await this.workflowGraph.invoke(workflowState, config);

      // Log the execution
      logger.info('LangGraph execution completed', {
        userId: context.userId,
        hasError: !!result.error,
        needsClarification: !!result.needsClarification,
        workflowExecutionId: result.workflowExecutionId,
      });

      if (result.error) {
        await this.handleWorkflowError(context, result as WorkflowState, workflowExecutionId);
        return;
      }

      if (result.needsClarification && result.extractedData) {
        await this.handleClarificationNeeded(context, result as WorkflowState);
        logger.endPerformanceTracking(workflowExecutionId, true, undefined, {
          needsClarification: true,
        });
        return;
      }

      if (result.transactionId && result.extractedData && result.category) {
        await this.handleTransactionSuccess(context, result as WorkflowState, workflowExecutionId);
      }
    } catch (error) {
      logger.error('❌ Error handling photo', error, {
        userId: context.userId,
      });
      logger.endPerformanceTracking(workflowExecutionId, false, (error as Error).message);
      await adapter.sendError(context, {
        message: 'An unexpected error occurred while processing your photo.',
        errorType: 'unknown'
      });
    }
  }

  async handleTextReceived(context: UserContext, text: string): Promise<void> {
    try {
      const pendingWorkflow = this.pendingWorkflows.get(context.userId);

      if (!pendingWorkflow) {
        await this.getAdapter().sendMessage(context, {
          text: '📸 Please send me a photo of your receipt or e-wallet transaction screenshot.'
        });
        return;
      }

      switch (pendingWorkflow.type) {
        case 'merchant_correction':
          await this.handleMerchantCorrection(context, text, pendingWorkflow);
          break;
        case 'amount_correction':
          await this.handleAmountCorrection(context, text, pendingWorkflow);
          break;
        case 'retry_extraction':
          await this.handleRetryExtraction(context, text);
          break;
      }
    } catch (error) {
      logger.error('Error handling user text input', error as Error, { userId: context.userId });
      await this.getAdapter().sendError(context, {
        message: 'Failed to process your input. Please try again.',
        errorType: 'unknown'
      });
    }
  }

  async handleOptionSelected(context: UserContext, optionId: string, optionValue: string): Promise<void> {
    try {
      logger.logUserInteraction(context.userId, 'category_selected', {
        optionId,
        optionValue,
      });

      if (optionId.startsWith('category_')) {
        const transactionId = optionId.replace('category_', '');

        if (transactionId && transactionId !== 'temp') {
          await this.categorizer.learnFromCorrection(transactionId, optionValue);
        }
      }
    } catch (error) {
      logger.error('❌ Error handling option selection', error, {
        userId: context.userId,
        optionId,
        optionValue,
      });
    }
  }

  private async handleWorkflowError(context: UserContext, result: WorkflowState, workflowExecutionId: string): Promise<void> {
    const adapter = this.getAdapter();

    logger.endPerformanceTracking(workflowExecutionId, false, result.error);

    if (result.errorType === 'validation' && result.extractedData) {
      if (!result.extractedData.merchantName || result.extractedData.merchantName === 'Unknown Merchant') {
        await this.requestMerchantCorrection(context, result.extractedData);
        return;
      } else if (!result.extractedData.amount || result.extractedData.amount === 0) {
        await this.requestAmountCorrection(context, result.extractedData);
        return;
      }
    } else if (result.errorType === 'extraction') {
      await this.requestRetryWithGuidance(context, result.error || 'Failed to extract transaction details');
      return;
    }

    await adapter.sendError(context, {
      message: result.error || 'An error occurred processing your receipt',
      errorType: result.errorType
    });
  }

  private async handleClarificationNeeded(context: UserContext, result: WorkflowState): Promise<void> {
    const adapter = this.getAdapter();

    if (!result.extractedData) return;

    const options = (result.suggestedCategories || []).map(category => ({
      id: `category_${result.transactionId || 'temp'}`,
      label: category,
      value: category
    }));

    const optionsMessage: OptionsMessage = {
      text: `🤔 I need your help categorizing this transaction:\n\n` +
        `💰 Amount: ${result.extractedData.currency} ${result.extractedData.amount.toFixed(2)}\n` +
        `🏪 Merchant: ${result.extractedData.merchantName}\n\n` +
        `📁 Please select the appropriate category:`,
      options
    };

    await adapter.sendOptions(context, optionsMessage);
  }

  private async handleTransactionSuccess(context: UserContext, result: WorkflowState, workflowExecutionId: string): Promise<void> {
    const adapter = this.getAdapter();

    if (!result.extractedData || !result.category || !result.transactionId) return;

    const transaction: TransactionSummary = {
      amount: result.extractedData.amount,
      currency: result.extractedData.currency,
      merchantName: result.extractedData.merchantName,
      category: result.category,
      dateTime: result.extractedData.dateTime,
      paymentMethod: result.extractedData.paymentMethod,
      transactionReference: result.extractedData.transactionReference,
      transactionId: result.transactionId
    };

    await adapter.sendTransactionConfirmation(context, transaction);
    logger.endPerformanceTracking(workflowExecutionId, true, undefined, {
      transactionId: result.transactionId,
    });
  }

  private async requestMerchantCorrection(context: UserContext, extractedData: ExtractedTransaction): Promise<void> {
    this.pendingWorkflows.set(context.userId, {
      type: 'merchant_correction',
      timestamp: Date.now(),
      extractedData
    });

    await this.getAdapter().requestTextInput(context,
      `❌ I couldn't identify the merchant name clearly.\n\n` +
      `💰 Amount: ${extractedData.currency} ${extractedData.amount.toFixed(2)}\n\n` +
      `Please reply with the correct merchant name:`
    );
  }

  private async requestAmountCorrection(context: UserContext, extractedData: ExtractedTransaction): Promise<void> {
    this.pendingWorkflows.set(context.userId, {
      type: 'amount_correction',
      timestamp: Date.now(),
      extractedData
    });

    await this.getAdapter().requestTextInput(context,
      `❌ I couldn't identify the amount clearly.\n\n` +
      `🏪 Merchant: ${extractedData.merchantName}\n\n` +
      `Please reply with the correct amount (e.g., "16.50"):`
    );
  }

  private async requestRetryWithGuidance(context: UserContext, errorMessage: string): Promise<void> {
    this.pendingWorkflows.set(context.userId, {
      type: 'retry_extraction',
      timestamp: Date.now()
    });

    await this.getAdapter().requestTextInput(context,
      `❌ ${errorMessage}\n\n` +
      `💡 Please help me by providing the merchant name manually:`
    );
  }

  private async handleMerchantCorrection(context: UserContext, merchantName: string, pendingWorkflow: PendingWorkflowContext): Promise<void> {
    const adapter = this.getAdapter();

    try {
      if (!pendingWorkflow.extractedData) {
        throw new Error('No extracted data in pending workflow');
      }

      pendingWorkflow.extractedData.merchantName = merchantName.trim();
      this.pendingWorkflows.delete(context.userId);

      await adapter.sendMessage(context, {
        text: `✅ Merchant updated to: ${merchantName}\n\n🔄 Categorizing transaction...`
      });

      const categorizationResult = await this.categorizer.categorize(
        pendingWorkflow.extractedData,
        context.userId
      );

      if (categorizationResult.confidence < this.config.workflow.confidenceThreshold) {
        const options = (categorizationResult.suggestedCategories || []).map(category => ({
          id: `category_temp`,
          label: category,
          value: category
        }));

        await adapter.sendOptions(context, {
          text: `🤔 Please select the category for this transaction:`,
          options
        });
      } else {
        await this.storeAndConfirmTransaction(context, pendingWorkflow.extractedData, categorizationResult);
      }
    } catch (error) {
      logger.error('Error handling merchant correction', error as Error, { userId: context.userId });
      await adapter.sendError(context, {
        message: 'Failed to process merchant correction. Please try again.',
        errorType: 'unknown'
      });
    }
  }

  private async handleAmountCorrection(context: UserContext, amountText: string, pendingWorkflow: PendingWorkflowContext): Promise<void> {
    const adapter = this.getAdapter();

    try {
      if (!pendingWorkflow.extractedData) {
        throw new Error('No extracted data in pending workflow');
      }

      const amount = parseFloat(amountText.replace(/[^0-9.]/g, ''));

      if (isNaN(amount) || amount <= 0) {
        await adapter.sendError(context, {
          message: 'Invalid amount. Please enter a valid number (e.g., "16.50").',
          errorType: 'validation'
        });
        return;
      }

      pendingWorkflow.extractedData.amount = amount;
      this.pendingWorkflows.delete(context.userId);

      await adapter.sendMessage(context, {
        text: `✅ Amount updated to: ${pendingWorkflow.extractedData.currency} ${amount.toFixed(2)}\n\n🔄 Categorizing transaction...`
      });

      const categorizationResult = await this.categorizer.categorize(
        pendingWorkflow.extractedData,
        context.userId
      );

      if (categorizationResult.confidence < this.config.workflow.confidenceThreshold) {
        const options = (categorizationResult.suggestedCategories || []).map(category => ({
          id: `category_temp`,
          label: category,
          value: category
        }));

        await adapter.sendOptions(context, {
          text: `🤔 Please select the category for this transaction:`,
          options
        });
      } else {
        await this.storeAndConfirmTransaction(context, pendingWorkflow.extractedData, categorizationResult);
      }
    } catch (error) {
      logger.error('Error handling amount correction', error as Error, { userId: context.userId });
      await adapter.sendError(context, {
        message: 'Failed to process amount correction. Please try again.',
        errorType: 'unknown'
      });
    }
  }

  private async handleRetryExtraction(context: UserContext, text: string): Promise<void> {
    const adapter = this.getAdapter();

    try {
      await adapter.sendMessage(context, {
        text: `✅ Got it! Merchant: ${text}\n\n📝 Now please reply with the amount (e.g., "16.50")`
      });

      this.pendingWorkflows.set(context.userId, {
        type: 'amount_correction',
        extractedData: {
          merchantName: text.trim(),
          amount: 0,
          currency: 'MYR',
          dateTime: new Date().toISOString(),
          paymentMethod: 'Unknown',
          confidence: 0.5,
        },
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Error handling retry extraction', error as Error, { userId: context.userId });
      await adapter.sendError(context, {
        message: 'Failed to process your input. Please try again.',
        errorType: 'unknown'
      });
    }
  }

  private async storeAndConfirmTransaction(context: UserContext, extractedData: ExtractedTransaction, categorizationResult: any): Promise<void> {
    // Generate a manual correction run ID since this bypasses LangGraph
    const manualCorrectionRunId = `manual_${context.userId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const transactionId = await this.database.storeTransaction({
      user_id: context.userId,
      telegram_user_id: context.userId,
      amount: extractedData.amount,
      currency: extractedData.currency,
      merchant_name: extractedData.merchantName,
      category: categorizationResult.category,
      date_time: extractedData.dateTime,
      payment_method: extractedData.paymentMethod,
      transaction_reference: extractedData.transactionReference,
      confidence_score: categorizationResult.confidence,
      // Additional workflow and processing fields
      processing_status: 'completed',
      extraction_confidence: extractedData.confidence,
      awaiting_user_input: false,
      retry_count: 0,
      workflow_execution_id: manualCorrectionRunId, // Manual correction run ID
    });

    const transaction: TransactionSummary = {
      amount: extractedData.amount,
      currency: extractedData.currency,
      merchantName: extractedData.merchantName,
      category: categorizationResult.category,
      dateTime: extractedData.dateTime,
      paymentMethod: extractedData.paymentMethod,
      transactionReference: extractedData.transactionReference,
      transactionId
    };

    await this.getAdapter().sendTransactionConfirmation(context, transaction);
  }

  cleanup(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [userId, workflow] of this.pendingWorkflows.entries()) {
      if (workflow.timestamp < oneHourAgo) {
        this.pendingWorkflows.delete(userId);
      }
    }
  }
}