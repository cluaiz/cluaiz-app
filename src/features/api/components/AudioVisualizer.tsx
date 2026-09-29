import React, { useEffect, useRef, useState } from 'react';
import { Volume2, Activity, Play, Pause } from 'lucide-react';

interface AudioVisualizerProps {
    audioBase64: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ audioBase64 }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [audioSrc, setAudioSrc] = useState<string>('');
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [metadata, setMetadata] = useState<string>('Ready');

    useEffect(() => {
        if (!audioBase64) return;

        try {
            // Determine audio mime type (WAV or MP3)
            let mime = 'audio/wav';
            if (audioBase64.startsWith('//uQ') || audioBase64.startsWith('SUQz')) {
                mime = 'audio/mp3';
            }

            const binaryStr = atob(audioBase64);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }

            const blob = new Blob([bytes], { type: mime });
            const url = URL.createObjectURL(blob);
            setAudioSrc(url);
            setMetadata(`${mime.toUpperCase()} • ${(bytes.length / 1024).toFixed(1)} KB`);

            return () => {
                URL.revokeObjectURL(url);
            };
        } catch (err: any) {
            console.error('[AudioVisualizer] Failed to process base64 audio:', err);
            setMetadata(`Decode error: ${err.message}`);
        }
    }, [audioBase64]);

    useEffect(() => {
        const audio = audioRef.current;
        const canvas = canvasRef.current;
        if (!audio || !canvas || !audioSrc) return;

        let animationId: number;
        let audioCtx: AudioContext | null = null;

        try {
            audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;

            const source = audioCtx.createMediaElementSource(audio);
            source.connect(analyser);
            analyser.connect(audioCtx.destination);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            const ctx = canvas.getContext('2d');

            const draw = () => {
                animationId = requestAnimationFrame(draw);
                if (!ctx) return;

                analyser.getByteFrequencyData(dataArray);

                ctx.fillStyle = '#050811';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                const barWidth = (canvas.width / bufferLength) * 2.2;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = (dataArray[i] / 255) * canvas.height;

                    const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
                    gradient.addColorStop(0, '#3b82f6');
                    gradient.addColorStop(0.5, '#8b5cf6');
                    gradient.addColorStop(1, '#ec4899');

                    ctx.fillStyle = gradient;
                    ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                    x += barWidth + 1;
                }
            };

            const onPlay = () => {
                setIsPlaying(true);
                if (audioCtx && audioCtx.state === 'suspended') {
                    audioCtx.resume();
                }
                draw();
            };

            const onPause = () => {
                setIsPlaying(false);
                cancelAnimationFrame(animationId);
            };

            audio.addEventListener('play', onPlay);
            audio.addEventListener('pause', onPause);
            audio.addEventListener('ended', onPause);

            return () => {
                audio.removeEventListener('play', onPlay);
                audio.removeEventListener('pause', onPause);
                audio.removeEventListener('ended', onPause);
                cancelAnimationFrame(animationId);
                audioCtx?.close();
            };
        } catch (e) {
            console.warn('[AudioVisualizer] AudioContext initialization skipped:', e);
        }
    }, [audioSrc]);

    if (!audioBase64) return null;

    return (
        <div className="flex flex-col gap-3 p-4 bg-[var(--bg-secondary)]/60 rounded-xl border border-[var(--border-color)] shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--accent-color)]">
                <div className="flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4" />
                    <span>Live Audio Synthesizer Output</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-muted)]">
                    <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span>{metadata}</span>
                </div>
            </div>

            {/* Native HTML5 Audio Player */}
            <audio
                ref={audioRef}
                src={audioSrc}
                controls
                autoPlay
                className="w-full h-10 rounded-lg outline-none custom-audio-player"
            />

            {/* Real-time Spectrum / Waveform Canvas */}
            <div className="flex flex-col gap-1">
                <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                    Waveform Frequency Spectrum
                </div>
                <canvas
                    ref={canvasRef}
                    width={600}
                    height={80}
                    className="w-full h-20 bg-black rounded-lg border border-[var(--border-color)]"
                />
            </div>
        </div>
    );
};
