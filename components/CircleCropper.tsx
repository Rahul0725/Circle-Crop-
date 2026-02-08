import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CropState, ExportResult } from '../types';

interface CircleCropperProps {
  sourceSrc: string;
  isVideo: boolean;
  onCropComplete: (result: ExportResult) => void;
  onCancel: () => void;
}

export const CircleCropper: React.FC<CircleCropperProps> = ({ sourceSrc, isVideo, onCropComplete, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [state, setState] = useState<CropState>({ x: 0, y: 0, zoom: 1, rotation: 0 });
  const [dragging, setDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const requestRef = useRef<number>(null);

  useEffect(() => {
    if (isVideo) {
      const video = document.createElement('video');
      video.src = sourceSrc;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      video.onloadeddata = () => {
        video.play();
        videoRef.current = video;
        const canvasSize = 800;
        const diameter = canvasSize * 0.8;
        const initialScale = diameter / Math.min(video.videoWidth, video.videoHeight);
        setState({ x: 0, y: 0, zoom: initialScale, rotation: 0 });
        setIsLoaded(true);
      };
    } else {
      const img = new Image();
      img.src = sourceSrc;
      img.crossOrigin = "anonymous";
      img.onload = () => {
        imageRef.current = img;
        const canvasSize = 800;
        const diameter = canvasSize * 0.8;
        const initialScale = diameter / Math.min(img.width, img.height);
        setState({ x: 0, y: 0, zoom: initialScale, rotation: 0 });
        setIsLoaded(true);
      };
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [sourceSrc, isVideo]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const media = isVideo ? videoRef.current : imageRef.current;
    
    if (!canvas || !ctx || !media) return;

    const size = canvas.width;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.4;
    const mediaWidth = isVideo ? (media as HTMLVideoElement).videoWidth : (media as HTMLImageElement).width;
    const mediaHeight = isVideo ? (media as HTMLVideoElement).videoHeight : (media as HTMLImageElement).height;

    ctx.clearRect(0, 0, size, size);

    // 1. Background (Blurred)
    ctx.save();
    ctx.filter = 'blur(20px) brightness(0.4)';
    ctx.translate(centerX + state.x, centerY + state.y);
    ctx.rotate((state.rotation * Math.PI) / 180);
    ctx.scale(state.zoom, state.zoom);
    ctx.drawImage(media, -mediaWidth / 2, -mediaHeight / 2);
    ctx.restore();

    // 2. Overlay
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, size, size);

    // 3. Mask Cutout
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // 4. Actual Image/Video in Circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(centerX + state.x, centerY + state.y);
    ctx.rotate((state.rotation * Math.PI) / 180);
    ctx.scale(state.zoom, state.zoom);
    ctx.drawImage(media, -mediaWidth / 2, -mediaHeight / 2);
    ctx.restore();

    // 5. Glossy Border
    const grad = ctx.createLinearGradient(0, centerY - radius, 0, centerY + radius);
    grad.addColorStop(0, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0.1)');
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 4;
    ctx.stroke();

    if (isVideo) {
      requestRef.current = requestAnimationFrame(draw);
    }
  }, [state, isVideo]);

  useEffect(() => {
    if (isLoaded) draw();
  }, [isLoaded, draw]);

  const handleStart = (clientX: number, clientY: number) => {
    setDragging(true);
    setLastPos({ x: clientX, y: clientY });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!dragging) return;
    const dx = clientX - lastPos.x;
    const dy = clientY - lastPos.y;
    setState(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    setLastPos({ x: clientX, y: clientY });
  };

  const handleFinish = async () => {
    const media = isVideo ? videoRef.current : imageRef.current;
    if (!media) return;

    const exportSize = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = exportSize;
    canvas.height = exportSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const S = exportSize / (800 * 0.8);
    const mediaWidth = isVideo ? (media as HTMLVideoElement).videoWidth : (media as HTMLImageElement).width;
    const mediaHeight = isVideo ? (media as HTMLVideoElement).videoHeight : (media as HTMLImageElement).height;

    // For images, we export a blob immediately
    if (!isVideo) {
      ctx.beginPath();
      ctx.arc(exportSize / 2, exportSize / 2, exportSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.translate(exportSize / 2 + state.x * S, exportSize / 2 + state.y * S);
      ctx.rotate((state.rotation * Math.PI) / 180);
      ctx.scale(state.zoom * S, state.zoom * S);
      ctx.drawImage(media, -mediaWidth / 2, -mediaHeight / 2);
      
      canvas.toBlob((blob) => {
        if (blob) onCropComplete({ blob, state, source: media, isVideo: false });
      }, 'image/png');
    } else {
      // For video, we pass the data so App.tsx can handle the recording phase
      // We pass a dummy blob for now, the real recording happens in the Export screen for simplicity or during processing
      canvas.toBlob((blob) => {
        if (blob) onCropComplete({ blob, state, source: media, isVideo: true });
      }, 'image/png');
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto">
      <div 
        className="relative w-full aspect-square rounded-[3rem] overflow-hidden glass-card shadow-2xl cursor-move touch-none mb-6"
        onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
        onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
        onMouseUp={() => setDragging(false)}
        onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={() => setDragging(false)}
      >
        <canvas ref={canvasRef} width={800} height={800} className="w-full h-full" />
      </div>

      <div className="w-full bg-white/40 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/50 shadow-sm space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span>Zoom</span>
            <span>{(state.zoom * 100).toFixed(0)}%</span>
          </div>
          <input 
            type="range" min="0.1" max="5" step="0.01" value={state.zoom} 
            onChange={(e) => setState(prev => ({ ...prev, zoom: parseFloat(e.target.value) }))}
            className="w-full accent-[#9333ea]"
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span>Rotation</span>
            <span>{state.rotation}°</span>
          </div>
          <input 
            type="range" min="-180" max="180" step="1" value={state.rotation} 
            onChange={(e) => setState(prev => ({ ...prev, rotation: parseInt(e.target.value) }))}
            className="w-full accent-[#9333ea]"
          />
        </div>
      </div>

      <div className="flex gap-4 w-full mt-6">
        <button onClick={onCancel} className="flex-1 py-4 rounded-[2rem] font-bold bg-white/60 text-slate-500 border border-white/60 active:scale-95 transition-all">
          Cancel
        </button>
        <button onClick={handleFinish} className="flex-1 py-4 rounded-[2rem] font-black jeli-gradient text-white jeli-shadow active:scale-95 transition-all text-lg">
          {isVideo ? 'Process Video' : 'Finish Crop'}
        </button>
      </div>
    </div>
  );
};