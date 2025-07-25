// Test utility to verify backend connection
import io from 'socket.io-client';

export async function testBackendConnection(url: string, userId: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log('Testing connection to:', url);
    
    const socket = io(url, {
      transports: ['websocket'],
      timeout: 5000,
    });

    let isResolved = false;

    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        console.log('Connection test timed out');
        socket.close();
        resolve(false);
      }
    }, 5000);

    socket.on('connect', () => {
      console.log('✅ Connected to backend successfully');
      
      // Test setup
      socket.emit('setup', {
        setup: {
          user_id: userId,
          session_type: 'voice_chat'
        }
      });
    });

    socket.on('setup_complete', (data) => {
      console.log('✅ Setup completed:', data);
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        socket.close();
        resolve(true);
      }
    });

    socket.on('connect_error', (error) => {
      console.log('❌ Connection failed:', error.message);
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        resolve(false);
      }
    });

    socket.on('error', (error) => {
      console.log('❌ Socket error:', error);
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        socket.close();
        resolve(false);
      }
    });
  });
}

export function testAudioFeatures(): Record<string, boolean> {
  const results: { [key: string]: boolean } = {};
  
  // Test MediaRecorder support
  results.mediaRecorder = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm');
  
  // Test AudioContext support
  results.audioContext = typeof AudioContext !== 'undefined' || typeof (window as Window & { webkitAudioContext?: unknown }).webkitAudioContext !== 'undefined';
  
  // Test getUserMedia support
  results.getUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  
  // Test WebSocket support
  results.webSocket = typeof WebSocket !== 'undefined';
  
  // Test base64 encoding/decoding
  try {
    const test = btoa('test');
    results.base64 = atob(test) === 'test';
  } catch {
    results.base64 = false;
  }
  
  console.log('🔧 Audio feature support:', results);
  return results;
}