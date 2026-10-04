import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
    Play, 
    Pause, 
    Volume2, 
    VolumeX, 
    Music, 
    Repeat, 
    Loader2,
    AlertCircle
} from 'lucide-react';
import { resolveMediaUrl, resolveMediaUrlSync } from '../../utils/mediaResolver';

interface AudioPreviewProps {
    filePath: string;
    fileName: string;
    rootPath?: string;
    content?: string;
}

export const AudioPreview: React.FC<AudioPreviewProps> = ({
    filePath,
    fileName,
    rootPath,
    content,
}) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const initialSyncUri = useMemo(() => {
        return resolveMediaUrlSync(rootPath, filePath, content);
    }, [rootPath, filePath, content]);

    const [src, setSrc] = useState<string>(initialSyncUri);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [duration, setDuration] = useState<number>(0);
    const [volume, setVolume] = useState<number>(1);
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [isLooping, setIsLooping] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(!initialSyncUri);
    const [hasError, setHasError] = useState<boolean>(false);

    const ext = fileName.split('.').pop()?.toUpperCase() || 'AUDIO';

    useEffect(() => {
        let isMounted = true;

        if (initialSyncUri) {
            setSrc(initialSyncUri);
            setIsLoading(false);
            setHasError(false);
            return;
        }

        setIsLoading(true);
        setHasError(false);

        resolveMediaUrl(rootPath, filePath, content)
            .then((url) => {
                if (!isMounted) return;
                if (url) {
                    setSrc(url);
                    setHasError(false);
                } else {
                    setHasError(true);
                }
            })
            .catch(() => {
                if (isMounted) setHasError(true);
            })
            .finally(() => {
                if (isMounted) setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [rootPath, filePath, content, initialSyncUri]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => setIsPlaying(true))
                    .catch((err) => {
                        console.warn('[AudioPreview] Playback failed:', err);
                        setIsPlaying(false);
                    });
            }
        }
    };

    const handleTimeUpdate = () => {
        if (!audioRef.current) return;
        setCurrentTime(audioRef.current.currentTime);
    };

    const handleCanPlay = () => {
        setIsLoading(false);
        setHasError(false);
        if (audioRef.current && (!duration || isNaN(duration))) {
            setDuration(audioRef.current.duration || 0);
        }
    };

    const handleLoadedMetadata = () => {
        if (!audioRef.current) return;
        setDuration(audioRef.current.duration || 0);
        setIsLoading(false);
        setHasError(false);
    };

    const handleAudioError = () => {
        setIsLoading(false);
        setHasError(true);
        setIsPlaying(false);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const targetTime = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = targetTime;
            setCurrentTime(targetTime);
        }
    };

    const toggleMute = () => {
        if (!audioRef.current) return;
        audioRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        if (audioRef.current) {
            audioRef.current.volume = val;
            audioRef.current.muted = val === 0;
            setIsMuted(val === 0);
        }
    };

    const toggleLoop = () => {
        if (!audioRef.current) return;
        audioRef.current.loop = !isLooping;
        setIsLooping(!isLooping);
    };



    const formatTime = (seconds: number): string => {
        if (isNaN(seconds) || !isFinite(seconds)) return '00:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="h-full w-full flex flex-col bg-[var(--bg-primary)] select-none font-sans overflow-hidden">
            {/* Top Toolbar */}
            <div className="h-10 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Music className="w-4 h-4 text-[var(--accent-color)]" />
                    <span className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[200px]">{fileName}</span>
                    <span className="text-[10px] font-mono font-bold text-[var(--accent-color)] bg-[var(--accent-color)]/10 px-2 py-0.5 rounded border border-[var(--accent-color)]/20">
                        {ext}
                    </span>
                </div>

                <div className="flex items-center gap-1.5" />
            </div>

            {/* Central Graphic Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 relative bg-[var(--bg-primary)]">
                {isLoading && !src && (
                    <div className="flex flex-col items-center justify-center gap-2 text-[var(--text-muted)] mb-6">
                        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-color)]" />
                        <span className="text-xs font-mono">Loading audio stream...</span>
                    </div>
                )}

                {hasError && (
                    <div className="flex flex-col items-center justify-center gap-2 text-amber-500 mb-6">
                        <AlertCircle className="w-8 h-8 opacity-80" />
                        <span className="text-xs font-mono">Unable to play audio format</span>
                    </div>
                )}

                {/* Vinyl / Disc Visualizer */}
                <div className={`w-48 h-48 rounded-full border-4 border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl flex items-center justify-center relative transition-all duration-700 ${isPlaying ? 'scale-105 shadow-[var(--accent-color)]/10' : 'scale-100'}`}>
                    {/* Accent Ring */}
                    <div className={`absolute inset-0 rounded-full bg-[var(--accent-color)]/5 transition-opacity duration-500 ${isPlaying ? 'opacity-100' : 'opacity-40'}`} />
                    
                    {/* Ring grooves */}
                    <div className="w-40 h-40 rounded-full border border-[var(--border-color)]/40 flex items-center justify-center">
                        <div className="w-32 h-32 rounded-full border border-[var(--border-color)]/60 flex items-center justify-center">
                            <div className="w-20 h-20 rounded-full bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/30 flex items-center justify-center shadow-inner">
                                <Music className={`w-9 h-9 text-[var(--accent-color)] transition-transform ${isPlaying ? 'animate-pulse' : ''}`} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Track Title */}
                <div className="mt-8 text-center max-w-md">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{fileName}</h3>
                    <p className="text-xs font-mono text-[var(--text-muted)] mt-1 flex items-center justify-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] inline-block animate-ping" />
                        Native Audio Stream
                    </p>
                </div>

                {/* Hidden Native Audio Element */}
                {src && (
                    <audio
                        ref={audioRef}
                        src={src}
                        preload="auto"
                        onTimeUpdate={handleTimeUpdate}
                        onCanPlay={handleCanPlay}
                        onLoadedMetadata={handleLoadedMetadata}
                        onError={handleAudioError}
                        onEnded={() => setIsPlaying(false)}
                    />
                )}
            </div>

            {/* Bottom Playback Control Bar */}
            <div className="h-16 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] px-6 flex items-center gap-4 flex-shrink-0">
                <button
                    type="button"
                    onClick={togglePlay}
                    disabled={hasError}
                    className="p-3 rounded-xl bg-[var(--accent-color)] text-white hover:opacity-90 shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>

                <span className="text-xs font-mono text-[var(--text-muted)] min-w-[45px] text-right">
                    {formatTime(currentTime)}
                </span>

                {/* Timeline Progress Slider */}
                <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 h-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-color)] transition-all"
                />

                <span className="text-xs font-mono text-[var(--text-muted)] min-w-[45px]">
                    {formatTime(duration)}
                </span>

                {/* Loop Button */}
                <button
                    type="button"
                    onClick={toggleLoop}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${isLooping ? 'bg-[var(--accent-color)]/20 text-[var(--accent-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                    title={isLooping ? 'Loop Enabled' : 'Loop Disabled'}
                >
                    <Repeat className="w-4 h-4" />
                </button>

                {/* Volume Controls */}
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={toggleMute}
                        className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    >
                        {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-20 h-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-color)]"
                    />
                </div>
            </div>
        </div>
    );
};
