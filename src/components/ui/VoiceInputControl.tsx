import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, ChevronDown, Check, AudioLines } from 'lucide-react';
import { motion } from 'framer-motion';

export type VoiceMode = 'record_send' | 'live_interaction';

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
    const [mode, setMode] = useState<VoiceMode>('record_send');
    const [isActive, setIsActive] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [liveFrequency, setLiveFrequency] = useState(0);

    const menuRef = useRef<HTMLDivElement>(null);
    const animRef = useRef<number | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);

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
            // Direct request in click gesture
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            const audioCtx = new AudioCtx();
            audioCtxRef.current = audioCtx;

            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            analyser.smoothingTimeConstant = 0.55;

            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            setIsActive(true);
            onVoiceStateChange?.(true, mode);

            const updateFrequency = () => {
                analyser.getByteFrequencyData(dataArray);

                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;

                // Exact subtle smooth sensitivity curve from old-cluaiz voice_input.js
                const rawNorm = Math.min(1, Math.max(0, (average - 12) / 70));
                const norm = Math.pow(rawNorm, 1.8);

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
                className={`flex items-center gap-[2px] h-[2rem] sm:h-[2.25rem] px-2 rounded-full transition-all duration-150 ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                    } ${isActive
                        ? 'bg-[var(--bg-secondary)] text-[var(--accent-color)]'
                        : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
                    }`}
            >
                {/* Mode Icon:
                    - In Record mode: Idle shows <Mic />, Active shows <MicOff /> (cut/slash icon)
                    - In Voice Mode: Animated 5 vertical sound bars responding to voice frequency
                */}
                <button
                    type="button"
                    onClick={toggleVoiceState}
                    disabled={disabled}
                    className="flex items-center justify-center p-0.5 rounded-full hover:text-[var(--accent-color)] transition-colors cursor-pointer"
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
                        <Mic className="w-4 sm:w-4.5 h-4 sm:h-4.5 text-[var(--accent-color)]" />
                    ) : (
                        <MicOff className="w-4 sm:w-4.5 h-4 sm:h-4.5 text-[var(--text-muted)]" />
                    )}
                </button>

                {/* Dropdown Chevron Arrow: 1-2px adjacent */}
                <button
                    type="button"
                    onClick={toggleMenu}
                    disabled={disabled}
                    className="flex items-center justify-center p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    title="Change voice mode"
                >
                    <ChevronDown
                        className={`w-3 h-3 transition-transform duration-150 ${isMenuOpen ? 'rotate-180 text-[var(--accent-color)]' : ''
                            }`}
                    />
                </button>
            </div>
        </div>
    );
};

export default VoiceInputControl;
