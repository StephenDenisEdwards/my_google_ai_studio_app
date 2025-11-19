import React, { useEffect, useRef } from 'react';

interface TranscriptLogProps {
  history: string[];
  current: string;
}

export const TranscriptLog: React.FC<TranscriptLogProps> = ({ history, current }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, current]);

  return (
    <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
      <div className="bg-zinc-800/50 px-6 py-3 border-b border-zinc-700 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Live Transcript</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-sm">
        {history.length === 0 && !current && (
          <div className="text-zinc-600 italic text-center mt-10">
            Waiting for speech...
          </div>
        )}
        
        {history.map((segment, idx) => (
          <div key={idx} className="text-zinc-400 opacity-70">
            <span className="text-zinc-600 select-none mr-2">{`>`}</span>
            {segment}
          </div>
        ))}

        {current && (
          <div className="text-white animate-pulse">
            <span className="text-cyan-500 select-none mr-2">{`>`}</span>
            {current}
            <span className="inline-block w-2 h-4 ml-1 bg-cyan-500 align-middle animate-blink"></span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};