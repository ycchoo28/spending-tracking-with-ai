import * as fs from 'fs';
import * as path from 'path';
import { VisionProcessor } from './src/vision';
import { getConfig } from './src/config/config';

/**
 * Simple test script to verify VisionProcessor functionality
 * Usage: ts-node test-vision-processor.ts <path-to-image>
 */
async function testVisionProcessor() {
  try {
    // Load configuration
    const config = getConfig();

    // Create VisionProcessor instance
    const visionProcessor = new VisionProcessor({
      apiKey: config.openai.apiKey,
      apiBase: config.openai.apiBase,
      model: config.openai.visionModel,
      maxRetries: config.app.maxRetries,
      retryDelay: config.app.retryDelay,
    });

    console.log('VisionProcessor initialized successfully');
    console.log(`Using model: ${config.openai.visionModel}`);
    console.log(`API Base: ${config.openai.apiBase}`);

    // Check if image path is provided
    const imagePath = process.argv[2];
    if (!imagePath) {
      console.log('\nTo test with an actual image, run:');
      console.log('ts-node test-vision-processor.ts <path-to-receipt-image>');
      console.log('\nVisionProcessor is ready to process images!');
      return;
    }

    // Verify image exists
    if (!fs.existsSync(imagePath)) {
      console.error(`Error: Image file not found: ${imagePath}`);
      process.exit(1);
    }

    console.log(`\nProcessing image: ${imagePath}`);

    // Read image file
    const imageData = fs.readFileSync(imagePath);
    console.log(`Image size: ${(imageData.length / 1024).toFixed(2)} KB`);

    // Extract transaction data
    console.log('\nExtracting transaction data...');
    const startTime = Date.now();
    const extractedData = await visionProcessor.extractTransactionData(imageData);
    const duration = Date.now() - startTime;

    // Display results
    console.log('\n✅ Extraction successful!');
    console.log(`Processing time: ${duration}ms`);
    console.log('\nExtracted Transaction Data:');
    console.log(JSON.stringify(extractedData, null, 2));

    // Confidence assessment
    if (extractedData.confidence >= 0.8) {
      console.log('\n✅ High confidence - ready for automatic categorization');
    } else if (extractedData.confidence >= 0.5) {
      console.log('\n⚠️  Medium confidence - may need user clarification');
    } else {
      console.log('\n❌ Low confidence - user clarification recommended');
    }
  } catch (error) {
    console.error('\n❌ Error testing VisionProcessor:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testVisionProcessor();
