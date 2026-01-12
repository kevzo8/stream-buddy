
import React from 'react';
import { AppSettings, ConnectionStatus } from '../types';

interface SidebarProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onConnect: () => void;
  status: ConnectionStatus;
  isAIPause: boolean;
  setIsAIPause: (val: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ settings, setSettings, onConnect, status, isAIPause, setIsAIPause }) => {
  return (
    <div className="w-80 border-r border-zinc-800 flex flex-col bg-zinc-900/40">
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center gap-2 mb-2">
          <i className="fa-brands fa-twitch text-purple-500 text-xl"></i>
          <span className="font-bold text-xl">Twitch Aura</span>
        </div>
        <p className="text-xs text-zinc-500">Your AI-powered chat presence</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Channel Name</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Twitch Username"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              value={settings.channelName}
              onChange={(e) => setSettings(s => ({ ...s, channelName: e.target.value }))}
            />
            <button 
              onClick={onConnect}
              disabled={status === ConnectionStatus.CONNECTING}
              className={`px-3 py-2 rounded-lg font-bold text-sm transition-all ${status === ConnectionStatus.CONNECTED ? 'bg-zinc-800 text-zinc-400' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20'}`}
            >
              {status === ConnectionStatus.CONNECTED ? 'Ref' : 'Go'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Voice Tone</label>
          <select 
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            value={settings.voiceName}
            onChange={(e) => setSettings(s => ({ ...s, voiceName: e.target.value as any }))}
          >
            <option value="Puck">Puck (Youthful & Cheerful)</option>
            <option value="Zephyr">Zephyr (Light & Soft)</option>
            <option value="Kore">Kore (Balanced)</option>
            <option value="Charon">Charon (Deep & Mature)</option>
            <option value="Fenrir">Fenrir (Powerful)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">AI Personality</label>
          <textarea 
            rows={4}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            value={settings.aiPersonality}
            onChange={(e) => setSettings(s => ({ ...s, aiPersonality: e.target.value }))}
            placeholder="How should Aura behave?"
          />
        </div>

        <div className="space-y-3 pt-4 border-t border-zinc-800">
           <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Automatic Replies</span>
              <button 
                onClick={() => setSettings(s => ({...s, isAutoSpeak: !s.isAutoSpeak}))}
                className={`w-10 h-5 rounded-full transition-colors relative ${settings.isAutoSpeak ? 'bg-purple-600' : 'bg-zinc-700'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.isAutoSpeak ? 'left-6' : 'left-1'}`} />
              </button>
           </div>
           <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Pause AI Activity</span>
              <button 
                onClick={() => setIsAIPause(!isAIPause)}
                className={`w-10 h-5 rounded-full transition-colors relative ${isAIPause ? 'bg-red-600' : 'bg-zinc-700'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isAIPause ? 'left-6' : 'left-1'}`} />
              </button>
           </div>
        </div>
      </div>

      <div className="p-6 border-t border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center gap-3 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer">
          <img src="https://picsum.photos/40/40" className="w-8 h-8 rounded-full border border-zinc-700" alt="Avatar" />
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-bold truncate">Project Aura v1.1</p>
            <p className="text-[10px] text-zinc-500 truncate">Youthful AI Profile Active</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
