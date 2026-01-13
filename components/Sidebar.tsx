
import React, { useState, useEffect } from 'react';
import { AppSettings, ConnectionStatus } from '../types';

interface SidebarProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onConnect: () => void;
  status: ConnectionStatus;
  isAIPause: boolean;
  setIsAIPause: (val: boolean) => void;
  isFeedPaused: boolean;
  setIsFeedPaused: (val: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  settings, 
  setSettings, 
  onConnect, 
  status, 
  isAIPause, 
  setIsAIPause,
  isFeedPaused,
  setIsFeedPaused
}) => {
  const [showKeys, setShowKeys] = useState(false);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [copied, setCopied] = useState(false);

  // Construct the OBS URL using the current window's location
  const getObsUrl = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', 'overlay');
      return url.toString();
    } catch (e) {
      return window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'mode=overlay';
    }
  };

  const obsUrl = getObsUrl();

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setBrowserVoices(voices);
        const currentVoice = voices.find(v => v.voiceURI === settings.browserVoiceURI);
        if (!currentVoice) {
           const ukFemale = voices.find(v => (v.name.includes('UK') || v.lang.includes('GB')) && v.name.includes('Female')) ||
                            voices.find(v => (v.name.includes('UK') || v.lang.includes('GB'))) ||
                            voices.find(v => v.lang.startsWith('en-GB'));
           if (ukFemale) {
             setSettings(s => ({ ...s, browserVoiceURI: ukFemale.voiceURI }));
           }
        }
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, [settings.browserVoiceURI, setSettings]);

  const handleVoiceProviderChange = (provider: 'gemini' | 'elevenlabs' | 'openai' | 'browser') => {
    let defaultVoice = settings.voiceName;
    if (provider === 'gemini') defaultVoice = 'Zephyr';
    if (provider === 'openai') defaultVoice = 'Nova';
    if (provider === 'browser') defaultVoice = 'System Default';
    
    setSettings(s => ({ 
      ...s, 
      voiceProvider: provider,
      voiceName: defaultVoice
    }));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(obsUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const testOverlay = () => {
    window.open(obsUrl, '_blank');
  };

  return (
    <div className="w-80 border-r border-zinc-800 flex flex-col bg-zinc-900/40">
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center gap-2 mb-1">
          <i className="fa-brands fa-twitch text-purple-500 text-xl"></i>
          <span className="font-bold text-xl tracking-tighter text-zinc-100 italic">AURA</span>
        </div>
        <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Stream Companion</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {/* Core Connection */}
        <section className="space-y-3">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Twitch Channel</label>
          <div className="flex gap-2">
            <input 
              type="text" placeholder="Username"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:ring-1 focus:ring-purple-500 outline-none"
              value={settings.channelName}
              onChange={(e) => setSettings(s => ({ ...s, channelName: e.target.value }))}
            />
            <button onClick={onConnect} className="bg-purple-600 hover:bg-purple-500 px-4 rounded-lg font-bold text-sm transition-colors shadow-lg shadow-purple-900/20">Go</button>
          </div>
        </section>

        {/* OBS Overlay Helper */}
        <section className="bg-zinc-800/40 border border-zinc-800 rounded-xl p-4 space-y-3">
          <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-2">
            <i className="fa-solid fa-layer-group"></i>
            OBS Stream Overlay
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input 
                readOnly
                type="text" 
                value={obsUrl}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-3 pr-10 py-2 text-[10px] text-zinc-400 font-mono outline-none"
              />
              <button 
                onClick={copyToClipboard}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
              >
                <i className={`fa-solid ${copied ? 'fa-check text-green-500' : 'fa-copy'}`}></i>
              </button>
            </div>
            <button 
              onClick={testOverlay}
              className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded-lg text-zinc-300 transition-colors"
              title="Test Overlay"
            >
              <i className="fa-solid fa-external-link text-xs"></i>
            </button>
          </div>
        </section>

        {/* AI Brain Selection */}
        <section className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest">AI Brain (LLM)</label>
            <select 
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none cursor-pointer hover:border-zinc-600"
              value={settings.llmProvider}
              onChange={(e) => {
                const provider = e.target.value as any;
                const model = provider === 'openai' ? 'gpt-4o-mini' : (provider === 'gemini' ? 'gemini-3-flash-preview' : '');
                setSettings(s => ({ ...s, llmProvider: provider, modelName: model }));
              }}
            >
              <option value="openai">OpenAI (Default / Smartest)</option>
              <option value="gemini">Gemini (Built-in Key)</option>
              <option value="groq">Groq (Requires Key)</option>
              <option value="anthropic">Anthropic (Requires Key)</option>
            </select>
          </div>

          {settings.llmProvider === 'openai' && (
            <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">OpenAI Model</label>
              <select 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 outline-none"
                value={settings.modelName}
                onChange={(e) => setSettings(s => ({ ...s, modelName: e.target.value }))}
              >
                <option value="gpt-4o-mini">GPT-4o Mini (Default - Fast/Cheap)</option>
                <option value="gpt-4o">GPT-4o (Premium Reasoning)</option>
              </select>
            </div>
          )}

          {settings.llmProvider === 'gemini' && (
            <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Gemini Model</label>
              <select 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 outline-none"
                value={settings.modelName}
                onChange={(e) => setSettings(s => ({ ...s, modelName: e.target.value }))}
              >
                <option value="gemini-3-flash-preview">Gemini 3 Flash (Fastest)</option>
                <option value="gemini-3-pro-preview">Gemini 3 Pro (Deep Thought)</option>
                <option value="gemini-flash-lite-latest">Gemini Flash Lite (Economy)</option>
              </select>
            </div>
          )}
        </section>

        {/* Voice Selection */}
        <section className="space-y-3">
          <label className="text-[10px] font-black text-green-500 uppercase tracking-widest">Voice Provider</label>
          <div className="space-y-2">
            <select 
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none cursor-pointer hover:border-zinc-600"
              value={settings.voiceProvider}
              onChange={(e) => handleVoiceProviderChange(e.target.value as any)}
            >
              <option value="browser">Browser (Default - UK Female / Free)</option>
              <option value="openai">OpenAI TTS (High Fidelity)</option>
              <option value="gemini">Gemini Aura Voices</option>
              <option value="elevenlabs">ElevenLabs (Pro Fidelity)</option>
            </select>

            {settings.voiceProvider === 'browser' && (
              <div className="space-y-2">
                <select 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none font-medium cursor-pointer"
                  value={settings.browserVoiceURI || ''}
                  onChange={(e) => setSettings(s => ({ ...s, browserVoiceURI: e.target.value }))}
                >
                  <option value="">System Default</option>
                  {browserVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
                <p className="text-[9px] text-zinc-600 px-1 italic">Note: Google UK English Female is selected by default if found.</p>
              </div>
            )}

            {settings.voiceProvider === 'openai' && (
              <select 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none font-medium cursor-pointer"
                value={settings.voiceName}
                onChange={(e) => setSettings(s => ({ ...s, voiceName: e.target.value as any }))}
              >
                <option value="Nova">Nova (Female/Energetic)</option>
                <option value="Shimmer">Shimmer (Female/Clear)</option>
                <option value="Alloy">Alloy (Neutral/Balanced)</option>
                <option value="Echo">Echo (Male/Authoritative)</option>
                <option value="Fable">Fable (British/Storyteller)</option>
                <option value="Onyx">Onyx (Male/Deep)</option>
              </select>
            )}

            {settings.voiceProvider === 'gemini' && (
              <select 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none font-medium cursor-pointer"
                value={settings.voiceName}
                onChange={(e) => setSettings(s => ({ ...s, voiceName: e.target.value as any }))}
              >
                <option value="Zephyr">Zephyr (Female - Soft/Calm)</option>
                <option value="Kore">Kore (Female - Professional)</option>
                <option value="Puck">Puck (Male - High Energy)</option>
                <option value="Charon">Charon (Male - Deep/Mature)</option>
                <option value="Fenrir">Fenrir (Male - Powerful)</option>
              </select>
            )}

            {settings.voiceProvider === 'elevenlabs' && (
              <div className="pt-1">
                <a 
                  href="https://elevenlabs.io/app/voice-lab" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[9px] text-zinc-500 hover:text-purple-400 flex items-center gap-1 transition-colors"
                >
                  <i className="fa-solid fa-external-link text-[8px]"></i>
                  Open Voice Lab to find Voice IDs
                </a>
              </div>
            )}
          </div>
        </section>

        {/* Provider API Keys */}
        <section className="pt-4 border-t border-zinc-800">
          <button 
            onClick={() => setShowKeys(!showKeys)}
            className="flex items-center justify-between w-full text-[10px] font-black text-zinc-500 uppercase hover:text-zinc-300 transition-colors"
          >
            <span>External API Keys</span>
            <i className={`fa-solid fa-chevron-${showKeys ? 'up' : 'down'}`}></i>
          </button>
          
          {showKeys && (
            <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <input 
                type="password" placeholder="OpenAI API Key"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:border-zinc-600 outline-none"
                value={settings.openaiKey || ''}
                onChange={(e) => setSettings(s => ({ ...s, openaiKey: e.target.value }))}
              />
              <input 
                type="password" placeholder="Groq API Key"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:border-zinc-600 outline-none"
                value={settings.groqKey || ''}
                onChange={(e) => setSettings(s => ({ ...s, groqKey: e.target.value }))}
              />
              <input 
                type="password" placeholder="Anthropic API Key"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:border-zinc-600 outline-none"
                value={settings.anthropicKey || ''}
                onChange={(e) => setSettings(s => ({ ...s, anthropicKey: e.target.value }))}
              />
              <div className="pt-2 border-t border-zinc-900 space-y-2">
                <input 
                  type="password" placeholder="ElevenLabs API Key"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:border-zinc-600 outline-none"
                  value={settings.elevenlabsKey || ''}
                  onChange={(e) => setSettings(s => ({ ...s, elevenlabsKey: e.target.value }))}
                />
                <input 
                  type="text" placeholder="Voice ID (e.g. pNInz6obpg8n9YZpYFsN)"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:border-zinc-600 outline-none"
                  value={settings.elevenlabsVoiceId || ''}
                  onChange={(e) => setSettings(s => ({ ...s, elevenlabsVoiceId: e.target.value }))}
                />
              </div>
            </div>
          )}
        </section>

        {/* Behavior & Personality */}
        <section className="space-y-4 pt-4 border-t border-zinc-800">
           <div className="flex justify-between items-center">
             <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Cooldown: {settings.responseCooldown}s</label>
           </div>
           <input 
             type="range" min="5" max="120" 
             className="w-full accent-purple-500 cursor-pointer"
             value={settings.responseCooldown}
             onChange={(e) => setSettings(s => ({ ...s, responseCooldown: parseInt(e.target.value) }))}
           />
           <div className="space-y-2">
             <label className="text-[10px] font-black text-orange-500 uppercase tracking-widest">AI Personality</label>
             <textarea 
               className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-purple-500 resize-none"
               rows={4}
               value={settings.aiPersonality}
               onChange={(e) => setSettings(s => ({ ...s, aiPersonality: e.target.value }))}
               placeholder="How should the AI behave?"
             />
           </div>
        </section>
      </div>

      <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">System {status}</span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsFeedPaused(!isFeedPaused)} 
            className={`p-2 rounded-lg text-xs transition-all border ${isFeedPaused ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-transparent'}`}
            title={isFeedPaused ? "Resume Chat Feed" : "Pause Chat Feed"}
          >
            <i className={`fa-solid ${isFeedPaused ? 'fa-play' : 'fa-pause'}`}></i>
          </button>
          <button 
            onClick={() => setIsAIPause(!isAIPause)} 
            className={`p-2 rounded-lg text-xs transition-all border ${isAIPause ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-transparent'}`}
            title={isAIPause ? "Resume AI" : "Pause AI"}
          >
            <i className={`fa-solid ${isAIPause ? 'fa-play' : 'fa-robot'}`}></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
