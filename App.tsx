
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TwitchMessage, ConnectionStatus, AppSettings, AIResponse } from './types';
import { GoogleGenAI, Modality } from "@google/genai";
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import AudioPlayer from './components/AudioPlayer';

const DEFAULT_SETTINGS: AppSettings = {
  channelName: '',
  aiPersonality: 'You are a witty, youthful, and high-energy Twitch stream companion named Aura. Keep your responses short (under 15 words), trendy, and interactive. Use a youthful tone and react with excitement to the chat messages.',
  voiceName: 'Puck',
  isAutoSpeak: true,
  ignoredUsers: ['Nightbot', 'StreamElements'],
  responseCooldown: 15, // Default to a safer 15s for free tier users
};

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [twitchStatus, setTwitchStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [messages, setMessages] = useState<TwitchMessage[]>([]);
  const [aiResponses, setAiResponses] = useState<AIResponse[]>([]);
  const [isAIPause, setIsAIPause] = useState(false);
  const [isFeedPaused, setIsFeedPaused] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  
  const twitchSocketRef = useRef<WebSocket | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const chatQueueRef = useRef<TwitchMessage[]>([]);
  const isProcessingRef = useRef<boolean>(false);
  const lastProcessedTimeRef = useRef<number>(0);

  // Use refs for states needed in WebSocket/Interval callbacks to avoid stale closures
  const isFeedPausedRef = useRef(isFeedPaused);
  useEffect(() => {
    isFeedPausedRef.current = isFeedPaused;
  }, [isFeedPaused]);

  // Countdown timer for Rate Limit UI
  useEffect(() => {
    let timer: number;
    if (isRateLimited && cooldownRemaining > 0) {
      timer = window.setInterval(() => {
        setCooldownRemaining(prev => {
          if (prev <= 1) {
            setIsRateLimited(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRateLimited, cooldownRemaining]);

  const processNextInQueue = useCallback(async () => {
    if (isProcessingRef.current || isAIPause || isFeedPaused || !settings.isAutoSpeak || isRateLimited) return;
    if (chatQueueRef.current.length === 0) return;

    // Check settings-based cooldown
    const now = Date.now();
    const timeSinceLast = (now - lastProcessedTimeRef.current) / 1000;
    if (timeSinceLast < settings.responseCooldown) {
      setTimeout(processNextInQueue, 1000);
      return;
    }

    isProcessingRef.current = true;
    const msg = chatQueueRef.current.shift()!;
    
    // Auto-purge old messages if queue is backing up
    if (chatQueueRef.current.length > 2) {
        chatQueueRef.current = chatQueueRef.current.slice(-1);
    }

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
      setAiResponses(prev => prev.map(r => r.id === newResponseId ? { ...r, status: 'processing' as const } : r));
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // STEP 1: Text
      const textResult = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ 
          parts: [{ 
            text: `Twitch message from ${msg.displayName}: "${msg.message}". Respond as Aura (energetic, short, max 10 words). Personality: ${settings.aiPersonality}.` 
          }] 
        }],
      });

      const replyText = textResult.text?.trim() || "Yo!";
      setAiResponses(prev => prev.map(r => r.id === newResponseId ? { ...r, replyText } : r));

      // STEP 2: Audio
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
        status: 'done' as const, 
        audioData: audioBase64 
      } : r));

      if (audioBase64) {
        audioQueueRef.current.push(audioBase64);
      }
      
      lastProcessedTimeRef.current = Date.now();
    } catch (error: any) {
      console.error("AI Error Detail:", error);
      const errorStr = JSON.stringify(error);
      const isRateLimit = errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED') || error?.status === "RESOURCE_EXHAUSTED";
      
      if (isRateLimit) {
          setIsRateLimited(true);
          setCooldownRemaining(90); // Aggressive 90s cooldown to let quota reset
          chatQueueRef.current = []; 
          setAiResponses(prev => prev.map(r => r.id === newResponseId ? { 
            ...r, 
            status: 'error' as const, 
            replyText: 'CRITICAL: Quota Exhausted. System cooling down for 90s...' 
          } : r));
      } else {
          setAiResponses(prev => prev.map(r => r.id === newResponseId ? { 
            ...r, 
            status: 'error' as const, 
            replyText: 'Generation failed. Checking connection...' 
          } : r));
      }
    } finally {
      isProcessingRef.current = false;
      setTimeout(processNextInQueue, 1500);
    }
  }, [settings, isAIPause, isFeedPaused, isRateLimited]);

  const onNewChatMessage = useCallback((msg: TwitchMessage) => {
    if (isFeedPausedRef.current) return;
    
    setMessages(prev => [msg, ...prev].slice(0, 100));
    if (settings.ignoredUsers.some(u => u.toLowerCase() === msg.username.toLowerCase())) return;
    
    chatQueueRef.current.push(msg);
    if (!isProcessingRef.current) {
        processNextInQueue();
    }
  }, [settings.ignoredUsers, processNextInQueue]);

  const connectTwitch = useCallback(() => {
    if (!settings.channelName) return;
    if (twitchSocketRef.current) twitchSocketRef.current.close();

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
      // Check ref directly in the event handler to be as reactive as possible
      if (isFeedPausedRef.current) return;

      const raw = event.data;
      if (raw.includes('PING')) { socket.send('PONG :tmi.twitch.tv'); return; }
      if (raw.includes('PRIVMSG')) {
        const parts = raw.split(';');
        const tags: any = {};
        parts.forEach((p: string) => { const [key, val] = p.split('='); tags[key] = val; });
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
          onNewChatMessage(newMessage);
        }
      }
    };

    socket.onerror = () => setTwitchStatus(ConnectionStatus.ERROR);
    socket.onclose = () => setTwitchStatus(ConnectionStatus.DISCONNECTED);
  }, [settings.channelName, onNewChatMessage]);

  useEffect(() => {
    return () => { if (twitchSocketRef.current) twitchSocketRef.current.close(); };
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
        isFeedPaused={isFeedPaused}
        setIsFeedPaused={setIsFeedPaused}
      />
      
      <main className="flex-1 flex flex-col relative">
        {isRateLimited && (
            <div className="bg-red-600/90 backdrop-blur-md px-4 py-2 flex items-center justify-between text-white text-xs font-bold animate-in slide-in-from-top duration-300 z-50 shadow-lg">
                <div className="flex items-center gap-2">
                    <i className="fa-solid fa-ban"></i>
                    <span>GOOGLE QUOTA EXCEEDED: COOLING DOWN SYSTEM TO RESET LIMITS</span>
                </div>
                <div className="bg-black/20 px-2 py-0.5 rounded tabular-nums">
                    RESUMING IN {cooldownRemaining}s
                </div>
            </div>
        )}

        {isFeedPaused && !isRateLimited && (
            <div className="bg-zinc-800/90 backdrop-blur-md px-4 py-2 flex items-center justify-center text-zinc-300 text-xs font-bold z-50">
                <div className="flex items-center gap-2">
                    <i className="fa-solid fa-pause"></i>
                    <span>CHAT FEED PAUSED - NO MESSAGES BEING RECEIVED</span>
                </div>
            </div>
        )}

        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] ${twitchStatus === ConnectionStatus.CONNECTED ? 'bg-green-500 shadow-green-500/50' : 'bg-red-500 shadow-red-500/50 animate-pulse'}`} />
            <h1 className="font-bold text-lg tracking-tight">
              {settings.channelName ? `#${settings.channelName}` : 'Companion Offline'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setIsFeedPaused(!isFeedPaused)}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isFeedPaused ? 'bg-purple-600 border-purple-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'}`}
             >
               <i className={`fa-solid ${isFeedPaused ? 'fa-play' : 'fa-pause'}`}></i>
               {isFeedPaused ? 'RESUME FEED' : 'PAUSE FEED'}
             </button>
             <div className="px-3 py-1 rounded-full bg-zinc-800 text-[10px] uppercase font-bold tracking-widest border border-zinc-700 text-zinc-400 flex items-center gap-2">
               <span className={`w-1.5 h-1.5 rounded-full ${isFeedPaused ? 'bg-zinc-600' : 'bg-blue-500 animate-pulse'}`}></span>
               Queue: {chatQueueRef.current.length}
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
