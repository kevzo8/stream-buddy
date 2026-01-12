
export interface TwitchMessage {
  id: string;
  username: string;
  displayName: string;
  message: string;
  timestamp: Date;
  color?: string;
}

export interface AIResponse {
  id: string;
  originalMessage: string;
  user: string;
  replyText: string;
  audioData?: string;
  status: 'pending' | 'processing' | 'done' | 'error';
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
  voiceName: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
  isAutoSpeak: boolean;
  ignoredUsers: string[];
}
