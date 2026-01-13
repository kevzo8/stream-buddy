
import React from 'react';
import { TwitchMessage, AIResponse } from '../types';

interface DashboardProps {
  messages: TwitchMessage[];
  aiResponses: AIResponse[];
  isFeedPaused: boolean;
  onClearResponses?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ messages, aiResponses, isFeedPaused, onClearResponses }) => {
  const isErrorJson = (text: string) => {
    return text.includes('"error"') && text.includes('"code"');
  };

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden">
      {/* Live Chat Column */}
      <div className="flex flex-col border-r border-zinc-800">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/20">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Twitch Feed</span>
          <span className={`px-2 py-0.5 rounded text-[8px] font-black border transition-all ${isFeedPaused ? 'bg-orange-500 text-white border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.4)]' : 'bg-purple-500 text-white border-purple-500 shadow-[0_0_10px_rgba(145,70,255,0.4)] pulse-animation'}`}>
            {isFeedPaused ? 'PAUSED' : 'LIVE'}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-10 text-center px-10">
              <i className="fa-solid fa-tower-broadcast text-6xl mb-4"></i>
              <p className="text-sm font-bold uppercase tracking-widest">Awaiting Chat Data</p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="group animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="flex items-baseline gap-2">
                  <span className="font-black text-sm" style={{ color: m.color || '#9146FF' }}>{m.displayName}</span>
                  <span className="text-sm text-zinc-300 font-medium">{m.message}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* AI Activity Column */}
      <div className="flex flex-col bg-zinc-950/20">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/20">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Aura AI Timeline</span>
          <div className="flex items-center gap-3">
             {aiResponses.length > 0 && (
               <button 
                 onClick={onClearResponses}
                 className="text-[10px] font-black text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors uppercase tracking-widest border border-zinc-800 px-2 py-1 rounded hover:bg-zinc-800"
               >
                 <i className="fa-solid fa-trash-can text-[9px]"></i>
                 Clear
               </button>
             )}
             <span className="text-[10px] text-blue-400 font-black animate-pulse uppercase tracking-widest">Listening...</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {aiResponses.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-10 text-center px-10">
              <i className="fa-solid fa-sparkles text-6xl mb-4"></i>
              <p className="text-sm font-bold uppercase tracking-widest">No Responses Yet</p>
            </div>
          ) : (
            aiResponses.map((r) => {
              const hasErrorJson = isErrorJson(r.replyText);
              const displayReply = hasErrorJson ? "Service Rate Limit Reached." : (r.replyText || (r.status === 'processing' ? "Processing thought..." : "Awaiting input..."));

              return (
                <div key={r.id} className={`bg-zinc-900/60 border ${r.status === 'error' || hasErrorJson ? 'border-red-900/50' : 'border-zinc-800'} rounded-2xl p-4 transition-all hover:bg-zinc-900/80 group animate-in fade-in slide-in-from-right-2 duration-300`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1">
                        <div className={`w-6 h-6 rounded-lg ${r.status === 'error' || hasErrorJson ? 'bg-red-600' : 'bg-blue-600'} flex items-center justify-center border-2 border-zinc-900 shadow-lg`}>
                          <i className={`fa-solid ${r.status === 'error' || hasErrorJson ? 'fa-triangle-exclamation' : 'fa-brain'} text-[10px] text-white`}></i>
                        </div>
                        <div className={`w-6 h-6 rounded-lg ${r.voiceStatus === 'error' ? 'bg-red-600' : (r.voiceStatus === 'done' ? 'bg-green-600' : 'bg-zinc-700')} flex items-center justify-center border-2 border-zinc-900 shadow-lg`}>
                          <i className={`fa-solid ${r.voiceStatus === 'error' ? 'fa-microphone-slash' : 'fa-microphone-lines'} text-[10px] text-white`}></i>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-tighter">Reply to {r.user}</span>
                    </div>
                    {r.status === 'processing' && <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-ping" />}
                  </div>
                  
                  <p className="text-[10px] text-zinc-600 italic mb-2 px-3 border-l-2 border-zinc-800 line-clamp-1">{r.originalMessage}</p>
                  
                  <div className={`rounded-xl p-3 text-sm font-medium border shadow-inner ${r.status === 'error' || hasErrorJson ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-zinc-950/50 text-zinc-100 border-zinc-800/50'}`}>
                    {displayReply}
                    {r.voiceStatus === 'error' && (
                      <div className="mt-2 p-2 bg-red-900/20 rounded border border-red-500/20 text-[9px] text-red-400 font-bold uppercase tracking-widest">
                        Voice Error
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
