import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LiveManager } from './services/liveManager';
import { DetectedIntent, IntentType } from './types';
import { TranscriptLog } from './components/TranscriptLog';
import { IntentPanel } from './components/IntentPanel';
import { Visualizer } from './components/Visualizer';

const App: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [volume, setVolume] = useState(0);
  const [transcriptHistory, setTranscriptHistory] = useState<string[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [intents, setIntents] = useState<DetectedIntent[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Use a ref to persist the manager instance without re-rendering
  const managerRef = useRef<LiveManager | null>(null);

  // Initialize Manager once
  useEffect(() => {
    managerRef.current = new LiveManager();

    managerRef.current.onVolumeUpdate = (vol) => {
      setVolume(vol);
    };

    managerRef.current.onTranscriptUpdate = (text) => {
      // Simple logic: if text ends with punctuation, consider it a segment
      // The API sends cumulative updates for the current turn.
      // We'll display the current cumulative text in `currentTranscript`.
      // When it's "done" (this logic is imperfect with streaming text, 
      // usually we rely on turnComplete but for monitoring we just show raw)
      // We will simply display the raw streaming text.
      // To make it look like a log, if the text gets very long or clears, we push to history.
      // For this demo: we just update current.
      // IMPROVEMENT: If the text drastically changes or is empty, it might be a new turn.
      // But for simplicity, we just show what the server sends.
      
      // If the new text is shorter than previous, it's likely a new turn started, push previous to history
      setCurrentTranscript(prev => {
        if (text.length < prev.length && prev.trim().length > 0) {
          setTranscriptHistory(h => [...h, prev]);
          return text;
        }
        return text;
      });
    };

    managerRef.current.onIntentDetected = (intentData) => {
      const newIntent: DetectedIntent = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        ...intentData
      };
      setIntents(prev => [...prev, newIntent]);
    };

    managerRef.current.onError = (err) => {
      setError(err.message);
      setIsRecording(false);
    };

    managerRef.current.onDisconnect = () => {
      setIsRecording(false);
      setCurrentTranscript(''); // Clear current when stopped
    };

    return () => {
      if (managerRef.current) {
        managerRef.current.disconnect();
      }
    };
  }, []);

  const toggleRecording = useCallback(async () => {
    if (!managerRef.current) return;

    if (isRecording) {
      managerRef.current.disconnect();
    } else {
      setError(null);
      await managerRef.current.connect();
      setIsRecording(true);
    }
  }, [isRecording]);

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-cyan-500/30">
      
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h1 className="font-bold text-lg tracking-tight text-zinc-100">
            Gemini <span className="text-cyan-400">Monitor</span>
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {error && (
            <div className="text-red-400 text-sm flex items-center gap-2 px-3 py-1 rounded-full bg-red-400/10 border border-red-400/20">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
          
          <button
            onClick={toggleRecording}
            className={`
              flex items-center gap-2 px-6 py-2 rounded-full font-semibold transition-all duration-300
              ${isRecording 
                ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20 hover:shadow-red-500/20' 
                : 'bg-cyan-500 text-black hover:bg-cyan-400 hover:shadow-lg hover:shadow-cyan-500/30'
              }
            `}
          >
            {isRecording ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                Stop Monitoring
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Monitoring
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden max-w-7xl mx-auto w-full">
        
        {/* Left Panel: Transcript (7 cols) */}
        <section className="lg:col-span-7 h-[60vh] lg:h-auto flex flex-col gap-4">
          <TranscriptLog history={transcriptHistory} current={currentTranscript} />
          
          {/* Visualizer Area */}
          <div className="hidden lg:block">
             <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Microphone Input</span>
                <span className={`text-xs uppercase font-mono ${isRecording ? 'text-green-400' : 'text-zinc-600'}`}>
                  {isRecording ? 'ACTIVE' : 'IDLE'}
                </span>
             </div>
             <Visualizer volume={volume} active={isRecording} />
          </div>
        </section>

        {/* Right Panel: Intelligence/Analysis (5 cols) */}
        <section className="lg:col-span-5 h-[40vh] lg:h-auto flex flex-col">
          <IntentPanel intents={intents} />
        </section>
        
        {/* Mobile Visualizer (visible only on small screens) */}
        <div className="lg:hidden block h-16">
           <Visualizer volume={volume} active={isRecording} />
        </div>

      </main>
    </div>
  );
};

export default App;