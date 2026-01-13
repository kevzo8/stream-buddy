
import React, { useEffect, useRef, useState } from 'react';

interface AudioPlayerProps {
  queue: {data: string, isStandard?: boolean, isBrowser?: boolean, voiceURI?: string}[];
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ queue }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const currentAudioIndex = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const standardAudioRef = useRef<HTMLAudioElement | null>(null);

  const decodeBase64 = (base64: string) => {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodePCM = async (data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  };

  const playNext = async () => {
    if (currentAudioIndex.current >= queue.length) {
      setIsPlaying(false);
      return;
    }

    const item = queue[currentAudioIndex.current];
    setIsPlaying(true);

    if (item.isBrowser) {
      // Handle Browser Native Speech
      const utterance = new SpeechSynthesisUtterance(item.data);
      if (item.voiceURI) {
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.voiceURI === item.voiceURI);
        if (selectedVoice) utterance.voice = selectedVoice;
      }
      utterance.onend = () => {
        currentAudioIndex.current++;
        playNext();
      };
      utterance.onerror = () => {
        currentAudioIndex.current++;
        playNext();
      };
      window.speechSynthesis.speak(utterance);
    } else if (item.isStandard) {
      // Handle Standard Audio (ElevenLabs/OpenAI MP3)
      if (!standardAudioRef.current) standardAudioRef.current = new Audio();
      const bytes = decodeBase64(item.data);
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      standardAudioRef.current.src = url;
      standardAudioRef.current.onended = () => {
        URL.revokeObjectURL(url);
        currentAudioIndex.current++;
        playNext();
      };
      standardAudioRef.current.play().catch(() => {
        currentAudioIndex.current++;
        playNext();
      });
    } else {
      // Handle Raw PCM (Gemini)
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const bytes = decodeBase64(item.data);
      try {
        const audioBuffer = await decodePCM(bytes, audioContextRef.current);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        const startTime = Math.max(nextStartTimeRef.current, audioContextRef.current.currentTime);
        source.start(startTime);
        nextStartTimeRef.current = startTime + audioBuffer.duration;
        source.onended = () => {
          currentAudioIndex.current++;
          playNext();
        };
      } catch (e) {
        console.error(e);
        currentAudioIndex.current++;
        playNext();
      }
    }
  };

  useEffect(() => {
    if (!isPlaying && queue.length > currentAudioIndex.current) {
      playNext();
    }
  }, [queue.length, isPlaying]);

  return (
    <div className={`fixed bottom-6 right-6 p-4 rounded-2xl bg-zinc-900/90 backdrop-blur-xl border border-zinc-700 shadow-2xl transition-all ${isPlaying ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
       <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full gemini-gradient flex items-center justify-center animate-spin-slow">
            <i className="fa-solid fa-waveform text-white"></i>
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Speaking</p>
            <div className="flex gap-1 mt-1">
               {[1,2,3].map(i => <div key={i} className="w-1 h-3 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: `${i*0.1}s`}} />)}
            </div>
          </div>
       </div>
    </div>
  );
};

export default AudioPlayer;
