# Test Images Directory

This directory contains sample images for end-to-end testing of the Receipt Tracker Agent.

## Required Test Images

To run comprehensive E2E tests, add the following images to this directory:

### E-wallet Screenshots
- `duitnow-sample.jpg` - Sample DuitNow transaction screenshot
- `grabpay-sample.jpg` - Sample GrabPay transaction screenshot
- `tng-sample.jpg` - Sample Touch 'n Go eWallet screenshot

### Physical Receipts
- `restaurant-receipt.jpg` - Sample restaurant receipt
- `retail-receipt.jpg` - Sample retail store receipt
- `service-receipt.jpg` - Sample service provider receipt

### Edge Cases
- `blurry-receipt.jpg` - Intentionally blurry receipt for testing error handling
- `partial-receipt.jpg` - Partially visible receipt

## Image Guidelines

1. **Format**: JPG or PNG
2. **Size**: Recommended 500KB - 2MB
3. **Resolution**: Minimum 800x600 pixels
4. **Content**: Ensure receipts contain:
   - Clear amount
   - Merchant name
   - Date/time
   - Payment method (if applicable)

## Privacy Note

⚠️ **Important**: Do not commit real receipts with personal information to version control.
- Use sample/mock receipts only
- Redact any personal information (names, addresses, phone numbers)
- This directory is included in `.gitignore` to prevent accidental commits

## Creating Mock Images

If you don't have real receipts, you can:
1. Create mock receipts using image editing software
2. Use online receipt generators
3. Take photos of sample receipts from public sources
4. The test suite will use mock data if images are not found

## Running Tests Without Images

The E2E test suite (`test-e2e.ts`) will automatically fall back to mock data if images are not present, allowing you to run tests without actual image files.
