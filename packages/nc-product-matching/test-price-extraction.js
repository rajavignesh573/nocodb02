// Test price extraction logic
const { ProductMatchingService } = require('./dist/services/ProductMatchingService');

// Create a mock service instance to test the private method
class TestService extends ProductMatchingService {
  constructor() {
    super(null); // Mock ncMeta
  }
  
  // Make the private method public for testing
  testExtractPrice(standardPrice) {
    return this.extractPrice(standardPrice);
  }
}

const service = new TestService();

console.log('🧪 Testing Price Extraction Logic\n');

// Test cases
const testCases = [
  // Moombs format
  { input: {"1": 18.84}, expected: 18.84, description: 'Moombs JSONB format {"1": 18.84}' },
  { input: '{"1": 18.84}', expected: 18.84, description: 'Moombs JSON string format' },
  
  // Standard formats
  { input: {price: 25.99}, expected: 25.99, description: 'Standard price field' },
  { input: {amount: 30.50}, expected: 30.50, description: 'Amount field' },
  { input: {value: 15.75}, expected: 15.75, description: 'Value field' },
  
  // JSON string formats
  { input: '{"price": 25.99}', expected: 25.99, description: 'JSON string with price' },
  { input: '{"amount": 30.50}', expected: 30.50, description: 'JSON string with amount' },
  
  // Direct number
  { input: 42.99, expected: 42.99, description: 'Direct number' },
  
  // Edge cases
  { input: null, expected: undefined, description: 'Null value' },
  { input: undefined, expected: undefined, description: 'Undefined value' },
  { input: '', expected: undefined, description: 'Empty string' },
  { input: {}, expected: undefined, description: 'Empty object' },
  { input: '{}', expected: undefined, description: 'Empty JSON string' },
  { input: 'invalid json', expected: undefined, description: 'Invalid JSON string' }
];

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  try {
    const result = service.testExtractPrice(testCase.input);
    const success = result === testCase.expected;
    
    if (success) {
      console.log(`✅ Test ${index + 1}: ${testCase.description} - PASSED`);
      console.log(`   Input: ${JSON.stringify(testCase.input)} → Output: ${result}`);
      passed++;
    } else {
      console.log(`❌ Test ${index + 1}: ${testCase.description} - FAILED`);
      console.log(`   Input: ${JSON.stringify(testCase.input)}`);
      console.log(`   Expected: ${testCase.expected}, Got: ${result}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ Test ${index + 1}: ${testCase.description} - ERROR`);
    console.log(`   Input: ${JSON.stringify(testCase.input)}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
  
  console.log('');
});

console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All tests passed! Price extraction logic is working correctly.');
} else {
  console.log('⚠️ Some tests failed. Please review the logic.');
}
