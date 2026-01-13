
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TwitchMessage, AIResponse, AppSettings } from '../types';
import { GoogleGenAI } from "@google/genai";

const Overlay: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(() => {
    const saved = localStorage.getItem('aura_settings');
    return saved ? JSON.parse(saved) : null;
  });

  const [currentResponse, setCurrentResponse] = useState<AIResponse | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const isProcessingRef = useRef(false);
  const lastProcessedTimeRef = useRef(0);
  const hideTimeoutRef = useRef<number | null>(null);
  const seenUsersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const checkSettings = () => {
      const saved = localStorage.getItem('aura_settings');
      if (saved) setSettings(JSON.parse(saved));
    };
    const interval = setInterval(checkSettings, 2000);
    return () => clearInterval(interval);
  }, []);

  const processAI = useCallback(async (msg: TwitchMessage) => {
    if (!settings || isProcessingRef.current) return;
    
    const now = Date.now();
    if ((now - lastProcessedTimeRef.current) / 1000 < settings.responseCooldown) return;

    isProcessingRef.current = true;
    const cleanUsername = msg.displayName.replace(/_/g, ' ');
    const isStreamer = msg.username.toLowerCase() === settings.channelName.toLowerCase();
    const isFirstTime = !seenUsersRef.current.has(msg.username.toLowerCase());
    if (isFirstTime) seenUsersRef.current.add(msg.username.toLowerCase());

    setCurrentResponse({
      id: Math.random().toString(36).substr(2, 9),
      originalMessage: msg.message,
      user: cleanUsername,
      replyText: '',
      status: 'processing',
    });
    setIsVisible(true);

    if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);

    try {
      const prompt = `
        CONTEXT: You are Aura, Kevzo's witty and brilliant cyber-companion.
        PERSONALITY & BIO: ${settings.aiPersonality}
        USER: ${cleanUsername} ${isStreamer ? '(BOSS)' : ''}
        FIRST_TIMER: ${isFirstTime}
        MESSAGE: "${msg.message}"
        
        STRICT RULES:
        1. RESEARCH: Smart research for complex questions (max 50 words) then redirect to Kevzo.
        2. CASUAL: Witty, irreverent, and brief (max 15 words) for general chat.
        3. NO EMOJIS.
        4. TONE: Sharp, casual, conversational. Stop being weird.
        5. GREETING: If first timer, greet creatively. Do not repeat greetings.
      `;

      let text = "";
      if (settings.llmProvider === 'openai' && settings.openaiKey) {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.openaiKey}` },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }] })
        });
        const data = await res.json();
        text = data.choices?.[0]?.message?.content || "";
      } else {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const res = await ai.models.generateContent({ 
          model: 'gemini-3-flash-preview', 
          contents: [{ parts: [{ text: prompt }] }] 
        });
        text = res.text || "";
      }

      setCurrentResponse(prev => prev ? { ...prev, replyText: text, status: 'done' } : null);
      lastProcessedTimeRef.current = Date.now();
      hideTimeoutRef.current = window.setTimeout(() => setIsVisible(false), 12000);
    } catch (e) {
      console.error(e);
      setIsVisible(false);
    } finally {
      isProcessingRef.current = false;
    }
  }, [settings]);

  useEffect(() => {
    if (!settings?.channelName) return;
    const socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    socket.onopen = () => {
      socket.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      socket.send('PASS SCHMOOPIIE');
      socket.send('NICK justinfan' + Math.floor(Math.random() * 899999 + 100000));
      socket.send(`JOIN #${settings.channelName.toLowerCase()}`);
    };
    socket.onmessage = (event) => {
      const raw = event.data;
      if (raw.includes('PRIVMSG')) {
        const msgMatch = raw.match(/PRIVMSG #\w+ :(.*)/);
        const userMatch = raw.match(/:(\w+)!/);
        if (msgMatch && userMatch) {
          processAI({ id: Date.now().toString(), username: userMatch[1], displayName: userMatch[1], message: msgMatch[1].trim(), timestamp: new Date() });
        }
      }
    };
    return () => socket.close();
  }, [settings, processAI]);

  if (!settings) return null;

  return (
    <div className="h-screen w-screen bg-transparent flex items-end justify-start p-10 overflow-hidden font-sans select-none pointer-events-none">
      <div className={`flex items-start gap-4 transition-all duration-700 ease-out transform ${isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 opacity-0 scale-95'}`}>
        <div className="relative flex-shrink-0">
          <div className="w-16 h-16 rounded-2xl gemini-gradient p-1 shadow-2xl animate-spin-slow">
            <div className="w-full h-full bg-zinc-900 rounded-xl flex items-center justify-center">
              <i className="fa-solid fa-sparkles text-2xl text-white"></i>
            </div>
          </div>
          {currentResponse?.status === 'processing' && (
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center border-4 border-black animate-pulse">
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 max-w-md">
          <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] ml-2">Aura // RE: {currentResponse?.user}</span>
          <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full gemini-gradient opacity-50" />
             {currentResponse?.status === 'processing' ? (
               <div className="flex gap-1.5 py-2">
                 <div className="w-2 h-2 bg-white/20 rounded-full animate-bounce" style={{animationDelay: '0s'}} />
                 <div className="w-2 h-2 bg-white/20 rounded-full animate-bounce" style={{animationDelay: '0.2s'}} />
                 <div className="w-2 h-2 bg-white/20 rounded-full animate-bounce" style={{animationDelay: '0.4s'}} />
               </div>
             ) : (
               <p className="text-white text-lg font-bold leading-tight tracking-tight drop-shadow-sm">{currentResponse?.replyText}</p>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overlay;
