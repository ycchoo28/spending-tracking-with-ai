import sharp from 'sharp';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { logger } from '../../../core/utils/logger';
import { buildExtractionPrompt } from '../../../prompts/receipt/extraction';
import { cleanJsonResponse } from '../../../prompts/shared/formatters';

/**
 * Extracted transaction data from receipt or e-wallet screenshot
 */
export interface ExtractedTransaction {
  amount: number;
  currency: string;
  merchantName: string;
  dateTime: string; // ISO format
  paymentMethod: string;
  transactionReference?: string;
  items?: Array<{ name: string; price: number; quantity: number }>;
  confidence: number; // Extraction confidence (0-1)
}

/**
 * Error thrown when vision API operations fail
 */
export class VisionProcessingError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'VisionProcessingError';
  }
}

/**
 * Configuration for VisionProcessor
 */
export interface VisionProcessorConfig {
  apiKey: string;
  apiBase: string;
  model: string;
  maxRetries: number;
  retryDelay: number;
}

/**
 * VisionProcessor handles receipt and e-wallet screenshot processing
 * using OpenAI-compatible vision APIs to extract transaction data
 */
export class VisionProcessor {
  private llm: ChatOpenAI;
  private maxRetries: number;
  private retryDelay: number;

  /**
   * Creates a new VisionProcessor instance
   * @param config - Configuration for API access and retry behavior
   */
  constructor(config: VisionProcessorConfig) {
    this.llm = new ChatOpenAI({
      openAIApiKey: config.apiKey,
      configuration: {
        baseURL: config.apiBase,
      },
      modelName: config.model,
      temperature: 0, // Use deterministic output for data extraction
    });

    this.maxRetries = config.maxRetries;
    this.retryDelay = config.retryDelay;
  }

  /**
   * Preprocesses an image for optimal API processing
   * Resizes and compresses the image if needed to stay within API limits
   * @param imageData - Raw image buffer
   * @returns Processed image buffer and base64 string
   */
  private async preprocessImage(imageData: Buffer): Promise<{
    buffer: Buffer;
    base64: string;
    mimeType: string;
  }> {
    try {
      logger.debug('Starting image preprocessing', {
        originalSize: `${(imageData.length / 1024).toFixed(2)} KB`,
      });

      const image = sharp(imageData);
      const metadata = await image.metadata();

      logger.debug('Image metadata extracted', {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
      });

      // Target max size: 2MB for API efficiency
      const MAX_SIZE_BYTES = 2 * 1024 * 1024;
      const MAX_DIMENSION = 2048;

      let processedImage = image;

      // Resize if image is too large
      if (
        metadata.width &&
        metadata.height &&
        (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION)
      ) {
        logger.debug('Resizing image', {
          originalWidth: metadata.width,
          originalHeight: metadata.height,
          maxDimension: MAX_DIMENSION,
        });
        
        processedImage = processedImage.resize(MAX_DIMENSION, MAX_DIMENSION, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // Convert to JPEG with quality adjustment if needed
      let quality = 90;
      let buffer = await processedImage.jpeg({ quality }).toBuffer();

      // Reduce quality if still too large
      while (buffer.length > MAX_SIZE_BYTES && quality > 50) {
        quality -= 10;
        logger.debug('Reducing image quality', {
          quality,
          currentSize: `${(buffer.length / 1024).toFixed(2)} KB`,
          targetSize: `${(MAX_SIZE_BYTES / 1024).toFixed(2)} KB`,
        });
        
        buffer = await sharp(imageData)
          .resize(MAX_DIMENSION, MAX_DIMENSION, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality })
          .toBuffer();
      }

      const base64 = buffer.toString('base64');
      const mimeType = 'image/jpeg';

      logger.debug('Image preprocessing complete', {
        finalSize: `${(buffer.length / 1024).toFixed(2)} KB`,
        quality,
      });

      return { buffer, base64, mimeType };
    } catch (error) {
      logger.error('Image preprocessing failed', error as Error);
      throw new VisionProcessingError(
        'Failed to preprocess image',
        error as Error
      );
    }
  }

  /**
   * Parses the API response and structures it into ExtractedTransaction
   * @param response - Raw response string from the vision API
   * @returns Structured transaction data
   */
  private parseResponse(response: string): ExtractedTransaction {
    try {
      logger.debug('Parsing vision API response', {
        responseLength: response.length,
        responseStart: response.substring(0, 200),
      });

      // Clean up response using shared formatter
      const cleanedResponse = cleanJsonResponse(response);

      logger.debug('Cleaned response', {
        cleanedLength: cleanedResponse.length,
        cleanedStart: cleanedResponse.substring(0, 200),
      });

      // Parse JSON
      let parsed;
      try {
        parsed = JSON.parse(cleanedResponse);
        logger.info('✅ JSON parsed successfully', {
          parsedObject: parsed,
          keys: Object.keys(parsed),
        });
      } catch (jsonError) {
        logger.error('❌ JSON parsing failed', jsonError as Error, {
          responseLength: cleanedResponse.length,
          fullResponse: cleanedResponse,
          responsePreview: cleanedResponse.substring(0, 500),
          errorMessage: (jsonError as Error).message,
        });
        throw new Error(`JSON parsing failed: ${(jsonError as Error).message}. Response: ${cleanedResponse.substring(0, 200)}`);
      }

      logger.debug('Validating parsed JSON fields', {
        hasAmount: 'amount' in parsed,
        hasMerchant: 'merchantName' in parsed,
        hasConfidence: 'confidence' in parsed,
        keys: Object.keys(parsed),
      });

      // Validate required fields
      if (typeof parsed.amount !== 'number') {
        logger.error('Invalid amount field', undefined, {
          amountValue: parsed.amount,
          amountType: typeof parsed.amount,
          parsedObject: parsed,
        });
        throw new Error(`Invalid or missing amount field. Got: ${parsed.amount} (${typeof parsed.amount})`);
      }
      if (typeof parsed.merchantName !== 'string') {
        logger.error('Invalid merchantName field', undefined, {
          merchantValue: parsed.merchantName,
          merchantType: typeof parsed.merchantName,
          parsedObject: parsed,
        });
        throw new Error(`Invalid or missing merchantName field. Got: ${parsed.merchantName} (${typeof parsed.merchantName})`);
      }

      // Construct ExtractedTransaction with defaults for missing fields
      const transaction: ExtractedTransaction = {
        amount: parsed.amount,
        currency: parsed.currency || 'MYR',
        merchantName: parsed.merchantName,
        dateTime: parsed.dateTime || new Date().toISOString(),
        paymentMethod: parsed.paymentMethod || 'Unknown',
        transactionReference: parsed.transactionReference || undefined,
        items: Array.isArray(parsed.items) ? parsed.items : [],
        confidence: typeof parsed.confidence === 'number' 
          ? Math.max(0, Math.min(1, parsed.confidence)) 
          : 0.5,
      };

      logger.info('✅ Transaction object constructed successfully', {
        transaction: transaction,
        merchant: transaction.merchantName,
        amount: transaction.amount,
        currency: transaction.currency,
        confidence: transaction.confidence,
        dateTime: transaction.dateTime,
        paymentMethod: transaction.paymentMethod,
        itemCount: transaction.items?.length || 0,
      });

      return transaction;
    } catch (error) {
      logger.error('Failed to parse vision API response', error as Error, {
        errorMessage: (error as Error).message,
        errorStack: (error as Error).stack,
        responseLength: response.length,
        responsePreview: response.substring(0, 500),
      });
      
      throw new VisionProcessingError(
        `Failed to parse vision API response: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Extracts transaction data from an image with retry logic
   * @param imageData - Raw image buffer
   * @returns Extracted transaction data
   * @throws VisionProcessingError if extraction fails after all retries
   */
  async extractTransactionData(imageData: Buffer): Promise<ExtractedTransaction> {
    const operationId = `vision_${Date.now()}`;
    logger.startPerformanceTracking(operationId, 'vision_extraction', {
      imageSize: `${(imageData.length / 1024).toFixed(2)} KB`,
    });

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logger.info(`Retrying vision extraction (attempt ${attempt + 1}/${this.maxRetries + 1})`);
        }

        // Preprocess the image
        const { base64, mimeType } = await this.preprocessImage(imageData);

        // Get prompt from centralized location
        const prompt = buildExtractionPrompt();

        logger.debug('Calling vision API', {
          attempt: attempt + 1,
          model: this.llm.modelName,
        });

        // Create the message with image
        const message = new HumanMessage({
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
              },
            },
          ],
        });

        // Call the vision API
        const apiStartTime = Date.now();
        let response;
        
        try {
          response = await this.llm.invoke([message]);
        } catch (apiError) {
          const apiDuration = Date.now() - apiStartTime;
          logger.error('Vision API call failed', apiError as Error, {
            attempt: attempt + 1,
            duration: `${apiDuration}ms`,
            model: this.llm.modelName,
            errorType: (apiError as Error).name,
            errorMessage: (apiError as Error).message,
          });
          throw apiError;
        }
        
        const apiDuration = Date.now() - apiStartTime;

        logger.debug('Vision API response received', {
          duration: `${apiDuration}ms`,
          responseLength: (response.content as string).length,
          responsePreview: (response.content as string).substring(0, 100) + '...',
        });

        // Parse and return the response
        const extractedData = this.parseResponse(response.content as string);

        logger.info('Transaction data extracted successfully', {
          merchant: extractedData.merchantName,
          amount: `${extractedData.currency} ${extractedData.amount}`,
          confidence: extractedData.confidence,
          paymentMethod: extractedData.paymentMethod,
        });

        logger.endPerformanceTracking(operationId, true, undefined, {
          merchant: extractedData.merchantName,
          confidence: extractedData.confidence,
        });

        return extractedData;
      } catch (error) {
        lastError = error as Error;
        
        // Log detailed error information
        logger.error('Vision extraction attempt failed', error as Error, {
          attempt: attempt + 1,
          maxRetries: this.maxRetries + 1,
          errorName: (error as Error).name,
          errorMessage: (error as Error).message,
          errorStack: (error as Error).stack,
          model: this.llm.modelName,
          isApiError: error && typeof error === 'object' && 'response' in error,
          apiStatus: error && typeof error === 'object' && 'response' in error 
            ? (error as any).response?.status 
            : undefined,
          apiStatusText: error && typeof error === 'object' && 'response' in error 
            ? (error as any).response?.statusText 
            : undefined,
        });

        // If this is not the last attempt, wait before retrying
        if (attempt < this.maxRetries) {
          // Exponential backoff: retryDelay * 2^attempt
          const delay = this.retryDelay * Math.pow(2, attempt);
          logger.info(`Waiting ${delay}ms before retry...`, {
            attempt: attempt + 1,
            nextAttempt: attempt + 2,
            delay: `${delay}ms`,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    logger.error('❌ Vision extraction FAILED after all retries', lastError, {
      attempts: this.maxRetries + 1,
      finalError: lastError?.message,
      errorType: lastError?.name,
      model: this.llm.modelName,
      fullError: lastError ? {
        name: lastError.name,
        message: lastError.message,
        stack: lastError.stack,
        cause: (lastError as any).cause,
      } : undefined,
    });

    logger.endPerformanceTracking(operationId, false, lastError?.message);

    throw new VisionProcessingError(
      `Failed to extract transaction data after ${this.maxRetries + 1} attempts: ${lastError?.message}`,
      lastError
    );
  }
}
