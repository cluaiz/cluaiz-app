import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Mic, MicOff, ChevronDown, Check, AudioLines } from 'lucide-react';
import { motion } from 'framer-motion';

export type VoiceMode = 'record_send' | 'live_interaction';

const VOICE_MODE_STORAGE_KEY = 'cluaiz_voice_mode';

const getStoredVoiceMode = (): VoiceMode => {
    try {
        const saved = localStorage.getItem(VOICE_MODE_STORAGE_KEY);
        if (saved === 'record_send' || saved === 'live_interaction') {
            return saved;
        }
    } catch { }
    return 'record_send';
};

export interface VoiceInputControlProps {
    disabled?: boolean;
    className?: string;
    onVoiceStateChange?: (isActive: boolean, mode: VoiceMode) => void;
    onVoiceFrequencyChange?: (frequency: number) => void;
}

export const VoiceInputControl: React.FC<VoiceInputControlProps> = ({
    disabled = false,
    className = '',
    onVoiceStateChange,
    onVoiceFrequencyChange,
}) => {
    const [mode, setMode] = useState<VoiceMode>(getStoredVoiceMode);
    const [isActive, setIsActive] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [liveFrequency, setLiveFrequency] = useState(0);

    const menuRef = useRef<HTMLDivElement>(null);
    const animRef = useRef<number | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);

    // Notify initial persisted mode to parent on mount
    useEffect(() => {
        onVoiceStateChange?.(false, mode);
    }, []);

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMenuOpen]);

    const stopMicrophone = useCallback(() => {
        setIsActive(false);
        setLiveFrequency(0);
        onVoiceStateChange?.(false, mode);
        onVoiceFrequencyChange?.(0);

        if (animRef.current) {
            cancelAnimationFrame(animRef.current);
            animRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (audioCtxRef.current) {
            try {
                audioCtxRef.current.close();
            } catch { }
            audioCtxRef.current = null;
        }
    }, [mode, onVoiceFrequencyChange, onVoiceStateChange]);

    const startMicrophone = useCallback(async () => {
        try {
            // Direct request with hardware noise cancellation enabled to reject ambient noise
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            });
            mediaStreamRef.current = stream;

            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            const audioCtx = new AudioCtx();
            audioCtxRef.current = audioCtx;

            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            analyser.smoothingTimeConstant = 0.80;

            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            setIsActive(true);
            onVoiceStateChange?.(true, mode);

            const updateFrequency = () => {
                analyser.getByteFrequencyData(dataArray);

                let sum = 0;
                // Focus on human vocal spectrum (bins 1 to 24), ignoring low rumble/electrical DC offset (bin 0)
                const startBin = 1;
                const endBin = Math.min(dataArray.length, 24);
                for (let i = startBin; i < endBin; i++) {
                    sum += dataArray[i];
                }
                const average = sum / (endBin - startBin);

                // Balanced noise gate: completely reject ambient sounds below threshold 20, natural curve
                const rawNorm = Math.min(1, Math.max(0, (average - 20) / 80));
                const norm = Math.pow(rawNorm, 2.0);

                setLiveFrequency(norm);
                onVoiceFrequencyChange?.(norm);
                animRef.current = requestAnimationFrame(updateFrequency);
            };

            updateFrequency();
        } catch (err) {
            console.warn('Microphone access failed or permission denied:', err);
            stopMicrophone();
        }
    }, [mode, onVoiceFrequencyChange, onVoiceStateChange, stopMicrophone]);

    // Cleanup on component unmount
    useEffect(() => {
        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
            if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
            if (audioCtxRef.current) {
                try { audioCtxRef.current.close(); } catch { }
            }
        };
    }, []);

    const toggleVoiceState = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (disabled) return;
        if (isActive) {
            stopMicrophone();
        } else {
            startMicrophone();
        }
    };

    const selectMode = (newMode: VoiceMode, e: React.MouseEvent) => {
        e.stopPropagation();
        setMode(newMode);
        try {
            localStorage.setItem(VOICE_MODE_STORAGE_KEY, newMode);
        } catch { }
        setIsMenuOpen(false);
        if (isActive) {
            onVoiceStateChange?.(isActive, newMode);
        }
    };

    const toggleMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (disabled) return;
        setIsMenuOpen(prev => !prev);
    };

    // [P2] Dynamic frequency brightness & luminous aura for icons (tight, no outer cloud)
    const iconGlow = useMemo(() => {
        if (!isActive) return undefined;
        // As liveFrequency rises (0 to 1), blend towards bright luminous white/electric accent
        const blendPercent = Math.min(65, Math.round(liveFrequency * 70));
        const color = liveFrequency > 0.04
            ? `color-mix(in srgb, var(--accent-color) ${100 - blendPercent}%, #ffffff ${blendPercent}%)`
            : 'var(--accent-color)';
        const brightness = (1 + liveFrequency * 0.25).toFixed(2);
        const filter = liveFrequency > 0.08
            ? `drop-shadow(0 0 1.5px var(--accent-color)) brightness(${brightness})`
            : undefined;

        return {
            color,
            filter,
            transition: 'color 0.06s ease-out, filter 0.06s ease-out'
        };
    }, [isActive, liveFrequency]);

    // [P1] Capsule outer boundary glow & dynamic frequency-reactive border
    const capsuleStyle = useMemo(() => {
        if (!isActive) return undefined;
        // When quiet / idle (no voice sound), keep it completely dim with zero glow
        if (liveFrequency < 0.04) {
            return {
                boxShadow: 'none',
                borderColor: 'var(--border-color)',
                transition: 'box-shadow 0.15s ease-out, border-color 0.15s ease-out'
            };
        }
        // As voice sound comes in (liveFrequency >= 0.04), glow lights up dynamically
        const normFreq = Math.min(1, (liveFrequency - 0.04) / 0.96);
        const blur = (3 + normFreq * 3.5).toFixed(1);
        const shadowAlpha = (0.35 + normFreq * 0.35).toFixed(2);
        const borderAlpha = (0.35 + normFreq * 0.50).toFixed(2);
        return {
            boxShadow: `0 0 ${blur}px rgba(var(--accent-color-rgb, 255, 255, 255), ${shadowAlpha})`,
            borderColor: `rgba(var(--accent-color-rgb, 255, 255, 255), ${borderAlpha})`,
            transition: 'box-shadow 0.08s ease-out, border-color 0.08s ease-out'
        };
    }, [isActive, liveFrequency]);

    return (
        <div className={`relative flex items-center ${className}`} ref={menuRef}>
            {/* Tiny sleek dropdown menu */}
            {isMenuOpen && (
                <div
                    className="absolute bottom-full right-0 mb-2 w-36 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-xl p-1 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
                    style={{ borderStyle: 'var(--border-style)' }}
                >
                    {/* Option 1: Record Mode */}
                    <button
                        type="button"
                        onClick={(e) => selectMode('record_send', e)}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${mode === 'record_send'
                            ? 'bg-[var(--bg-tertiary)] text-[var(--accent-color)] font-semibold'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <Mic className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Record</span>
                        </div>
                        {mode === 'record_send' && <Check className="w-3 h-3 flex-shrink-0" />}
                    </button>

                    {/* Option 2: Voice Mode */}
                    <button
                        type="button"
                        onClick={(e) => selectMode('live_interaction', e)}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${mode === 'live_interaction'
                            ? 'bg-[var(--bg-tertiary)] text-[var(--accent-color)] font-semibold'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <AudioLines className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Voice Mode</span>
                        </div>
                        {mode === 'live_interaction' && <Check className="w-3 h-3 flex-shrink-0" />}
                    </button>
                </div>
            )}

            {/* Compact Capsule with 1-2px gap between icon and chevron */}
            <div
                className={`flex items-center gap-[2px] h-[2rem] sm:h-[2.25rem] px-2 rounded-full border border-transparent transition-all duration-150 ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                    } ${isActive
                        ? 'bg-[var(--bg-secondary)]'
                        : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                style={capsuleStyle}
            >
                {/* Mode Icon:
                    - In Record mode: Idle shows <MicOff />, Active shows <Mic /> with bright dynamic frequency glow
                    - In Voice Mode: Animated 5 vertical sound bars responding to voice frequency
                */}
                <button
                    type="button"
                    onClick={toggleVoiceState}
                    disabled={disabled}
                    className="flex items-center justify-center p-0.5 rounded-full transition-colors cursor-pointer"
                    style={iconGlow}
                    title={
                        isActive
                            ? 'Stop voice'
                            : mode === 'live_interaction'
                                ? 'Start Voice Mode'
                                : 'Start Recording'
                    }
                >
                    {mode === 'live_interaction' ? (
                        <div className="flex items-center gap-[1.5px] h-4.5 w-4.5 justify-center">
                            <motion.span
                                className="w-[1.8px] bg-current rounded-full"
                                animate={{ height: isActive ? `${4 + liveFrequency * 10}px` : '4px' }}
                                transition={{ duration: 0.05 }}
                            />
                            <motion.span
                                className="w-[1.8px] bg-current rounded-full"
                                animate={{ height: isActive ? `${7 + liveFrequency * 12}px` : '10px' }}
                                transition={{ duration: 0.05 }}
                            />
                            <motion.span
                                className="w-[1.8px] bg-current rounded-full"
                                animate={{ height: isActive ? `${9 + liveFrequency * 14}px` : '16px' }}
                                transition={{ duration: 0.05 }}
                            />
                            <motion.span
                                className="w-[1.8px] bg-current rounded-full"
                                animate={{ height: isActive ? `${6 + liveFrequency * 11}px` : '8px' }}
                                transition={{ duration: 0.05 }}
                            />
                            <motion.span
                                className="w-[1.8px] bg-current rounded-full"
                                animate={{ height: isActive ? `${3 + liveFrequency * 8}px` : '4px' }}
                                transition={{ duration: 0.05 }}
                            />
                        </div>
                    ) : isActive ? (
                        <Mic className="w-4 sm:w-4.5 h-4 sm:h-4.5" />
                    ) : (
                        <MicOff className="w-4 sm:w-4.5 h-4 sm:h-4.5 text-[var(--text-muted)]" />
                    )}
                </button>

                {/* Dropdown Chevron Arrow: 1-2px adjacent */}
                <button
                    type="button"
                    onClick={toggleMenu}
                    disabled={disabled}
                    className="flex items-center justify-center p-0.5 transition-colors cursor-pointer"
                    style={iconGlow}
                    title="Change voice mode"
                >
                    <ChevronDown
                        className={`w-3 h-3 transition-transform duration-150 ${isMenuOpen ? 'rotate-180' : ''}`}
                    />
                </button>
            </div>
        </div>
    );
};

export default VoiceInputControl;
