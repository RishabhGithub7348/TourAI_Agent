# TourGuide AI

A sophisticated AI-powered tour guide application that provides real-time travel assistance through voice interactions, featuring 3D audio visualizations, location-aware recommendations, and intelligent bookmark management.


### Watch the TourGuide AI Application Documentary Video

[![chatbot](https://github.com/user-attachments/assets/805e9b0d-fa69-40ed-a6e2-35cfbcaa2572)](https://www.youtube.com/watch?v=XU2K9PIML48)

### The TourGuide AI is deployed on Railway.app :  [TourGuide AI](https://frontend-tour-agent-guide-production.up.railway.app/)

## 🚀 Features

- **Voice-First Interface**: Natural voice conversations with Google Gemini Live API
- **3D Audio Visualization**: Interactive sphere that responds to voice interactions
- **Location Intelligence**: Automatic location detection with Google Maps integration
- **Smart Bookmarks**: Vector-based bookmark storage using Pinecone for semantic search
- **Multi-language Support**: 30+ languages with BCP-47 code support
- **Real-time Information**: Google Search integration for up-to-date travel data
- **Secure Authentication**: Clerk authentication with social login options

## 🏗️ Architecture

```
tour/
├── frontend/          # Next.js 15 React application
├── backend/           # NestJS WebSocket server
├── docker-compose.yml # Docker orchestration
└── README.md         # This file
```

### Tech Stack

**Frontend:**
- Next.js 15 with App Router
- React 19 with TypeScript
- Three.js for 3D visualizations
- Tailwind CSS for styling
- Clerk for authentication
- Socket.io for real-time communication

**Backend:**
- NestJS framework
- WebSocket with Socket.io
- Google Gemini Live API
- Google Maps API
- Pinecone Vector Database
- OpenAI Embeddings API

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker (optional)
- Google Cloud API key
- Clerk authentication keys
- Pinecone API key
- OpenAI API key

### Environment Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd tour
   ```

2. **Backend Environment Variables**
   ```bash
   cd backend
   cp .env.example .env
   ```
   
   Fill in your `.env` file:
   ```env
   GOOGLE_API_KEY=your_google_api_key
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   OPENAI_API_KEY=your_openai_api_key
   PINECONE_API_KEY=your_pinecone_api_key
   PINECONE_ENVIRONMENT=us-east-1-aws
   PINECONE_INDEX_NAME=tour-bookmarks
   ```

3. **Frontend Environment Variables**
   ```bash
   cd frontend
   cp .env.local.example .env.local
   ```
   
   Fill in your `.env.local` file:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   NEXT_PUBLIC_BACKEND_URL=ws://localhost:9084
   NEXT_PUBLIC_API_URL=http://localhost:9084
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```

### Development Setup

1. **Install dependencies for both services**
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   ```

2. **Start development servers**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run start:dev
   
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:9084

### Docker Deployment

1. **Build and run with Docker Compose**
   ```bash
   docker-compose up --build
   ```

2. **Or build individual services**
   ```bash
   # Backend
   cd backend
   docker build -t tour-backend .
   docker run -p 9084:9084 tour-backend
   
   # Frontend
   cd frontend
   docker build -t tour-frontend .
   docker run -p 3000:3000 tour-frontend
   ```

### Railway Deployment

Both services are configured for Railway deployment with optimized Dockerfiles.

1. **Deploy Backend**
   - Connect your GitHub repository to Railway
   - Set environment variables in Railway dashboard
   - Deploy from `backend/` directory

2. **Deploy Frontend**
   - Create a new Railway service
   - Set environment variables including updated backend URL
   - Deploy from `frontend/` directory

## 📱 Usage

1. **Sign Up/Login**: Create an account using Clerk authentication
2. **Grant Location Access**: Allow location permissions for personalized recommendations
3. **Start Conversation**: Click the microphone to begin voice interaction
4. **Save Bookmarks**: Say "save this" during conversations to bookmark interesting places
5. **Access Bookmarks**: Click the bookmark icon to view saved locations
6. **Change Language**: Use the language selector to communicate in your preferred language

## 🛠️ Development

### Project Structure

```
backend/
├── src/
│   ├── gateways/          # WebSocket gateways
│   ├── services/          # Business logic
│   ├── interfaces/        # TypeScript interfaces
│   └── main.ts           # Application entry point
├── Dockerfile
└── package.json

frontend/
├── src/
│   ├── app/              # Next.js app router pages
│   ├── components/       # React components
│   ├── services/         # API services
│   └── hooks/            # Custom React hooks
├── Dockerfile
└── package.json
```

### Key Components

- **AudioVisualization3D**: Real-time 3D sphere visualization
- **WebSocketProvider**: Real-time communication management
- **LocationService**: Geolocation and mapping integration
- **PineconeService**: Vector database for semantic search
- **GeminiService**: AI conversation handling

## 🔧 Configuration

### Google APIs

1. Enable Google Maps Geocoding API
2. Enable Google Custom Search API
3. Set up Gemini Live API access

### Pinecone Setup

1. Create a Pinecone account
2. Create an index named `tour-bookmarks`
3. Use dimension 1536 (for OpenAI embeddings)

### Clerk Authentication

1. Create a Clerk application
2. Configure OAuth providers (Google, GitHub, etc.)
3. Set up redirect URLs for your domain

## 🚀 Deployment

The application is optimized for deployment on:

- **Railway** (recommended)
- **Vercel** (frontend only)
- **Google Cloud Run**
- **AWS ECS**
- **Digital Ocean Apps**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the individual service README files for specific setup instructions

---

**Happy traveling with TourGuide AI! 🌍✈️**
