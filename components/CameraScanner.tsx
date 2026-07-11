'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, CameraOff, Loader as Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CameraScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

export default function CameraScanner({ onDetected, onClose }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectorRef = useRef<any>(null);
  const lastScanned = useRef('');
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState<'loading' | 'scanning' | 'error' | 'unsupported'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDevice, setActiveDevice] = useState('');

  const handleDetected = useCallback((code: string) => {
    if (!code || code === lastScanned.current) return;
    lastScanned.current = code;
    if (cooldownRef.current) clearTimeout(cooldownRef.current);
    cooldownRef.current = setTimeout(() => { lastScanned.current = ''; }, 2500);
    onDetected(code);
  }, [onDetected]);

  const scanFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    if (detectorRef.current) {
      try {
        const results = await detectorRef.current.detect(video);
        if (results?.length > 0) {
          handleDetected(results[0].rawValue);
        }
      } catch {}
    }

    rafRef.current = requestAnimationFrame(scanFrame);
  }, [handleDetected]);

  async function startCamera(deviceId?: string) {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    cancelAnimationFrame(rafRef.current);

    setStatus('loading');
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: 'environment' } },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Set up native BarcodeDetector
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const formats = await window.BarcodeDetector.getSupportedFormats?.();
          detectorRef.current = new window.BarcodeDetector({
            formats: formats?.length > 0 ? formats : undefined,
          });
        } catch {
          detectorRef.current = new window.BarcodeDetector();
        }
      } else {
        setStatus('unsupported');
        setErrorMsg('Your browser does not support camera barcode scanning. Use Chrome or Edge, or type the barcode manually.');
        return;
      }

      setStatus('scanning');
      rafRef.current = requestAnimationFrame(scanFrame);

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const cams = allDevices.filter(d => d.kind === 'videoinput');
      setDevices(cams);
      if (!deviceId && cams.length > 0) {
        const trackSettings = stream.getVideoTracks()[0]?.getSettings();
        setActiveDevice(trackSettings?.deviceId || cams[0].deviceId);
      } else if (deviceId) {
        setActiveDevice(deviceId);
      }
    } catch (err: any) {
      setStatus('error');
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setErrorMsg('Camera permission denied. Allow camera access in your browser settings and try again.');
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setErrorMsg('No camera found on this device.');
      } else if (err?.name === 'NotReadableError') {
        setErrorMsg('Camera is already in use by another application.');
      } else {
        setErrorMsg(err?.message || 'Could not start camera.');
      }
    }
  }

  useEffect(() => {
    startCamera();
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchCamera(deviceId: string) {
    if (deviceId === activeDevice) return;
    startCamera(deviceId);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-emerald-400" />
          <span className="text-white font-semibold text-sm">Camera Barcode Scanner</span>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 bg-slate-800/80 rounded-full flex items-center justify-center text-white hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Viewfinder */}
      <div className="relative w-full max-w-sm aspect-square bg-black rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scanning overlay */}
        {status === 'scanning' && (
          <>
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'radial-gradient(ellipse 55% 55% at center, transparent 55%, rgba(0,0,0,0.6) 100%)',
            }} />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-52 h-52">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-emerald-400 rounded-tl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-emerald-400 rounded-tr" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br" />
                <div className="absolute left-2 right-2 h-0.5 bg-emerald-400/90 rounded-full shadow-[0_0_6px_#10b981] animate-[scan_1.8s_ease-in-out_infinite]" />
              </div>
            </div>
          </>
        )}

        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
            <p className="text-slate-400 text-sm">Starting camera...</p>
          </div>
        )}

        {(status === 'error' || status === 'unsupported') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 p-6 text-center">
            <CameraOff className="w-12 h-12 text-slate-500 mb-3" />
            <p className="text-slate-300 text-sm font-medium mb-2">
              {status === 'unsupported' ? 'Browser Not Supported' : 'Camera Unavailable'}
            </p>
            <p className="text-slate-500 text-xs leading-relaxed max-w-xs">{errorMsg}</p>
            {status === 'error' && (
              <Button
                size="sm"
                onClick={() => startCamera()}
                className="mt-4 bg-emerald-500 hover:bg-emerald-400 text-white text-xs h-8"
              >
                Retry
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-5 text-center">
        <p className="text-white text-sm font-medium">Point camera at a barcode</p>
        <p className="text-slate-400 text-xs mt-1">Hold steady — scans automatically</p>
      </div>

      {/* Camera switcher */}
      {devices.length > 1 && status === 'scanning' && (
        <div className="mt-4 flex gap-2 flex-wrap justify-center max-w-xs">
          {devices.map((d, i) => (
            <button
              key={d.deviceId}
              onClick={() => switchCamera(d.deviceId)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                activeDevice === d.deviceId
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'border-slate-600 text-slate-400 hover:text-white hover:border-slate-400 bg-slate-900/50'
              )}
            >
              {d.label || `Camera ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      <Button
        onClick={onClose}
        variant="outline"
        className="mt-5 border-slate-600 text-slate-300 hover:text-white hover:border-slate-400"
      >
        Cancel
      </Button>

      <style jsx global>{`
        @keyframes scan {
          0%   { top: 8px;  opacity: 1; }
          50%  { top: calc(100% - 10px); opacity: 0.8; }
          100% { top: 8px;  opacity: 1; }
        }
      `}</style>
    </div>
  );
}
