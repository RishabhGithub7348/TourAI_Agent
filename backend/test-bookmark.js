// Simple test script to verify bookmark functionality
const axios = require('axios');

async function testBookmarks() {
  const baseUrl = 'http://localhost:3000';
  const testUserId = 'test_user_file_storage';
  
  console.log('🧪 Testing bookmark functionality...');
  
  try {
    // Test saving a bookmark
    console.log('\n1. Testing bookmark save...');
    const saveResponse = await axios.post(`${baseUrl}/test/bookmark`, {
      content: 'Amazing street food vendor in Bangkok that serves incredible pad thai with secret tamarind sauce',
      userId: testUserId
    });
    
    console.log('Save result:', saveResponse.data);
    
    // Test retrieving bookmarks
    console.log('\n2. Testing bookmark retrieval...');
    const getResponse = await axios.get(`${baseUrl}/test/bookmarks/${testUserId}`);
    
    console.log('Get result:', getResponse.data);
    
    console.log('\n✅ Test completed! Check the console logs in your backend for detailed debug info.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testBookmarks();