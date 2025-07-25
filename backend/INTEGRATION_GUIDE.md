# Frontend-Backend Integration Guide

## Overview
This guide explains how the frontend is integrated with your Gemini Live API backend for real-time voice communication.

## Architecture

### Backend (NestJS + Gemini Live API)
- **Port**: 9084
- **Protocol**: WebSocket (Socket.io)
- **Audio Format**: PCM 24kHz mono
- **Features**: 
  - Real-time voice conversation with Gemini
  - Text messaging
  - Memory management
  - Tool integration (Google Search, Code Execution)

### Frontend (Next.js + React)
- **Framework**: Next.js 15 with React 19
- **Authentication**: Clerk
- **Real-time**: Socket.io-client
- **Audio**: Web Audio API + MediaRecorder API
- **UI**: Tailwind CSS + Framer Motion

## Key Integration Points

### 1. WebSocket Connection (`useWebSocket` hook)
```typescript
// Connects to backend with auto-reconnection
const { isConnected, sendAudio, sendText } = useWebSocket({
  url: process.env.NEXT_PUBLIC_BACKEND_URL,
  userId: user?.id,
  onMessage: handleMessage
});
```

### 2. Audio Processing (`useAudio` hooks)
```typescript
// Records audio and converts to PCM format
const { startRecording, stopRecording, getPCMData } = useAudioRecording();
const { playAudio } = useAudioPlayback();
```

### 3. Audio Format Conversion
- **Frontend**: Records WebM, converts to PCM 24kHz
- **Backend**: Expects PCM format for Gemini Live API
- **Conversion**: Handled by `AudioUtils.convertToPCM()`

## Setup Instructions

### 1. Environment Configuration
Update `.env` files:

**Frontend (.env)**:
```
NEXT_PUBLIC_BACKEND_URL=ws://localhost:9084
NEXT_PUBLIC_API_URL=http://localhost:9084
```

**Backend (.env)**:
```
GOOGLE_API_KEY=your_gemini_api_key
PORT=9084
```

### 2. Start Services
```bash
# Terminal 1: Backend
cd /path/to/backend
npm install
npm run start:dev

# Terminal 2: Frontend  
cd /path/to/frontend
npm install
npm run dev
```

### 3. Test Connection
Navigate to `http://localhost:3000/voice` and:
1. Sign in with Clerk
2. Check connection status (green dot = connected)
3. Test text messaging
4. Test voice recording (hold voice button)

## Features

### Real-time Voice Chat
- **Hold to Talk**: Press and hold the microphone button
- **Audio Feedback**: Visual waveform during recording
- **Instant Playback**: Assistant responses play automatically

### Text Messaging
- **Typed Messages**: Regular chat interface
- **Keyboard Shortcuts**: Enter to send

### Connection Management
- **Auto-reconnection**: Up to 5 attempts with 3s delay
- **Manual Retry**: Retry button when disconnected
- **Status Indicators**: Clear connection status display

### Error Handling
- **Audio Permissions**: Graceful fallback for denied permissions
- **Network Issues**: Automatic reconnection with user feedback
- **Format Errors**: Detailed logging for debugging

## Audio Pipeline

### Recording Flow
1. User presses voice button
2. Request microphone permission
3. Start MediaRecorder (WebM format)
4. Convert to PCM on stop
5. Send via WebSocket to backend
6. Backend forwards to Gemini Live API

### Playback Flow
1. Gemini generates audio response
2. Backend receives PCM/MP3 data
3. Forward to frontend via WebSocket
4. Frontend plays audio directly

## Troubleshooting

### Common Issues

**Connection Failed**
- Check backend is running on port 9084
- Verify CORS settings allow frontend origin
- Check firewall/network restrictions

**Audio Not Working**
- Ensure HTTPS (required for audio in production)
- Check microphone permissions
- Verify browser audio support

**Poor Audio Quality**
- Check microphone settings
- Ensure stable internet connection
- Verify PCM conversion is working

### Debug Tools

**Connection Test**:
```typescript
import { testBackendConnection } from '@/utils/testConnection';
const isConnected = await testBackendConnection(url, userId);
```

**Feature Detection**:
```typescript
import { testAudioFeatures } from '@/utils/testConnection';
const features = testAudioFeatures();
```

## Production Deployment

### Frontend
- Deploy to Vercel/Netlify
- Ensure HTTPS for audio permissions
- Update `NEXT_PUBLIC_BACKEND_URL` to production backend

### Backend
- Deploy to cloud platform (AWS/GCP/Azure)
- Configure WebSocket support
- Set up SSL/TLS for secure connections
- Update CORS origins

### Security
- API keys in environment variables only
- Rate limiting on WebSocket connections
- Input validation on all messages
- HTTPS/WSS in production

## API Reference

### WebSocket Events

**Client → Server**:
- `setup`: Initialize session
- `text`: Send text message
- `realtime_input`: Send audio data

**Server → Client**:
- `connected`: Session established
- `setup_complete`: Ready for communication
- `text`: Text response from Gemini
- `audio`: Audio response from Gemini
- `error`: Error messages

### Audio Format Specifications
- **Sample Rate**: 24kHz (required by Gemini)
- **Channels**: Mono (1 channel)
- **Format**: 16-bit PCM
- **Encoding**: Base64 for WebSocket transport