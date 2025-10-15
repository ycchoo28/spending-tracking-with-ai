# End-to-End Testing Guide

This document describes the end-to-end testing strategy and procedures for the Receipt Tracker Agent.

## Overview

The E2E test suite validates the complete system functionality including:
- E-wallet screenshot processing (DuitNow, GrabPay, Touch 'n Go)
- Physical receipt image processing
- Edge case handling (blurry images, partial receipts, foreign currency)
- /stats command accuracy
- Concurrent user handling
- Complete workflow integration

## Test Coverage

### 1. E-wallet Screenshots
Tests the system's ability to process various Malaysian e-wallet transaction screenshots:
- **DuitNow**: Tests extraction of DuitNow payment confirmations
- **GrabPay**: Tests extraction of GrabPay transaction details
- **Touch 'n Go**: Tests extraction of TNG eWallet receipts

**Validation Points:**
- Amount extraction accuracy
- Merchant name identification
- Payment method detection
- Date/time parsing
- Confidence scoring
- Categorization accuracy

### 2. Physical Receipt Images
Tests processing of traditional paper receipts:
- **Restaurant receipts**: Tests itemized bills with multiple items
- **Retail receipts**: Tests product purchases with SKUs
- **Service receipts**: Tests service-based transactions

**Validation Points:**
- Total amount extraction
- Individual item parsing
- Merchant identification
- Receipt format handling

### 3. Edge Cases
Tests system robustness with challenging scenarios:

#### 3.1 Blurry Images
- Tests low-confidence detection
- Validates user notification for clearer image
- Ensures graceful degradation

#### 3.2 Partial Receipts
- Tests handling of incomplete data
- Validates clarification request flow
- Ensures no data corruption

#### 3.3 Foreign Currency
- Tests non-MYR currency handling
- Validates currency code extraction
- Ensures proper storage and display

#### 3.4 Large Amounts
- Tests handling of high-value transactions
- Validates decimal precision
- Ensures no overflow errors

### 4. /stats Command Accuracy
Tests the spending statistics calculation:

**Test Procedure:**
1. Create known set of transactions
2. Calculate expected totals manually
3. Retrieve stats via database client
4. Compare actual vs expected values

**Validation Points:**
- Total spending accuracy
- Transaction count accuracy
- Category breakdown accuracy
- Date range filtering
- Currency handling

### 5. Concurrent User Handling
Tests system behavior under concurrent load:

**Test Procedure:**
1. Simulate multiple users simultaneously
2. Each user creates multiple transactions
3. Verify all transactions stored correctly
4. Check data integrity and isolation

**Validation Points:**
- No transaction loss
- No data corruption
- Proper user isolation
- Database connection pooling
- Error handling under load

### 6. Complete Workflow Integration
Tests the entire LangGraph workflow:

**Workflow Steps:**
1. Receive image → Extract data → Categorize → Store → Confirm
2. Low confidence path: Extract → Categorize → Request clarification → Store → Confirm

**Validation Points:**
- State transitions
- Error recovery
- User interaction handling
- Data persistence

## Running the Tests

### Prerequisites

1. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Database Setup**
   ```bash
   npm run setup-db
   ```

### Running All Tests

**Option 1: Using the test runner script**
```bash
./run-e2e-tests.sh
```

**Option 2: Direct execution**
```bash
npx ts-node test-e2e.ts
```

**Option 3: With npm script**
```bash
npm run test:e2e
```

### Running Individual Test Suites

You can import and run specific test functions:

```typescript
import { testEWalletScreenshots, testStatsCommand } from './test-e2e';

// Run only e-wallet tests
await testEWalletScreenshots();

// Run only stats validation
await testStatsCommand();
```

## Test Data

### Using Real Images

1. Add test images to the `test-images/` directory
2. Follow naming conventions in `test-images/README.md`
3. Ensure images don't contain personal information
4. Run tests with actual image processing

### Using Mock Data

If test images are not available:
- Tests automatically fall back to mock data
- Mock data simulates realistic transaction scenarios
- All validation logic still executes
- Useful for CI/CD pipelines

## Expected Output

The test suite provides colored console output:

```
╔════════════════════════════════════════════════════════════╗
║     Receipt Tracker Agent - End-to-End Test Suite        ║
╚════════════════════════════════════════════════════════════╝

============================================================
Initializing Components
============================================================

  ✓ Database client initialized
  ✓ Vision processor initialized
  ✓ Transaction categorizer initialized
  ✓ Workflow graph created

============================================================
Test 1: E-wallet Screenshots
============================================================

▶ Testing: DuitNow Screenshot
  ✓ Extracted amount: MYR 25.50
  ✓ Merchant: Test Merchant
  ✓ Payment method: DuitNow
  ✓ Confidence: 0.95
  ✓ Categorized as: Shopping (confidence: 0.88)
  ✓ Stored transaction: abc-123-def

...

============================================================
Test Summary
============================================================

  ✓ All tests completed in 45.23 seconds

✓ E-wallet screenshots tested
✓ Physical receipt images tested
✓ Edge cases validated
✓ /stats command accuracy verified
✓ Concurrent user handling tested
✓ Complete workflow integration validated
```

## Interpreting Results

### Success Indicators
- ✓ Green checkmarks indicate passed validations
- All test sections complete without errors
- Stats calculations match expected values
- Concurrent operations complete successfully

### Warning Indicators
- ⚠ Yellow warnings indicate non-critical issues
- Missing test images (falls back to mock data)
- Optional validations skipped

### Error Indicators
- ✗ Red X marks indicate failures
- Test execution errors
- Validation mismatches
- System component failures

## Continuous Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Setup environment
        run: |
          echo "TELEGRAM_BOT_TOKEN=${{ secrets.TELEGRAM_BOT_TOKEN }}" >> .env
          echo "OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY }}" >> .env
          echo "SUPABASE_URL=${{ secrets.SUPABASE_URL }}" >> .env
          echo "SUPABASE_KEY=${{ secrets.SUPABASE_KEY }}" >> .env
      
      - name: Run E2E tests
        run: npm run test:e2e
```

## Troubleshooting

### Common Issues

**1. Environment Variables Not Set**
```
Error: Missing required configuration
```
**Solution**: Ensure all required variables are in `.env`

**2. Database Connection Failed**
```
Error: Failed to connect to Supabase
```
**Solution**: Check Supabase URL and key, verify network connectivity

**3. API Rate Limits**
```
Error: Rate limit exceeded
```
**Solution**: Add delays between tests or use mock data

**4. Image Processing Timeout**
```
Error: Vision API timeout
```
**Solution**: Check API endpoint, increase timeout in config

### Debug Mode

Enable verbose logging:
```bash
LOG_LEVEL=debug npx ts-node test-e2e.ts
```

## Best Practices

1. **Run tests before deployment**: Always run E2E tests before pushing to production
2. **Use fresh test data**: Clean up test transactions between runs
3. **Monitor API usage**: Track API calls to avoid rate limits
4. **Test with real images**: Periodically test with actual receipt images
5. **Update test cases**: Add new test cases as features are added
6. **Document failures**: Log and document any test failures for analysis

## Performance Benchmarks

Expected test execution times:
- E-wallet tests: ~10-15 seconds
- Physical receipt tests: ~10-15 seconds
- Edge case tests: ~5-10 seconds
- Stats validation: ~5 seconds
- Concurrent user tests: ~10-15 seconds
- Complete workflow: ~5 seconds

**Total expected duration**: 45-60 seconds

## Requirements Coverage

This E2E test suite validates the following requirements:

- **1.1**: Image reception and processing
- **1.2**: Vision API extraction
- **1.3**: E-wallet format handling
- **1.5**: Error notification for poor quality images
- **2.1**: Automatic categorization
- **2.2**: Context-based classification
- **2.3**: High confidence auto-assignment
- **3.1**: Supabase storage
- **3.2**: Complete transaction data storage
- **3.3**: User association
- **4.1**: Telegram bot authentication
- **4.2**: Photo message handling
- **4.3**: Confirmation messages
- **5.1-5.6**: LangGraph workflow orchestration
- **6.1-6.5**: API integration and error handling
- **7.1-7.5**: Configuration and deployment

## Next Steps

After running E2E tests:
1. Review test output for any warnings or errors
2. Address any failed validations
3. Update test cases for new features
4. Document any edge cases discovered
5. Consider adding performance tests
6. Set up automated testing in CI/CD pipeline

## Support

For issues or questions about E2E testing:
1. Check this documentation
2. Review test output logs
3. Check individual component tests
4. Consult the main README.md
5. Review requirements and design documents
