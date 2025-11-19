import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  volume: number;
  active: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({ volume, active }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  // Smooth out the volume
  const smoothedVolume = useRef(0);

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!active) {
      // Draw idle line
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.strokeStyle = '#3f3f46'; // zinc-700
      ctx.lineWidth = 2;
      ctx.stroke();
      return;
    }

    // Smooth volume
    smoothedVolume.current += (volume - smoothedVolume.current) * 0.1;
    const barHeight = Math.min(smoothedVolume.current * 200, height / 2); 

    // Draw Waveform-ish visualization
    const centerY = height / 2;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    
    // Generate a sine wave that reacts to volume
    const frequency = 0.1;
    const time = Date.now() * 0.005;
    
    for (let x = 0; x < width; x++) {
      const y = centerY + Math.sin(x * frequency + time) * barHeight * Math.sin(x / width * Math.PI);
      ctx.lineTo(x, y);
    }

    ctx.strokeStyle = '#22d3ee'; // cyan-400
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#22d3ee';
    ctx.stroke();
    ctx.shadowBlur = 0;

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [volume, active]);

  return (
    <div className="w-full h-16 bg-zinc-900/50 rounded-lg border border-zinc-800 overflow-hidden">
      <canvas 
        ref={canvasRef} 
        width={300} 
        height={64} 
        className="w-full h-full block"
      />
    </div>
  );
};