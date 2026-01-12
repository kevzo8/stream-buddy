
import React, { useEffect, useRef, useState } from 'react';

interface AudioPlayerProps {
  queue: string[];
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ queue }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const currentAudioIndex = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  // Audio utility functions
  const decodeBase64 = (base64: string) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodeAudioData = async (
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
  ): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const playNext = async () => {
    if (currentAudioIndex.current >= queue.length) {
      setIsPlaying(false);
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }

    setIsPlaying(true);
    const base64 = queue[currentAudioIndex.current];
    const bytes = decodeBase64(base64);
    
    try {
      const audioBuffer = await decodeAudioData(bytes, audioContextRef.current, 24000, 1);
      const source = audioContextRef.current.createBufferSource();
      const gainNode = audioContextRef.current.createGain();
      
      source.buffer = audioBuffer;
      source.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);

      const startTime = Math.max(nextStartTimeRef.current, audioContextRef.current.currentTime);
      source.start(startTime);
      
      nextStartTimeRef.current = startTime + audioBuffer.duration;
      
      source.onended = () => {
        currentAudioIndex.current++;
        playNext();
      };
    } catch (e) {
      console.error("Audio Playback Error:", e);
      currentAudioIndex.current++;
      playNext();
    }
  };

  useEffect(() => {
    if (!isPlaying && queue.length > currentAudioIndex.current) {
      playNext();
    }
  }, [queue.length, isPlaying]);

  return (
    <div className={`fixed bottom-6 right-6 p-4 rounded-2xl bg-zinc-900/90 backdrop-blur-xl border border-zinc-700 shadow-2xl transition-all duration-500 transform ${isPlaying ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
       <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full gemini-gradient flex items-center justify-center animate-spin-slow">
            <i className="fa-solid fa-waveform text-white"></i>
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Aura Speaking</p>
            <div className="flex gap-1 mt-1">
               {[1,2,3,4,5].map(i => (
                 <div key={i} className="w-1 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
               ))}
            </div>
          </div>
       </div>
    </div>
  );
};

export default AudioPlayer;
