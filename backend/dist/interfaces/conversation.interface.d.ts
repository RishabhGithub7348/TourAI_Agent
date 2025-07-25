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
export interface WebSocketMessage {
    realtime_input?: RealtimeInput;
    text?: string;
    audio?: string;
    setup?: any;
}
export interface MemoryResult {
    id?: string;
    memory: string;
    score: number;
}
