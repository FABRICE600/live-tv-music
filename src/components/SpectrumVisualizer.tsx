import { useEffect, useRef } from 'react';
import type { StageVisualizationStyle } from '../types/music';

interface SpectrumVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  hasLiveSignal: boolean;
  height?: number;
  bars?: number;
  visualizationStyle?: StageVisualizationStyle;
  className?: string;
}

export function SpectrumVisualizer({
  analyser,
  isPlaying,
  hasLiveSignal,
  height = 140,
  bars = 48,
  visualizationStyle = 'bar',
  className = '',
}: SpectrumVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId = 0;
    let phase = 0;
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    const timeArray = analyser ? new Uint8Array(analyser.fftSize) : null;
    const smoothed = new Float32Array(bars);

    const render = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
          canvas.width = Math.floor(rect.width * dpr);
          canvas.height = Math.floor(rect.height * dpr);
        }
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const styles = getComputedStyle(document.documentElement);
      const activeColor = styles.getPropertyValue('--sm-accent-text').trim() || '#D9481E';
      const midColor = styles.getPropertyValue('--sm-text-sec').trim() || '#737067';
      const baseColor = styles.getPropertyValue('--sm-border').trim() || '#CFCBC0';

      let liveEnergy = 0;
      if (analyser && dataArray && hasLiveSignal && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
        for (let k = 0; k < Math.min(32, dataArray.length); k++) {
          liveEnergy += dataArray[k];
        }
      }

      const useRealFft = Boolean(analyser && dataArray && hasLiveSignal && isPlaying && liveEnergy > 0);
      phase += isPlaying ? 0.055 : 0.01;

      if (visualizationStyle === 'waveform') {
        if (useRealFft && analyser && timeArray) {
          analyser.getByteTimeDomainData(timeArray);
        }
        const points = 72;
        ctx.beginPath();
        for (let i = 0; i < points; i++) {
          const t = i / (points - 1);
          let sample = 0;
          if (useRealFft && timeArray) {
            const idx = Math.min(timeArray.length - 1, Math.floor(t * (timeArray.length - 1)));
            sample = (timeArray[idx] - 128) / 128;
          } else if (isPlaying) {
            sample =
              Math.sin(phase * 1.4 + t * Math.PI * 6) * 0.36 +
              Math.cos(phase * 2.1 - t * Math.PI * 10) * 0.2;
          } else {
            sample = Math.sin(t * Math.PI * 4) * 0.04;
          }
          const x = t * w;
          const y = h * 0.5 + sample * (h * 0.38);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 2.5 * dpr;
        ctx.strokeStyle = isPlaying ? activeColor : baseColor;
        ctx.stroke();

        ctx.lineTo(w, h * 0.5);
        ctx.lineTo(0, h * 0.5);
        ctx.closePath();
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = isPlaying ? activeColor : baseColor;
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (visualizationStyle === 'circle') {
        const cx = w * 0.5;
        const cy = h * 0.5;
        const minDim = Math.min(w, h);
        const innerR = minDim * 0.24;
        const maxExtend = minDim * 0.22;
        const ringSegments = Math.min(bars, 48);

        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 1.5 * dpr;
        ctx.stroke();

        for (let i = 0; i < ringSegments; i++) {
          let target = 0.08;
          if (useRealFft && dataArray) {
            const binIndex = Math.min(
              dataArray.length - 1,
              Math.floor(Math.pow(i / ringSegments, 1.2) * (dataArray.length * 0.55)),
            );
            target = Math.max(0.08, dataArray[binIndex] / 255);
          } else if (isPlaying) {
            const wave = Math.sin(phase * 1.2 + i * 0.45) * 0.3 + 0.36;
            target = Math.max(0.1, Math.min(0.92, wave));
          }
          smoothed[i] = smoothed[i] + (target - smoothed[i]) * 0.22;
          const angle = (i / ringSegments) * Math.PI * 2 - Math.PI / 2 + (isPlaying ? phase * 0.12 : 0);
          const r1 = innerR + 3 * dpr;
          const r2 = r1 + smoothed[i] * maxExtend;

          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
          ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
          ctx.strokeStyle = smoothed[i] > 0.42 && isPlaying ? activeColor : isPlaying ? midColor : baseColor;
          ctx.lineWidth = Math.max(2 * dpr, (minDim * 0.018));
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      } else {
        const gap = Math.max(2 * dpr, Math.floor(w / (bars * 3.2)));
        const barWidth = Math.max(2 * dpr, (w - gap * (bars - 1)) / bars);

        for (let i = 0; i < bars; i++) {
          let target = 0.06;
          if (useRealFft && dataArray) {
            const binIndex = Math.min(
              dataArray.length - 1,
              Math.floor(Math.pow(i / bars, 1.35) * (dataArray.length * 0.65)),
            );
            target = Math.max(0.06, dataArray[binIndex] / 255);
          } else if (isPlaying) {
            // Graceful deterministic harmonic motion when stream restricts WebAudio CORS nodes
            const wave1 = Math.sin(phase + i * 0.34) * 0.28 + 0.32;
            const wave2 = Math.cos(phase * 1.4 - i * 0.21) * 0.2 + 0.22;
            const envelope = 1 - Math.abs((i / bars) - 0.35) * 0.55;
            target = Math.max(0.08, Math.min(0.92, (wave1 + wave2) * envelope));
          }

          smoothed[i] = smoothed[i] + (target - smoothed[i]) * 0.22;
          const barH = Math.max(3 * dpr, smoothed[i] * (h - 8 * dpr));
          const x = i * (barWidth + gap);
          const y = h - barH;

          ctx.fillStyle = smoothed[i] > 0.42 && isPlaying ? activeColor : isPlaying ? midColor : baseColor;
          ctx.beginPath();
          const radius = Math.min(barWidth / 2, 2 * dpr);
          ctx.roundRect(x, y, barWidth, barH, [radius, radius, 0, 0]);
          ctx.fill();
        }
      }

      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [analyser, isPlaying, hasLiveSignal, bars, visualizationStyle]);

  return (
    <canvas
      ref={canvasRef}
      style={{ height: `${height}px` }}
      className={`w-full block ${className}`}
      aria-label="Real-time audio frequency spectrum visualizer"
    />
  );
}
