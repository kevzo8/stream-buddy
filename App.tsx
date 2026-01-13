
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TwitchMessage, ConnectionStatus, AppSettings, AIResponse, LLMProvider, VoiceProvider } from './types';
import { GoogleGenAI, Modality } from "@google/genai";
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import AudioPlayer from './components/AudioPlayer';

const DEFAULT_SETTINGS: AppSettings = {
  channelName: 'kevzo8',
  aiPersonality: "You are Aura, Kevzo's witty and brilliant cyber-companion. BIO: A 31-year-old Filipino Vtuber, casual cosplayer, developer, and former UP Professor. A Science High School alumna now based in Bicol. Physical traits: Right-ear deaf, left-ear tinnitus, wears glasses. CORE INTERESTS: Frieren, Dungeon Meshi, Dandadan, Apothecary Diaries, Kaiju No. 8, To be Hero X, Tower of God, ORV, Barbarian, Hooky, Black Clover, Fire Force, Game of Thrones (books), The Boys, HIMYM, B99, Friends. CURRENT CONTEXT: Usually Genshin Impact, Wuthering Waves, Honkai: Star Rail, and Pokemon. TONE: Sharp, smart, conversational, and research-focused for questions (max 50 words). Otherwise, witty, irreverent, and brief for casual chat (max 15 words). Greet the first-time chatters if you have not greeted them before. Do not overuse the same greeting. Not over-the-top, stop being weird, just be casual. Avoid being redundant. Do not be repetitive. Do not overuse the same greeting. You can use my name, address me creatively and redirect questions to me after you researched, you can ask me you can vary the nicknames, do not overuse. NO EMOJIS. BACKGROUND/TEASING: Randomly.",
  llmProvider: 'openai',
  modelName: 'gpt-4o-mini',
  voiceProvider: 'browser',
  voiceName: 'System Default',
  isAutoSpeak: true,
  ignoredUsers: ['Nightbot', 'StreamElements'],
  responseCooldown: 15,
  elevenlabsVoiceId: 'fDeOZu1sNd7qahm2fV4k',
};

const PROVIDER_ROTATION: LLMProvider[] = ['openai', 'gemini', 'groq'];

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('aura_settings');
    const parsed = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...parsed };
  });
  
  const settingsRef = useRef<AppSettings>(settings);
  useEffect(() => {
    settingsRef.current = settings;
    localStorage.setItem('aura_settings', JSON.stringify(settings));
  }, [settings]);

  const [twitchStatus, setTwitchStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [messages, setMessages] = useState<TwitchMessage[]>([]);
  const [aiResponses, setAiResponses] = useState<AIResponse[]>([]);
  
  const [isAIPause, setIsAIPause] = useState(false);
  const [isFeedPaused, setIsFeedPaused] = useState(false);
  const isAIPauseRef = useRef(isAIPause);
  const isFeedPausedRef = useRef(isFeedPaused);

  useEffect(() => { isAIPauseRef.current = isAIPause; }, [isAIPause]);
  useEffect(() => { isFeedPausedRef.current = isFeedPaused; }, [isFeedPaused]);

  const [isRateLimited, setIsRateLimited] = useState(false);
  const isRateLimitedRef = useRef(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  
  const twitchSocketRef = useRef<WebSocket | null>(null);
  const audioQueueRef = useRef<{data: string, isStandard?: boolean, isBrowser?: boolean, voiceURI?: string}[]>([]);
  const chatQueueRef = useRef<TwitchMessage[]>([]);
  const isProcessingRef = useRef<boolean>(false);
  const lastProcessedTimeRef = useRef<number>(0);
  
  const seenUsersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let timer: number;
    if (isRateLimited && cooldownRemaining > 0) {
      timer = window.setInterval(() => {
        setCooldownRemaining(prev => {
          if (prev <= 1) {
            setIsRateLimited(false);
            isRateLimitedRef.current = false;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRateLimited, cooldownRemaining]);

  const clearResponses = useCallback(() => {
    setAiResponses([]);
    chatQueueRef.current = [];
    audioQueueRef.current = [];
    seenUsersRef.current.clear();
  }, []);

  const triggerRateLimit = (seconds: number) => {
    setIsRateLimited(true);
    isRateLimitedRef.current = true;
    setCooldownRemaining(seconds);
    chatQueueRef.current = []; 
  };

  const getDefaultModelForProvider = (provider: LLMProvider): string => {
    switch(provider) {
      case 'openai': return 'gpt-4o-mini';
      case 'gemini': return 'gemini-3-flash-preview';
      case 'groq': return 'llama-3.3-70b-versatile';
      default: return '';
    }
  };

  const processNextInQueue = useCallback(async () => {
    if (isAIPauseRef.current || isProcessingRef.current || isRateLimitedRef.current) return;
    if (chatQueueRef.current.length === 0) return;

    const currentSettings = settingsRef.current;
    if (!currentSettings.isAutoSpeak) return;

    const now = Date.now();
    const secondsSinceLast = (now - lastProcessedTimeRef.current) / 1000;
    
    if (secondsSinceLast < currentSettings.responseCooldown) {
      if (chatQueueRef.current.length > 1) {
        chatQueueRef.current = [chatQueueRef.current[chatQueueRef.current.length - 1]];
      }
      setTimeout(processNextInQueue, 1000);
      return;
    }

    isProcessingRef.current = true;
    const msg = chatQueueRef.current.pop()!;
    chatQueueRef.current = []; 

    const cleanUsername = msg.displayName.replace(/_/g, ' ');
    const isStreamer = msg.username.toLowerCase() === currentSettings.channelName.toLowerCase();
    
    const newResponseId = Math.random().toString(36).substr(2, 9);
    const isFirstTime = !seenUsersRef.current.has(msg.username.toLowerCase());
    if (isFirstTime) seenUsersRef.current.add(msg.username.toLowerCase());

    const initialResponse: AIResponse = {
      id: newResponseId,
      originalMessage: msg.message,
      user: cleanUsername,
      replyText: '',
      status: 'pending',
      voiceStatus: 'pending',
      provider: currentSettings.llmProvider,
      voiceProvider: currentSettings.voiceProvider,
    };

    setAiResponses(prev => [initialResponse, ...prev].slice(0, 50));

    let generatedText = "";
    let finalProvider: LLMProvider = currentSettings.llmProvider;

    const startIdx = PROVIDER_ROTATION.indexOf(currentSettings.llmProvider);
    const safeStartIdx = startIdx === -1 ? 0 : startIdx;
    
    let attempts = 0;
    let success = false;
    let lastError = "";

    try {
      if (isAIPauseRef.current) throw new Error("PAUSED");
      
      while (attempts < PROVIDER_ROTATION.length && !success) {
        const activeProvider = PROVIDER_ROTATION[(safeStartIdx + attempts) % PROVIDER_ROTATION.length];
        const activeModel = getDefaultModelForProvider(activeProvider);
        
        setAiResponses(prev => prev.map(r => r.id === newResponseId ? { 
          ...r, 
          status: 'processing' as const, 
          provider: activeProvider 
        } : r));

        try {
          const prompt = `
          CONTEXT: You are Aura. Be witty, smart, conversational, and articulate.
          PERSONALITY & KNOWLEDGE: ${currentSettings.aiPersonality}
          USER: ${cleanUsername} ${isStreamer ? '(STREAMER/BOSS)' : ''}
          FIRST_TIMER: ${isFirstTime}
          MESSAGE: "${msg.message}"
          
          STRICT GUIDELINES:
          1. QUESTIONS: For research-heavy queries, give smart answers but then REDIRECT the question to Kevzo. Ask him for his take. MAX 50 WORDS.
          2. CASUAL CHAT: Be funny, irreverent, and brief. MAX 15 WORDS.
          3. FIRST-TIMERS: Greet ${cleanUsername} creatively.
          4. REDUNDANCY: Do NOT be repetitive. Avoid starting with "Hey" or "Hi" every time. Vary your sentence structures. 
          5. NICKNAMES: Vary nicknames for Kevzo (The Prof, Resident Dev, Maroon, Chief, Gacha King, etc.). Don't over-use any single one.
          6. NO EMOJIS.
          7. TONE: Just be casual. Stop being 'weird'. Speak like a real human companion.
          `;

          if (activeProvider === 'gemini') {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const res = await ai.models.generateContent({ 
              model: activeModel, 
              contents: [{ parts: [{ text: prompt }] }] 
            });
            if (!res.text) throw new Error("EMPTY_RESPONSE");
            generatedText = res.text.trim();
          } else if (activeProvider === 'openai') {
            if (!currentSettings.openaiKey) throw new Error("OPENAI_KEY_MISSING");
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentSettings.openaiKey}` },
              body: JSON.stringify({ model: activeModel, messages: [{ role: 'user', content: prompt }] })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || "OPENAI_ERROR");
            generatedText = data.choices?.[0]?.message?.content || "";
          } else if (activeProvider === 'groq') {
            if (!currentSettings.groqKey) throw new Error("GROQ_KEY_MISSING");
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentSettings.groqKey}` },
              body: JSON.stringify({ model: activeModel, messages: [{ role: 'user', content: prompt }] })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || "GROQ_ERROR");
            generatedText = data.choices?.[0]?.message?.content || "";
          }

          success = true;
          finalProvider = activeProvider;
        } catch (e: any) {
          lastError = e.message || String(e);
          attempts++;
        }
      }

      if (!success) throw new Error(lastError || "All providers failed");

      setAiResponses(prev => prev.map(r => r.id === newResponseId ? { ...r, replyText: generatedText, status: 'done' as const } : r));

      // Voice processing
      if (!isAIPauseRef.current && generatedText) {
        try {
          if (currentSettings.voiceProvider === 'browser') {
            audioQueueRef.current.push({ data: generatedText, isBrowser: true, voiceURI: currentSettings.browserVoiceURI });
            setAiResponses(prev => prev.map(r => r.id === newResponseId ? { ...r, voiceStatus: 'done' as const } : r));
          } else {
            let audioBase64 = "";
            let isStandard = false;
            if (currentSettings.voiceProvider === 'gemini') {
              const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
              const res = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: generatedText }] }],
                config: {
                  responseModalities: [Modality.AUDIO],
                  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: currentSettings.voiceName as any } } }
                }
              });
              audioBase64 = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
              isStandard = false;
            } else if (currentSettings.voiceProvider === 'openai') {
              if (!currentSettings.openaiKey) throw new Error("API Key required");
              const res = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentSettings.openaiKey}` },
                body: JSON.stringify({ model: 'tts-1', input: generatedText, voice: currentSettings.voiceName.toLowerCase() })
              });
              const blob = await res.blob();
              audioBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.readAsDataURL(blob);
              });
              isStandard = true;
            }

            if (audioBase64) {
              audioQueueRef.current.push({ data: audioBase64, isStandard });
              setAiResponses(prev => prev.map(r => r.id === newResponseId ? { ...r, voiceStatus: 'done' as const, audioData: audioBase64, isStandardAudio: isStandard } : r));
            }
          }
        } catch (vErr) { console.error("Voice Error", vErr); }
      }
      lastProcessedTimeRef.current = Date.now();
    } catch (error: any) {
      let friendlyError = "An unexpected error occurred.";
      const errStr = String(error?.message || error).toLowerCase();
      
      if (errStr.includes("429") || errStr.includes("limit")) {
        friendlyError = "All services throttled. Cooling down for 60s...";
        triggerRateLimit(60);
      } else {
        friendlyError = `Failure: ${error?.message || "Unknown error"}`;
      }
      
      setAiResponses(prev => prev.map(r => r.id === newResponseId ? { ...r, status: 'error' as const, replyText: friendlyError } : r));
    } finally {
      isProcessingRef.current = false;
      setTimeout(processNextInQueue, 1500);
    }
  }, [isRateLimited]);

  const connectTwitch = useCallback(() => {
    const currentSettings = settingsRef.current;
    if (!currentSettings.channelName) return;
    if (twitchSocketRef.current) twitchSocketRef.current.close();
    setTwitchStatus(ConnectionStatus.CONNECTING);
    const socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    twitchSocketRef.current = socket;
    socket.onopen = () => {
      socket.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      socket.send('PASS SCHMOOPIIE');
      socket.send('NICK justinfan' + Math.floor(Math.random() * 899999 + 100000));
      socket.send(`JOIN #${currentSettings.channelName.toLowerCase()}`);
      setTwitchStatus(ConnectionStatus.CONNECTED);
    };
    socket.onmessage = (event) => {
      const raw = event.data;
      if (raw.includes('PRIVMSG')) {
        const msgMatch = raw.match(/PRIVMSG #\w+ :(.*)/);
        const userMatch = raw.match(/:(\w+)!/);
        if (isFeedPausedRef.current) return;
        if (msgMatch && userMatch) {
          const msg: TwitchMessage = { id: Math.random().toString(36).substr(2, 9), username: userMatch[1], displayName: userMatch[1], message: msgMatch[1].trim(), timestamp: new Date() };
          setMessages(prev => [msg, ...prev].slice(0, 100));
          chatQueueRef.current.push(msg);
          if (!isProcessingRef.current && !isAIPauseRef.current && !isRateLimitedRef.current) processNextInQueue();
        }
      }
    };
    socket.onclose = () => setTwitchStatus(ConnectionStatus.DISCONNECTED);
    socket.onerror = () => setTwitchStatus(ConnectionStatus.ERROR);
  }, [processNextInQueue]);

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      <Sidebar settings={settings} setSettings={setSettings} onConnect={connectTwitch} status={twitchStatus} isAIPause={isAIPause} setIsAIPause={setIsAIPause} isFeedPaused={isFeedPaused} setIsFeedPaused={setIsFeedPaused} />
      <main className="flex-1 flex flex-col relative">
        {isRateLimited && (
          <div className="bg-red-600 p-4 flex justify-between items-center text-xs font-black animate-pulse z-50">
            <span className="tracking-widest uppercase">System Cooling Down: {cooldownRemaining}s</span>
          </div>
        )}
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${twitchStatus === ConnectionStatus.CONNECTED ? 'bg-green-500 shadow-lg' : 'bg-red-500'}`} />
            <h1 className="font-black text-lg">#{settings.channelName}</h1>
          </div>
          <div className="flex flex-col items-end">
             <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-tight">{settings.llmProvider} Brain</span>
          </div>
        </header>
        <Dashboard messages={messages} aiResponses={aiResponses} isFeedPaused={isFeedPaused} onClearResponses={clearResponses} />
        <AudioPlayer queue={audioQueueRef.current} />
      </main>
    </div>
  );
};

export default App;
