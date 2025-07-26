# TourGuide AI Frontend

A modern Next.js 15 application providing an immersive voice-first tour guide experience with 3D audio visualizations, real-time location awareness, and intelligent bookmark management.

## 🚀 Features

- **Voice-First Interface**: Natural voice conversations with real-time audio streaming
- **3D Audio Visualization**: Interactive sphere that responds to voice interactions using Three.js
- **Real-time Location**: Automatic location detection with Google Maps integration
- **Smart Bookmarks**: Vector-based bookmark search and storage
- **Multi-language Support**: 30+ languages with intuitive language selector
- **Secure Authentication**: Clerk authentication with social login options
- **Responsive Design**: Mobile-first design with Tailwind CSS

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Audio Recorder │◄──►│  WebSocket       │◄──►│  Backend WS     │
│  Component      │    │  Provider        │    │  Server         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│  3D Audio       │    │  Location        │
│  Visualization  │    │  Services        │
└─────────────────┘    └──────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│  Bookmark       │    │  Language        │
│  Management     │    │  Selector        │
└─────────────────┘    └──────────────────┘
```

## 📁 Project Structure

```
src/
├── app/                         # Next.js 15 App Router
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Landing page
│   ├── voice/
│   │   └── page.tsx            # Main voice interface
│   ├── sign-in/
│   │   └── [[...sign-in]]/     # Clerk sign-in
│   └── sign-up/
│       ├── [[...sign-up]]/     # Clerk sign-up
│       └── sso-callback/       # SSO callback handler
├── components/
│   ├── ui/                     # Reusable UI components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   ├── avatar.tsx
│   │   ├── progress.tsx
│   │   └── scroll-area.tsx
│   ├── voice/                  # Voice-specific components
│   │   ├── Bookmarks.tsx
│   │   └── StoryMode.tsx
│   ├── AudioRecorder.tsx       # Main audio recording component
│   ├── AudioPlayer.tsx         # Audio playback handling
│   ├── AudioVisualization3D.tsx # 3D sphere visualization
│   ├── Chat.tsx               # Chat interface (legacy)
│   ├── LanguageSelector.tsx   # Language selection component
│   └── WebSocketProvider.tsx  # WebSocket context provider
├── services/
│   ├── googleMapsService.ts   # Google Maps API integration
│   └── locationService.ts     # Location utilities
├── hooks/
│   └── useGeolocation.ts      # Geolocation custom hook
└── utils/
    └── worklets/              # Audio worklets for processing
```

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS 3.4
- **3D Graphics**: Three.js with @react-three/fiber
- **Authentication**: Clerk
- **WebSocket**: Socket.io-client
- **UI Components**: Radix UI primitives
- **Animation**: Framer Motion
- **Maps**: Google Maps JavaScript API

## ⚙️ Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment setup**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Configure your `.env.local` file:
   ```env
   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/voice
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/voice
   
   # Backend Configuration
   NEXT_PUBLIC_BACKEND_URL=ws://localhost:9084
   NEXT_PUBLIC_API_URL=http://localhost:9084
   
   # Google Maps
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   
   # WebSocket Configuration
   NEXT_PUBLIC_WS_TIMEOUT=10000
   NEXT_PUBLIC_MAX_RECONNECT_ATTEMPTS=5
   ```

## 🚀 Development

### Available Scripts

```bash
# Development server with Turbopack
npm run dev

# Production build
npm run build

# Start production server
npm run start

# Lint code
npm run lint
```

### Development Server

```bash
npm run dev
```

Application will be available at `http://localhost:3000`

## 🎨 Key Components

### AudioVisualization3D

Interactive 3D sphere using Three.js:

```typescript
interface Props {
  isUserSpeaking: boolean
  isAISpeaking: boolean
  audioLevel: number
  playbackLevel: number
  isConnected: boolean
}
```

**Features:**
- Real-time sphere scaling based on audio levels
- Different animations for user vs AI speaking
- Smooth color transitions and rotations
- WebGL-optimized rendering

### WebSocketProvider

Context provider for real-time communication:

```typescript
interface WebSocketContextType {
  isConnected: boolean
  lastTranscription: TranscriptionData | null
  playbackAudioLevel: number
  sendAudioChunk: (data: ArrayBuffer, isFinal: boolean) => void
  saveBookmark: (content: string, type: string) => void
}
```

**Features:**
- Automatic reconnection with exponential backoff
- Audio chunk streaming
- Real-time transcription handling
- Bookmark management

### LanguageSelector

Multi-language support component:

```typescript
interface Language {
  code: string    // BCP-47 language code
  name: string    // Display name
  flag: string    // Unicode flag emoji
}
```

**Features:**
- 30+ supported languages
- Flag-based visual identification
- Smooth dropdown animations
- Persistent language selection

## 🌍 Location Services

### GoogleMapsService

Comprehensive location handling:

```typescript
// Key methods
getExactLocationFromCoordinates(lat: number, lng: number): Promise<LocationData>
getNearbyPlaces(lat: number, lng: number, radius: number, type: string): Promise<Place[]>
```

**Features:**
- Smart city detection (handles neighborhoods like "Halanayakanahalli" → "Bengaluru")
- Nearby attractions discovery
- Reverse geocoding with fallbacks
- Formatted output for AI consumption

## 🐳 Docker

### Development

```bash
# Build image
docker build -t tour-frontend .

# Run container
docker run -p 3000:3000 tour-frontend
```

### Production

Optimized Dockerfile with Next.js standalone output for Railway deployment.

## 🚀 Deployment

### Railway

```bash
# Deploy to Railway
railway login
railway link
railway up
```

### Vercel (Recommended for frontend)

```bash
# Deploy to Vercel
npx vercel --prod
```

---

For main project documentation, see the [root README](../README.md).
