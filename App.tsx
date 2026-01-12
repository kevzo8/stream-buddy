
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TwitchMessage, ConnectionStatus, AppSettings, AIResponse } from './types';
import { GoogleGenAI, Modality } from "@google/genai";
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import AudioPlayer from './components/AudioPlayer';

const DEFAULT_SETTINGS: AppSettings = {
  channelName: '',
  aiPersonality: 'You are a witty, youthful, and high-energy Twitch stream companion named Aura. Keep your responses short (under 15 words), trendy, and interactive. Use a youthful tone and react with excitement to the chat messages.',
  voiceName: 'Puck', // Puck is generally perceived as more youthful/cheerful
  isAutoSpeak: true,
  ignoredUsers: ['Nightbot', 'StreamElements'],
};

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [twitchStatus, setTwitchStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [messages, setMessages] = useState<TwitchMessage[]>([]);
  const [aiResponses, setAiResponses] = useState<AIResponse[]>([]);
  const [isAIPause, setIsAIPause] = useState(false);
  
  const twitchSocketRef = useRef<WebSocket | null>(null);
  const audioQueueRef = useRef<string[]>([]);

  const processChatMessage = useCallback(async (msg: TwitchMessage) => {
    // Basic filtering
    if (!settings.channelName || settings.ignoredUsers.some(u => u.toLowerCase() === msg.username.toLowerCase())) return;
    if (!settings.isAutoSpeak || isAIPause) return;

    const newResponseId = Math.random().toString(36).substr(2, 9);
    const newResponse: AIResponse = {
      id: newResponseId,
      originalMessage: msg.message,
      user: msg.displayName,
      replyText: '',
      status: 'pending',
    };

    setAiResponses(prev => [newResponse, ...prev].slice(0, 50));

    try {
      setAiResponses(prev => prev.map(r => r.id === newResponseId ? { ...r, status: 'processing' } : r));
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // STEP 1: Generate the text response
      const textResult = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ 
          parts: [{ 
            text: `Twitch Chat Input: [User: ${msg.displayName}] says "${msg.message}". 
                   Task: Respond as Aura, a youthful and energetic AI friend. 
                   Personality Rules: ${settings.aiPersonality}. 
                   Output only the text of your response, no emojis or meta-commentary.` 
          }] 
        }],
      });

      const replyText = textResult.text?.trim() || "Yo! Thanks for the chat!";

      // Update UI with the generated text immediately
      setAiResponses(prev => prev.map(r => r.id === newResponseId ? { ...r, replyText } : r));

      // STEP 2: Generate the audio from that text
      const audioResult = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: replyText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: settings.voiceName },
            },
          },
        },
      });

      const audioBase64 = audioResult.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

      setAiResponses(prev => prev.map(r => r.id === newResponseId ? { 
        ...r, 
        status: 'done', 
        audioData: audioBase64 
      } : r));

      if (audioBase64) {
        audioQueueRef.current.push(audioBase64);
      }
    } catch (error) {
      console.error("Gemini Pipeline Error:", error);
      setAiResponses(prev => prev.map(r => r.id === newResponseId ? { 
        ...r, 
        status: 'error', 
        replyText: error instanceof Error ? `Error: ${error.message}` : 'Failed to process.' 
      } : r));
    }
  }, [settings, isAIPause]);

  const connectTwitch = useCallback(() => {
    if (!settings.channelName) return;
    
    if (twitchSocketRef.current) {
      twitchSocketRef.current.close();
    }

    setTwitchStatus(ConnectionStatus.CONNECTING);
    const socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    twitchSocketRef.current = socket;

    socket.onopen = () => {
      socket.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      socket.send('PASS SCHMOOPIIE');
      socket.send('NICK justinfan' + Math.floor(Math.random() * 899999 + 100000));
      socket.send(`JOIN #${settings.channelName.toLowerCase()}`);
      setTwitchStatus(ConnectionStatus.CONNECTED);
    };

    socket.onmessage = (event) => {
      const raw = event.data;
      if (raw.includes('PING')) {
        socket.send('PONG :tmi.twitch.tv');
        return;
      }

      if (raw.includes('PRIVMSG')) {
        const parts = raw.split(';');
        const tags: any = {};
        parts.forEach((p: string) => {
          const [key, val] = p.split('=');
          tags[key] = val;
        });

        const msgMatch = raw.match(/PRIVMSG #\w+ :(.*)/);
        const userMatch = raw.match(/:(\w+)!/);

        if (msgMatch && userMatch) {
          const newMessage: TwitchMessage = {
            id: tags['id'] || Math.random().toString(),
            username: userMatch[1],
            displayName: tags['display-name'] || userMatch[1],
            message: msgMatch[1].trim(),
            timestamp: new Date(),
            color: tags['color'],
          };
          setMessages(prev => [newMessage, ...prev].slice(0, 100));
          processChatMessage(newMessage);
        }
      }
    };

    socket.onerror = () => setTwitchStatus(ConnectionStatus.ERROR);
    socket.onclose = () => setTwitchStatus(ConnectionStatus.DISCONNECTED);

  }, [settings.channelName, processChatMessage]);

  useEffect(() => {
    return () => {
      if (twitchSocketRef.current) twitchSocketRef.current.close();
    };
  }, []);

  return (
    <div className="flex h-screen w-full bg-zinc-950 overflow-hidden text-zinc-100 font-sans">
      <Sidebar 
        settings={settings} 
        setSettings={setSettings} 
        onConnect={connectTwitch}
        status={twitchStatus}
        isAIPause={isAIPause}
        setIsAIPause={setIsAIPause}
      />
      
      <main className="flex-1 flex flex-col relative">
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] ${twitchStatus === ConnectionStatus.CONNECTED ? 'bg-green-500 shadow-green-500/50' : 'bg-red-500 shadow-red-500/50 animate-pulse'}`} />
            <h1 className="font-bold text-lg tracking-tight">
              {settings.channelName ? `#${settings.channelName}` : 'Select a Twitch Channel'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
             <div className="px-3 py-1 rounded-full bg-zinc-800 text-[10px] uppercase font-bold tracking-widest border border-zinc-700 text-zinc-400">
               Gemini Youth-Tune Active
             </div>
          </div>
        </header>

        <Dashboard 
          messages={messages} 
          aiResponses={aiResponses} 
        />

        <AudioPlayer queue={audioQueueRef.current} />
      </main>
    </div>
  );
};

export default App;
