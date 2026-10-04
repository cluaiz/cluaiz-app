import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
    Play, 
    Pause, 
    Volume2, 
    VolumeX, 
    Maximize, 
    Video as VideoIcon, 
    Loader2,
    AlertCircle
} from 'lucide-react';
import { resolveMediaUrl, resolveMediaUrlSync } from '../../utils/mediaResolver';

interface VideoPreviewProps {
    filePath: string;
    fileName: string;
    rootPath?: string;
    content?: string;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
    filePath,
    fileName,
    rootPath,
    content,
}) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const initialSyncUri = useMemo(() => {
        return resolveMediaUrlSync(rootPath, filePath, content);
    }, [rootPath, filePath, content]);

    const [src, setSrc] = useState<string>(initialSyncUri);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [duration, setDuration] = useState<number>(0);
    const [volume, setVolume] = useState<number>(1);
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(!initialSyncUri);
    const [hasError, setHasError] = useState<boolean>(false);
    const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);

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
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
            setIsPlaying(false);
        } else {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => setIsPlaying(true))
                    .catch((err) => {
                        console.warn('[VideoPreview] Playback failed:', err);
                        setIsPlaying(false);
                    });
            }
        }
    };

    const handleTimeUpdate = () => {
        if (!videoRef.current) return;
        setCurrentTime(videoRef.current.currentTime);
    };

    const handleCanPlay = () => {
        setIsLoading(false);
        setHasError(false);
        if (videoRef.current && (!duration || isNaN(duration))) {
            setDuration(videoRef.current.duration || 0);
            setVideoDimensions({
                width: videoRef.current.videoWidth,
                height: videoRef.current.videoHeight,
            });
        }
    };

    const handleLoadedMetadata = () => {
        if (!videoRef.current) return;
        setDuration(videoRef.current.duration || 0);
        setVideoDimensions({
            width: videoRef.current.videoWidth,
            height: videoRef.current.videoHeight,
        });
        setIsLoading(false);
        setHasError(false);
    };

    const handleVideoError = () => {
        setIsLoading(false);
        setHasError(true);
        setIsPlaying(false);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const targetTime = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.currentTime = targetTime;
            setCurrentTime(targetTime);
        }
    };

    const toggleMute = () => {
        if (!videoRef.current) return;
        videoRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        if (videoRef.current) {
            videoRef.current.volume = val;
            videoRef.current.muted = val === 0;
            setIsMuted(val === 0);
        }
    };

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    };



    const formatTime = (seconds: number): string => {
        if (isNaN(seconds) || !isFinite(seconds)) return '00:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div ref={containerRef} className="h-full w-full flex flex-col bg-[var(--bg-primary)] select-none font-sans overflow-hidden group">
            {/* Top Header */}
            <div className="h-10 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 flex items-center justify-between flex-shrink-0 z-10">
                <div className="flex items-center gap-2">
                    <VideoIcon className="w-4 h-4 text-[var(--accent-color)]" />
                    <span className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[200px]">{fileName}</span>
                    {videoDimensions && (
                        <span className="text-[11px] font-mono text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                            {videoDimensions.width} × {videoDimensions.height} px
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5" />
            </div>

            {/* Video Viewport */}
            <div className="flex-1 overflow-hidden flex items-center justify-center p-4 relative bg-[var(--bg-primary)]">
                {isLoading && !src && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)] bg-[var(--bg-primary)]/80 z-20">
                        <Loader2 className="w-7 h-7 animate-spin text-[var(--accent-color)]" />
                        <span className="text-xs font-mono">Streaming media bytes...</span>
                    </div>
                )}

                {hasError && (
                    <div className="flex flex-col items-center justify-center gap-2 text-amber-500 font-mono text-xs z-10">
                        <AlertCircle className="w-9 h-9 opacity-80" />
                        <span>Unable to decode video format</span>
                    </div>
                )}

                {src && !hasError && (
                    <video
                        ref={videoRef}
                        src={src}
                        preload="auto"
                        onClick={togglePlay}
                        onTimeUpdate={handleTimeUpdate}
                        onCanPlay={handleCanPlay}
                        onLoadedMetadata={handleLoadedMetadata}
                        onError={handleVideoError}
                        onEnded={() => setIsPlaying(false)}
                        className="max-w-full max-h-full rounded-lg shadow-2xl cursor-pointer"
                        playsInline
                    />
                )}
            </div>

            {/* Bottom Control Bar */}
            <div className="h-12 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 flex items-center gap-3 flex-shrink-0">
                <button
                    type="button"
                    onClick={togglePlay}
                    disabled={hasError}
                    className="p-2 rounded-lg bg-[var(--accent-color)]/10 hover:bg-[var(--accent-color)]/20 text-[var(--accent-color)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                </button>

                <span className="text-[11px] font-mono text-[var(--text-muted)] min-w-[85px]">
                    {formatTime(currentTime)} / {formatTime(duration)}
                </span>

                {/* Progress Bar */}
                <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 h-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-color)] transition-all"
                />

                {/* Volume Control */}
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
                        className="w-16 h-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-color)]"
                    />
                </div>

                {/* Fullscreen Button */}
                <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    title="Fullscreen"
                >
                    <Maximize className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
