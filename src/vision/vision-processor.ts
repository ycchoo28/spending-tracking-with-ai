import sharp from 'sharp';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { logger } from '../utils/logger';

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
   * Builds the vision prompt with detailed extraction instructions
   * @returns Structured prompt for the vision API
   */
  private buildVisionPrompt(): string {
    return `You are an expert at extracting transaction data from receipt images and e-wallet screenshots.

Analyze the provided image and extract the following information:

1. **Amount**: The total transaction amount (numeric value only, no currency symbols)
2. **Currency**: The currency code (e.g., MYR, USD, SGD)
3. **Merchant Name**: The name of the merchant or business
4. **Date and Time**: The transaction date and time in ISO 8601 format (YYYY-MM-DDTHH:mm:ss)
5. **Payment Method**: The payment method used (e.g., "Credit Card", "DuitNow", "GrabPay", "Touch 'n Go", "Cash")
6. **Transaction Reference**: Any transaction ID, reference number, or receipt number (if available)
7. **Items**: List of purchased items with name, price, and quantity (if itemized receipt)
8. **Confidence**: Your confidence level in the extraction accuracy (0.0 to 1.0)

**Important Guidelines:**
- For e-wallet screenshots (DuitNow, GrabPay, Touch 'n Go, etc.), focus on the transaction summary section
- If the date/time is not visible, use the current date/time and set confidence lower
- If currency is not shown, assume MYR for Malaysian e-wallets
- Extract merchant name exactly as shown, preserving capitalization
- For payment method, identify the specific e-wallet or card type if visible
- If items are not itemized (e.g., e-wallet transfer), leave items array empty
- Be conservative with confidence scores - use lower values if any information is unclear

**Response Format:**
Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):

{
  "amount": 0.00,
  "currency": "MYR",
  "merchantName": "Merchant Name",
  "dateTime": "2024-01-01T12:00:00",
  "paymentMethod": "Payment Method",
  "transactionReference": "REF123456",
  "items": [
    {"name": "Item Name", "price": 0.00, "quantity": 1}
  ],
  "confidence": 0.95
}

If you cannot extract certain fields, use these defaults:
- amount: 0.00 (but try your best to find it)
- currency: "MYR"
- merchantName: "Unknown Merchant"
- dateTime: current timestamp
- paymentMethod: "Unknown"
- transactionReference: null or omit the field
- items: [] (empty array)
- confidence: lower value (0.3-0.5) if many fields are missing

Now analyze the image and provide the extracted data:`;
  }

  /**
   * Parses the API response and structures it into ExtractedTransaction
   * @param response - Raw response string from the vision API
   * @returns Structured transaction data
   */
  private parseResponse(response: string): ExtractedTransaction {
    try {
      // Clean up response - remove markdown code blocks if present
      let cleanedResponse = response.trim();
      
      // Remove markdown code blocks
      cleanedResponse = cleanedResponse.replace(/```json\s*/g, '');
      cleanedResponse = cleanedResponse.replace(/```\s*/g, '');
      cleanedResponse = cleanedResponse.trim();

      // Parse JSON
      const parsed = JSON.parse(cleanedResponse);

      // Validate required fields
      if (typeof parsed.amount !== 'number') {
        throw new Error('Invalid or missing amount field');
      }
      if (typeof parsed.merchantName !== 'string') {
        throw new Error('Invalid or missing merchantName field');
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

      return transaction;
    } catch (error) {
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

        // Build the prompt
        const prompt = this.buildVisionPrompt();

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
        const response = await this.llm.invoke([message]);
        const apiDuration = Date.now() - apiStartTime;

        logger.debug('Vision API response received', {
          duration: `${apiDuration}ms`,
          responseLength: (response.content as string).length,
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
        logger.warn('Vision extraction attempt failed', {
          attempt: attempt + 1,
          error: (error as Error).message,
        });

        // If this is not the last attempt, wait before retrying
        if (attempt < this.maxRetries) {
          // Exponential backoff: retryDelay * 2^attempt
          const delay = this.retryDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    logger.error('Vision extraction failed after all retries', lastError, {
      attempts: this.maxRetries + 1,
    });

    logger.endPerformanceTracking(operationId, false, lastError?.message);

    throw new VisionProcessingError(
      `Failed to extract transaction data after ${this.maxRetries + 1} attempts`,
      lastError
    );
  }
}
