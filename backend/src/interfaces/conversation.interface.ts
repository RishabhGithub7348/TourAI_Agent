export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AudioChunk {
  mime_type: string;
  data: string;
}

export interface RealtimeInput {
  media_chunks: AudioChunk[];
}

export interface AudioData {
  data: string;
  mimeType: string;
}

export interface MediaData {
  data: string;
  mimeType: string;
}

export interface WebSocketMessage {
  realtime_input?: RealtimeInput;
  text?: string;
  audio?: string | AudioData;
  media?: MediaData;
  setup?: any;
  audioStreamEnd?: boolean;
}


export interface MemoryResult {
  id?: string;
  memory: string;
  score: number;
}