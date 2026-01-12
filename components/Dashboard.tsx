
import React from 'react';
import { TwitchMessage, AIResponse } from '../types';

interface DashboardProps {
  messages: TwitchMessage[];
  aiResponses: AIResponse[];
}

const Dashboard: React.FC<DashboardProps> = ({ messages, aiResponses }) => {
  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden">
      {/* Live Chat Column */}
      <div className="flex flex-col border-r border-zinc-800">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/20">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Twitch Live Feed</span>
          <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-400 font-bold border border-purple-500/20">Realtime</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center px-10">
              <i className="fa-regular fa-comments text-4xl mb-4"></i>
              <p className="text-sm">Connect to a channel to see chat messages here.</p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="group animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="flex items-baseline gap-2">
                  <span 
                    className="font-bold text-sm" 
                    style={{ color: m.color || '#9146FF' }}
                  >
                    {m.displayName}:
                  </span>
                  <span className="text-sm text-zinc-300 leading-relaxed">{m.message}</span>
                </div>
                <div className="text-[10px] text-zinc-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {m.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* AI Activity Column */}
      <div className="flex flex-col bg-zinc-950/20">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/20">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Aura AI Reactions</span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
             <span className="text-[10px] text-blue-400 font-bold">LISTENING</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {aiResponses.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center px-10">
              <i className="fa-solid fa-robot text-4xl mb-4"></i>
              <p className="text-sm italic">"I'm waiting for someone to say something interesting..."</p>
            </div>
          ) : (
            aiResponses.map((r) => (
              <div key={r.id} className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full gemini-gradient flex items-center justify-center">
                      <i className="fa-solid fa-star text-[10px] text-white"></i>
                    </div>
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-tighter">Replied to {r.user}</span>
                  </div>
                  {r.status === 'processing' && (
                    <span className="text-[10px] text-yellow-500 animate-pulse">GENERATING...</span>
                  )}
                  {r.status === 'done' && (
                    <i className="fa-solid fa-check text-[10px] text-green-500"></i>
                  )}
                </div>
                <p className="text-xs text-zinc-500 italic mb-2 px-2 border-l-2 border-zinc-800">"{r.originalMessage}"</p>
                <div className="bg-zinc-800/50 rounded-lg p-3 text-sm text-zinc-100 border border-zinc-700/50 shadow-inner">
                  {r.replyText || "..."}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
