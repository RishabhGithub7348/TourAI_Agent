# TourGuide AI Backend

NestJS-based WebSocket server providing real-time AI tour guide services with Google Gemini Live API integration, location services, and intelligent bookmark management.

## 🏗️ Architecture

The backend serves as a WebSocket gateway that orchestrates multiple AI and location services:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Frontend WS    │◄──►│   Voice Gateway  │◄──►│  Gemini Live    │
│  Connection     │    │                  │    │  API            │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Service Layer   │
                       │  • Gemini        │
                       │  • Pinecone      │
                       │  • Tools         │
                       │  • Maps          │
                       └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  External APIs   │
                       │  • Pinecone      │
                       │  • Google Maps   │
                       │  • OpenAI        │
                       │  • Google Search │
                       └──────────────────┘
```

## 🚀 Features

- **Real-time Voice Processing**: WebSocket-based audio streaming
- **Google Gemini Live**: Advanced AI conversation capabilities
- **Location Intelligence**: Google Maps API integration with smart city detection
- **Vector Memory**: Pinecone-powered semantic bookmark storage
- **Tool Integration**: Google Search for real-time information
- **Multi-language Support**: BCP-47 language code support
- **File Fallback**: Local JSON storage when vector DB is unavailable

## 📁 Project Structure

```
src/
├── gateways/
│   └── voice.gateway.ts         # WebSocket gateway for voice communication
├── services/
│   ├── gemini.service.ts        # Google Gemini Live API integration
│   ├── pinecone.service.ts      # Vector database operations
│   ├── tools.service.ts         # Google Search tool integration
│   └── maps.service.ts          # Google Maps API service
├── interfaces/
│   └── conversation.interface.ts # TypeScript interfaces
└── main.ts                      # Application bootstrap
```

## 🛠️ Tech Stack

- **Framework**: NestJS 11.x
- **WebSocket**: Socket.io 4.8
- **AI**: Google Gemini Live API
- **Vector DB**: Pinecone Database
- **Embeddings**: OpenAI text-embedding-3-small
- **Maps**: Google Maps Geocoding API
- **Search**: Google Custom Search API
- **Audio**: WAV file processing

## ⚙️ Prerequisites

- Node.js (v18 or higher)
- Google AI API key (for Gemini Live API)
- Google Maps API key (for Places, Directions, Geocoding)
- Pinecone API key (for vector database)
- OpenAI API key (for embeddings)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment setup**
   ```bash
   cp .env.example .env
   ```
   
   Configure your `.env` file:
   ```env
   # Google APIs
   GOOGLE_API_KEY=your_google_gemini_api_key
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   
   # Vector Database
   PINECONE_API_KEY=your_pinecone_api_key
   PINECONE_ENVIRONMENT=us-east-1-aws
   PINECONE_INDEX_NAME=tour-bookmarks
   
   # OpenAI
   OPENAI_API_KEY=your_openai_api_key
   
   # Server Configuration
   PORT=9084
   ```

3. **Get API Keys:**
   - **Google AI API Key**: Get from [Google AI Studio](https://aistudio.google.com/app/apikey)
   - **Google Maps API Key**: Get from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
     - Enable: Places API, Directions API, Geocoding API
   - **Pinecone API Key**: Get from [Pinecone Console](https://app.pinecone.io/)
   - **OpenAI API Key**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)

## 🚀 Development

### Available Scripts

```bash
# Development with hot reload
npm run start:dev

# Production build
npm run build

# Start production server
npm run start:prod

# Run tests
npm run test

# Format code
npm run format
```

### Development Server

```bash
npm run start:dev
```

Server will start on `http://localhost:9084` with WebSocket support.

## 🌐 API Endpoints

### WebSocket Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join-room` | `{ userId: string, locationData: object }` | Join conversation room |
| `voice-chunk` | `{ audioData: Buffer, isFinal: boolean }` | Send audio chunk |
| `bookmark-save` | `{ content: string, type: string }` | Save bookmark |
| `bookmark-get` | `{ query?: string }` | Retrieve bookmarks |
| `language-change` | `{ language: string }` | Change conversation language |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `transcription` | `{ text: string, sender: string, finished: boolean }` | Real-time transcription |
| `voice-response` | `{ audioData: Buffer }` | AI voice response |
| `bookmark-saved` | `{ success: boolean, id?: string }` | Bookmark save confirmation |
| `bookmarks-list` | `{ bookmarks: object[] }` | Retrieved bookmarks |
| `error` | `{ message: string, code?: string }` | Error notification |

## 🧩 Services

### GeminiService

Handles Google Gemini Live API integration:

```typescript
// Key methods
startLiveSession(userId: string, language: string): Promise<void>
sendAudioChunk(userId: string, audioData: Buffer): Promise<void>
endSession(userId: string): Promise<void>
```

**Features:**
- Real-time audio streaming
- Tool calling for search and maps
- Multi-language support
- Context-aware responses

### PineconeService

Vector database operations for intelligent bookmarks:

```typescript
// Key methods
saveBookmark(userId: string, content: string, type: string): Promise<string>
searchBookmarks(userId: string, query: string): Promise<object[]>
getUserBookmarks(userId: string): Promise<object[]>
```

**Features:**
- Semantic search using OpenAI embeddings
- User-scoped bookmark storage
- File-based fallback system
- Vector similarity matching

### MapsService

Google Maps API integration:

```typescript
// Key methods
getExactLocationFromCoordinates(lat: number, lng: number): Promise<object>
getNearbyPlaces(lat: number, lng: number, radius: number): Promise<object[]>
searchPlaces(query: string): Promise<object[]>
```

**Features:**
- Smart city detection (handles neighborhoods)
- Nearby attractions discovery
- Reverse geocoding
- Place search functionality

### ToolsService

Google Search integration for real-time information:

```typescript
// Key methods
searchGoogle(query: string): Promise<object[]>
formatSearchResults(results: object[]): string
```

**Features:**
- Real-time web search
- Travel-focused result filtering
- Context-aware search queries

## 🐳 Docker

### Development

```bash
# Build image
docker build -t tour-backend .

# Run container
docker run -p 9084:9084 --env-file .env tour-backend
```

### Production

The Dockerfile uses multi-stage builds for optimization:

```dockerfile
# Dependencies stage
FROM node:18-alpine AS builder
# ... build process

# Production stage  
FROM node:18-alpine AS production
# ... optimized runtime
```

## 🔐 Security

- **API Key Protection**: All sensitive keys stored in environment variables
- **CORS Configuration**: Restricted to frontend domain
- **Input Validation**: Sanitized user inputs
- **Rate Limiting**: WebSocket connection limits
- **Non-root Container**: Docker security best practices

---

For main project documentation, see the [root README](../README.md).