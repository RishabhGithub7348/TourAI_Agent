# Enhanced Tour Guide Voice Agent with Google Gemini Live API

A powerful NestJS-based voice-to-voice tour guide AI agent using Google Gemini Live API with comprehensive tools and long-term memory capabilities.

## Features

### 🎙️ Voice & Communication
- Real-time voice conversation with Google Gemini Live API
- WebSocket-based communication for real-time audio streaming
- Audio transcription and processing
- Text and voice response support

### 🧠 Intelligence & Memory
- Long-term conversation memory using mem0ai cloud API
- Personalized recommendations based on user history
- Context-aware responses that remember past interactions

### 🔧 Powerful Tools Integration
- **Google Search**: Real-time web search for current information
- **Code Execution**: Python code execution for calculations and data analysis
- **Custom Tour Guide Tools**:
  - Weather information for any location
  - Nearby attractions and points of interest
  - Turn-by-turn directions with multiple transport modes
  - Restaurant and dining recommendations
  - Transportation options comparison

### 🌍 Tour Guide Capabilities
- Comprehensive destination information
- Cultural insights and historical facts
- Budget calculations and currency conversion
- Itinerary planning and optimization
- Safety tips and accessibility information

## Prerequisites

- Node.js (v18 or higher)
- Google AI API key (for Gemini Live API + Google Search)
- Google Maps API key (for Places, Directions, Geocoding)
- Mem0 AI API key (for memory)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```env
   GOOGLE_API_KEY=your_google_ai_api_key_here
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   MEM0_API_KEY=your_mem0_api_key_here
   WEBSOCKET_PORT=9084
   ```

3. **Get API Keys:**
   - **Google AI API Key**: Get from [Google AI Studio](https://aistudio.google.com/app/apikey)
     - This provides access to both Gemini Live API and Google Search
   - **Google Maps API Key**: Get from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
     - Enable: Places API, Directions API, Geocoding API
   - **Mem0 AI API Key**: Get from [Mem0 Platform](https://app.mem0.ai/)

4. **Build and start the application:**
   ```bash
   # Development mode
   npm run start:dev

   # Production build
   npm run build
   npm run start:prod
   ```

## WebSocket API

The application runs a WebSocket server on port 9084 (configurable via environment).

### Connection

Connect to `ws://localhost:9084`

### Message Types

1. **Setup Configuration:**
   ```json
   {
     "setup": {
       "system_instruction": "Custom system instruction",
       "tools": []
     }
   }
   ```

2. **Real-time Audio Input:**
   ```json
   {
     "realtime_input": {
       "media_chunks": [
         {
           "mime_type": "audio/pcm",
           "data": "base64_encoded_audio_data"
         }
       ]
     }
   }
   ```

3. **Text Input:**
   ```json
   {
     "text": "Your message here"
   }
   ```

### Events Received

- `connected`: Connection established with session info
- `setup_complete`: Configuration completed
- `text`: Text response from the assistant
- `audio`: Base64-encoded audio response
- `error`: Error messages

## Architecture

- **VoiceGateway**: WebSocket gateway handling real-time communication
- **GeminiService**: Integration with Google Gemini Live API + multi-tool support
- **MemoryService**: Long-term conversation memory using mem0ai cloud API
- **ToolsService**: Custom tour guide tools and function handling
- **AudioUtils**: Audio processing utilities for PCM to WAV conversion

## Tools & Capabilities

### Built-in Tools
1. **Google Search** - Real-time web search for current information (including weather)
2. **Code Execution** - Python code execution for complex calculations
3. **Memory System** - Long-term conversation memory using mem0ai cloud API

### Real-Time Custom Tour Guide Tools
1. **Nearby Attractions** - `get_nearby_attractions(location, radius)` - Google Places API
2. **Directions** - `get_directions(from, to, mode)` - Google Directions API
3. **Dining Recommendations** - `get_dining_recommendations(location, cuisine?)` - Google Places API
4. **Transportation Options** - `get_transportation_options(from, to)` - Google Directions API

### Example Real-Time Conversations
- *"What's the weather like in Paris today?"* → Real weather data via Google Search
- *"Find tourist attractions near the Eiffel Tower"* → Live Google Places data with ratings
- *"How do I get from Times Square to Central Park by subway?"* → Real Google Transit directions
- *"Find Italian restaurants near the Colosseum"* → Live restaurant data with ratings and hours
- *"Calculate travel costs for 3 days in Tokyo"* → Code execution for complex calculations
- *"Search for current events in London this weekend"* → Google Search integration

## Error Handling

- WebSocket exception filter for graceful error handling
- Comprehensive logging throughout the application
- Automatic session cleanup on disconnect

## Development

Run in development mode with hot reload:
```bash
npm run start:dev
```

## Client Integration

This backend is designed to work with frontend clients that can:
- Establish WebSocket connections
- Send/receive real-time audio data (PCM format)
- Handle base64-encoded audio responses
- Display text transcriptions and responses

The original Python reference implementation shows the expected client behavior and message formats.