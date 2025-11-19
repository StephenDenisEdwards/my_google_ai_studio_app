import React, { useEffect, useRef } from 'react';
import { DetectedIntent, IntentType } from '../types';

interface IntentPanelProps {
  intents: DetectedIntent[];
}

export const IntentPanel: React.FC<IntentPanelProps> = ({ intents }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [intents]);

  return (
    <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg relative">
      {/* Abstract Background Decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -z-0 pointer-events-none"></div>

      <div className="bg-zinc-800/50 px-6 py-3 border-b border-zinc-700 flex items-center justify-between z-10">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Detected Intents</h2>
        <span className="text-xs bg-zinc-700 text-zinc-400 px-2 py-1 rounded-full">{intents.length} detected</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 z-10">
        {intents.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-2">
            <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-sm italic">Listening for questions & commands...</p>
          </div>
        )}

        {intents.map((intent) => (
          <div 
            key={intent.id} 
            className={`p-4 rounded-xl border shadow-sm transition-all duration-500 animate-in slide-in-from-bottom-2 fade-in 
              ${intent.type === IntentType.QUESTION 
                ? 'bg-blue-950/30 border-blue-900/50 hover:border-blue-500/50' 
                : 'bg-amber-950/30 border-amber-900/50 hover:border-amber-500/50'
              }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg shrink-0 ${
                intent.type === IntentType.QUESTION ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {intent.type === IntentType.QUESTION ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    intent.type === IntentType.QUESTION ? 'text-blue-400' : 'text-amber-400'
                  }`}>
                    {intent.type}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {new Date(intent.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                  </span>
                </div>
                <p className="text-zinc-200 font-medium leading-snug">"{intent.text}"</p>
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};