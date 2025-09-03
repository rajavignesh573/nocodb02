// Test ID extraction logic
const { ProductMatchingService } = require('./dist/services/ProductMatchingService');

// Create a mock service instance to test the private method
class TestService extends ProductMatchingService {
  constructor() {
    super(null); // Mock ncMeta
  }
  
  // Make the private method public for testing
  testExtractNumericId(productId) {
    return this.extractNumericId(productId);
  }
}

const service = new TestService();

console.log('🧪 Testing ID Extraction Logic\n');

// Test cases
const testCases = [
  { input: 'int-123', expected: '123', description: 'String format with int- prefix' },
  { input: 'int-2526', expected: '2526', description: 'Existing format int-2526' },
  { input: 'int-674', expected: '674', description: 'Existing format int-674' },
  { input: '123', expected: '123', description: 'Pure numeric string' },
  { input: 'product-456', expected: 'product-456', description: 'Different prefix (unchanged)' },
  { input: '20738', expected: '20738', description: 'moombs_int_product ID format' },
  { input: 'int-', expected: '', description: 'Edge case: just prefix' },
  { input: '', expected: '', description: 'Empty string' }
];

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  try {
    const result = service.testExtractNumericId(testCase.input);
    const success = result === testCase.expected;
    
    if (success) {
      console.log(`✅ Test ${index + 1}: ${testCase.description} - PASSED`);
      console.log(`   Input: "${testCase.input}" → Output: "${result}"`);
      passed++;
    } else {
      console.log(`❌ Test ${index + 1}: ${testCase.description} - FAILED`);
      console.log(`   Input: "${testCase.input}"`);
      console.log(`   Expected: "${testCase.expected}", Got: "${result}"`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ Test ${index + 1}: ${testCase.description} - ERROR`);
    console.log(`   Input: "${testCase.input}"`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
  
  console.log('');
});

console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All tests passed! ID extraction logic is working correctly.');
  console.log('\n💡 This means:');
  console.log('   - Legacy IDs like "int-2526" → "2526" for database lookup');
  console.log('   - New integer IDs like "123" → "123" (unchanged)');
  console.log('   - Backward compatibility maintained for existing matches');
} else {
  console.log('⚠️ Some tests failed. Please review the logic.');
}
