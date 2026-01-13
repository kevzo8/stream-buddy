
export interface TwitchMessage {
  id: string;
  username: string;
  displayName: string;
  message: string;
  timestamp: Date;
  color?: string;
}

export type LLMProvider = 'gemini' | 'openai' | 'groq' | 'anthropic';
export type VoiceProvider = 'gemini' | 'elevenlabs' | 'openai' | 'browser';

export interface AIResponse {
  id: string;
  originalMessage: string;
  user: string;
  replyText: string;
  audioData?: string;
  isStandardAudio?: boolean; // True for ElevenLabs/OpenAI (MP3), False for Gemini (PCM)
  status: 'pending' | 'processing' | 'done' | 'error';
  voiceStatus?: 'pending' | 'done' | 'error';
  voiceError?: string; // Captured error message from TTS providers
  provider?: LLMProvider;
  voiceProvider?: VoiceProvider;
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface AppSettings {
  channelName: string;
  aiPersonality: string;
  llmProvider: LLMProvider;
  modelName: string;
  voiceProvider: VoiceProvider;
  voiceName: string;
  browserVoiceURI?: string;
  isAutoSpeak: boolean;
  ignoredUsers: string[];
  responseCooldown: number;
  // External Keys
  openaiKey?: string;
  groqKey?: string;
  anthropicKey?: string;
  elevenlabsKey?: string;
  elevenlabsVoiceId?: string;
}
