import React, { useState, useRef, useEffect } from 'react';
import { CircleCropper } from './components/CircleCropper';
import { JeliButton } from './components/JeliButton';
import { ExportResult } from './types';
import { GoogleGenAI } from "@google/genai";
import { 
  Image as ImageIcon, 
  Upload, 
  Download, 
  RotateCcw, 
  CheckCircle2, 
  ArrowLeft, 
  Sparkles, 
  Camera, 
  FileImage, 
  FileCode, 
  Film,
  Wand2,
  Layers
} from 'lucide-react';

type ExportFormat = 'png' | 'jpg' | 'svg' | 'mp4';

const App: React.FC = () => {
  const [sourceData, setSourceData] = useState<{ src: string; isVideo: boolean } | null>(null);
  const [exportData, setExportData] = useState<ExportResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentFormat, setCurrentFormat] = useState<ExportFormat>('png');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [recordingProgress, setRecordingProgress] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith('video/');
      const reader = new FileReader();
      reader.onload = (event) => {
        setSourceData({ src: event.target?.result as string, isVideo });
        setExportData(null);
        setPreviewUrl(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeBackground = async () => {
    if (!exportData || exportData.isVideo) return;
    
    setIsProcessing(true);
    setProcessingMessage('Magic Background Removal...');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const reader = new FileReader();
      
      const base64Data = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onloadend = () => resolve((r.result as string).split(',')[1]);
        r.readAsDataURL(exportData.blob);
      });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: 'image/png' } },
            { text: 'Remove the background of this image. Keep only the central subject and make everything else transparent. Return the result as a high-quality image.' }
          ]
        }
      });

      let newImageBase64 = '';
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          newImageBase64 = part.inlineData.data;
          break;
        }
      }

      if (newImageBase64) {
        const byteCharacters = atob(newImageBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const newBlob = new Blob([byteArray], { type: 'image/png' });
        
        const url = URL.createObjectURL(newBlob);
        setPreviewUrl(url);
        setExportData({ ...exportData, blob: newBlob, bgRemoved: true });
      }
    } catch (error) {
      console.error('BG removal failed:', error);
      alert('Background removal failed. Please check your connection.');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  const onCropComplete = async (result: ExportResult) => {
    setIsProcessing(true);
    setProcessingMessage('Generating Preview...');
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (result.isVideo) {
      setCurrentFormat('mp4');
      const url = URL.createObjectURL(result.blob);
      setPreviewUrl(url);
      setExportData(result);
      setSourceData(null);
      setIsProcessing(false);
    } else {
      setCurrentFormat('png');
      setTimeout(() => {
        const url = URL.createObjectURL(result.blob);
        setPreviewUrl(url);
        setExportData(result);
        setSourceData(null);
        setIsProcessing(false);
      }, 600);
    }
  };

  const exportVideoAsSVG = async () => {
    if (!exportData || !exportData.isVideo) return;
    const video = exportData.source as HTMLVideoElement;
    const { state } = exportData;
    const exportSize = 1024;
    const S = exportSize / (800 * 0.8);

    // To include a video in an SVG, it needs to be base64 encoded or a valid URL
    // For this app, we'll create a circular SVG wrapper for the video
    const svgString = `
<svg width="${exportSize}" height="${exportSize}" viewBox="0 0 ${exportSize} ${exportSize}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="circleClip">
      <circle cx="${exportSize/2}" cy="${exportSize/2}" r="${exportSize/2}" />
    </clipPath>
  </defs>
  <foreignObject x="0" y="0" width="${exportSize}" height="${exportSize}" clip-path="url(#circleClip)">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
      <video autoplay="true" loop="true" muted="true" style="
        transform: translate(${state.x * S}px, ${state.y * S}px) 
                   rotate(${state.rotation}deg) 
                   scale(${state.zoom * S});
        width: ${video.videoWidth}px;
        height: ${video.videoHeight}px;
        object-fit: cover;
      ">
        <source src="${sourceData?.src || ''}" type="video/mp4" />
      </video>
    </div>
  </foreignObject>
</svg>`.trim();

    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `habib_video_container_${Date.now()}.svg`;
    link.click();
  };

  const recordVideoExport = async () => {
    if (!exportData || !exportData.isVideo) return;
    setIsProcessing(true);
    setProcessingMessage('Recording Loop...');
    setRecordingProgress(0);

    const video = exportData.source as HTMLVideoElement;
    const { state } = exportData;
    const exportSize = 720; 
    const canvas = document.createElement('canvas');
    canvas.width = exportSize;
    canvas.height = exportSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const S = exportSize / (800 * 0.8);
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `habib_video_crop_${Date.now()}.webm`;
      link.click();
      setIsProcessing(false);
      setRecordingProgress(0);
    };

    video.currentTime = 0;
    await video.play();
    recorder.start();
    
    const duration = Math.min(video.duration || 5, 10); // Limit to 10s for browser stability
    const startTime = performance.now();

    const renderFrame = () => {
      const now = performance.now();
      const elapsed = (now - startTime) / 1000;
      setRecordingProgress(Math.min(100, (elapsed / duration) * 100));

      if (elapsed >= duration || video.ended) {
        recorder.stop();
        video.pause();
        return;
      }

      ctx.clearRect(0, 0, exportSize, exportSize);
      ctx.save();
      ctx.beginPath();
      ctx.arc(exportSize / 2, exportSize / 2, exportSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.translate(exportSize / 2 + state.x * S, exportSize / 2 + state.y * S);
      ctx.rotate((state.rotation * Math.PI) / 180);
      ctx.scale(state.zoom * S, state.zoom * S);
      ctx.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2);
      ctx.restore();

      requestAnimationFrame(renderFrame);
    };

    renderFrame();
  };

  const downloadImage = () => {
    if (!exportData || exportData.isVideo) return;
    const { blob, state, source } = exportData;
    const img = source as HTMLImageElement;
    const exportSize = 1024;
    const timestamp = Date.now();

    if (currentFormat === 'png') {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `habib_image_${timestamp}.png`;
      link.click();
    } else if (currentFormat === 'jpg') {
      const canvas = document.createElement('canvas');
      canvas.width = exportSize;
      canvas.height = exportSize;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, exportSize, exportSize);
        ctx.beginPath();
        ctx.arc(exportSize / 2, exportSize / 2, exportSize / 2, 0, Math.PI * 2);
        ctx.clip();
        const S = exportSize / (800 * 0.8);
        ctx.translate(exportSize / 2 + state.x * S, exportSize / 2 + state.y * S);
        ctx.rotate((state.rotation * Math.PI) / 180);
        ctx.scale(state.zoom * S, state.zoom * S);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        canvas.toBlob((b) => {
          if (b) {
            const l = document.createElement('a');
            l.href = URL.createObjectURL(b);
            l.download = `habib_image_${timestamp}.jpg`;
            l.click();
          }
        }, 'image/jpeg', 0.9);
      }
    } else if (currentFormat === 'svg') {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      const base64 = canvas.toDataURL('image/png');
      const S = exportSize / (800 * 0.8);
      const svg = `
<svg width="${exportSize}" height="${exportSize}" viewBox="0 0 ${exportSize} ${exportSize}" xmlns="http://www.w3.org/2000/svg">
  <defs><clipPath id="c"><circle cx="${exportSize/2}" cy="${exportSize/2}" r="${exportSize/2}" /></clipPath></defs>
  <g clip-path="url(#c)">
    <image width="${img.width}" height="${img.height}" href="${base64}" transform="translate(${exportSize/2 + state.x*S}, ${exportSize/2 + state.y*S}) rotate(${state.rotation}) scale(${state.zoom*S}) translate(${-img.width/2}, ${-img.height/2})" />
  </g>
</svg>`.trim();
      const b = new Blob([svg], { type: 'image/svg+xml' });
      const l = document.createElement('a');
      l.href = URL.createObjectURL(b);
      l.download = `habib_image_${timestamp}.svg`;
      l.click();
    }
  };

  const reset = () => {
    setSourceData(null);
    setExportData(null);
    setPreviewUrl(null);
    setRecordingProgress(0);
    setProcessingMessage('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-12">
      <div className="w-full max-w-xl relative z-10">
        
        {!sourceData && !exportData && (
          <header className="text-center mb-10 space-y-3 animate-in fade-in slide-in-from-top-8 duration-700">
            <div className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/50 shadow-sm mb-2">
              <Sparkles size={14} className="text-[#9333ea]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Premium Circle Studio</span>
            </div>
            <h1 className="text-5xl font-[900] text-slate-800 tracking-tighter">
              Habib<span className="text-[#9333ea]">Crop</span>
            </h1>
          </header>
        )}

        <main>
          {/* Landing */}
          {!sourceData && !exportData && (
            <div className="glass-card rounded-[3.5rem] p-10 text-center space-y-10 animate-in zoom-in-95 duration-500 shadow-2xl border-white/60">
              <div className="w-28 h-28 jeli-gradient rounded-[2.5rem] flex items-center justify-center mx-auto jeli-shadow rotate-3 group relative">
                 <Layers size={44} className="text-white group-hover:scale-110 transition-transform duration-500" />
              </div>
              
              <div className="space-y-3">
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">AI-Powered Studio</h2>
              </div>

              <div className="flex flex-col gap-4 pt-2">
                <JeliButton onClick={() => cameraInputRef.current?.click()} className="w-full text-xl py-6 rounded-[2rem]">
                  <Camera size={24} /> Take Photo/Video
                </JeliButton>
                
                <JeliButton variant="secondary" onClick={() => fileInputRef.current?.click()} className="w-full text-xl py-6 rounded-[2rem]">
                  <Upload size={24} /> From Gallery
                </JeliButton>

                <input type="file" ref={cameraInputRef} onChange={handleFileChange} accept="image/*,video/*" capture="environment" className="hidden" />
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" className="hidden" />
              </div>
            </div>
          )}

          {/* Crop */}
          {sourceData && (
            <div className="animate-in slide-in-from-bottom-8 duration-500">
              <div className="flex items-center gap-4 mb-6 px-2">
                <button onClick={() => setSourceData(null)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/60 text-slate-600 active:scale-90 transition-all border border-white/60">
                  <ArrowLeft size={24} />
                </button>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Refine Frame</h2>
              </div>
              <CircleCropper sourceSrc={sourceData.src} isVideo={sourceData.isVideo} onCropComplete={onCropComplete} onCancel={() => setSourceData(null)} />
            </div>
          )}

          {/* Export */}
          {exportData && previewUrl && (
            <div className="glass-card rounded-[3.5rem] p-10 text-center space-y-8 animate-in fade-in scale-95 duration-500 shadow-2xl">
              <div className="relative inline-block group">
                <div className="w-64 h-64 sm:w-72 sm:h-72 mx-auto rounded-full p-1 bg-white shadow-2xl relative z-10 overflow-hidden">
                  {exportData.isVideo ? (
                    <video src={previewUrl} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                  ) : (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-[#10b981] text-white p-4 rounded-3xl shadow-2xl z-20 border-4 border-white animate-bounce">
                  <CheckCircle2 size={32} />
                </div>
              </div>

              <div className="bg-slate-100/60 p-1.5 rounded-full flex gap-1 border border-black/5 mx-auto w-full max-w-[320px]">
                {(exportData.isVideo ? ['mp4', 'svg'] : ['png', 'jpg', 'svg']).map(format => (
                  <button
                    key={format}
                    onClick={() => setCurrentFormat(format as ExportFormat)}
                    className={`flex-1 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${
                      currentFormat === format 
                      ? 'bg-white text-slate-800 shadow-md scale-[1.05]' 
                      : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {format}
                  </button>
                ))}
              </div>

              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black text-slate-800 tracking-tight">Studio Final</h2>
                  <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.2em]">
                    {exportData.isVideo ? 'Export as Loop or SVG Container' : `Save as ${currentFormat.toUpperCase()}`}
                  </p>
                </div>
                
                <div className="flex flex-col gap-4">
                  {!exportData.isVideo && !exportData.bgRemoved && (
                    <JeliButton 
                      variant="secondary"
                      onClick={removeBackground} 
                      className="w-full py-4 rounded-[2rem] text-sm border-[#9333ea]/30 text-[#9333ea]"
                    >
                      <Wand2 size={20} /> AI Remove BG
                    </JeliButton>
                  )}
                  
                  <JeliButton 
                    onClick={exportData.isVideo ? (currentFormat === 'svg' ? exportVideoAsSVG : recordVideoExport) : downloadImage} 
                    className="w-full text-xl py-6 rounded-[2.2rem] shadow-xl"
                  >
                    {exportData.isVideo ? <Film size={24} /> : <Download size={24} />}
                    {exportData.isVideo ? (currentFormat === 'svg' ? 'Save as SVG' : 'Record & Save') : `Download ${currentFormat.toUpperCase()}`}
                  </JeliButton>
                  
                  <JeliButton variant="secondary" onClick={reset} className="w-full py-4 text-xs font-black rounded-[2rem] uppercase tracking-widest opacity-80">
                    <RotateCcw size={16} /> New Session
                  </JeliButton>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-3xl z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300">
           <div className="relative">
              <div className="w-24 h-24 jeli-gradient rounded-[2rem] animate-spin flex items-center justify-center jeli-shadow">
                 <div className="w-12 h-12 bg-white rounded-full opacity-90 shadow-inner"></div>
              </div>
              {recordingProgress > 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-black text-white">{Math.round(recordingProgress)}%</span>
                </div>
              )}
           </div>
           <p className="mt-8 font-black text-xl text-slate-800 tracking-tight uppercase tracking-widest opacity-70">
              {processingMessage || (recordingProgress > 0 ? 'Recording Loop...' : 'Processing...')}
           </p>
           {recordingProgress > 0 && (
             <div className="w-64 h-1.5 bg-slate-200 rounded-full mt-4 overflow-hidden border border-white">
                <div 
                  className="h-full jeli-gradient transition-all duration-300"
                  style={{ width: `${recordingProgress}%` }}
                />
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default App;