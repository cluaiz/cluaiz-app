import React, { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Mic, MicOff, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { VoicePill } from '../VoicePill/VoicePill';
import {
    AudioControlSettingsModal,
    getStoredMicSettings,
    MicSettings
} from './AudioControlSettingsModal';
import { useDictation } from '../../features/chat/hooks/useDictation';
import { speechTurns } from '../../services/audio/speechTurns';
import { useVoiceSessionStore } from '../../store/chat/useVoiceSessionStore';

export type VoiceMode = 'record_send' | 'live_interaction';

/** Voice mode: without any answer starting this long after a turn, listening resumes */
const NO_ANSWER_RESUME_MS = 30000;

export interface VoiceInputControlProps {
    disabled?: boolean;
    className?: string;
    /** The assistant is writing an answer in this chat */
    isAnswering?: boolean;
    /** Everything heard since the microphone started (shown in the input box) */
    onText?: (text: string) => void;
    /** Voice mode: the user finished a turn; send it */
    onTurnEnd?: (text: string) => void;
    /** Voice mode: the user spoke over the answer; stop it */
    onInterrupt?: () => void;
    onError?: (message: string) => void;
    onVoiceStateChange?: (isActive: boolean, mode: VoiceMode) => void;
    onVoiceFrequencyChange?: (frequency: number) => void;
}

/**
 * Microphone button. Record: words are typed while you speak, stop when done. Voice mode: a pause
 * sends the turn, the answer is spoken (MessageBubble), then the microphone listens again.
 */
export interface VoiceInputHandle {
    /** Stops the microphone and drops what is not typed yet (the user typed instead) */
    cancel: () => void;
}

export const VoiceInputControl = forwardRef<VoiceInputHandle, VoiceInputControlProps>(({
    disabled = false,
    className = '',
    isAnswering = false,
    onText,
    onTurnEnd,
    onInterrupt,
    onError,
    onVoiceStateChange,
    onVoiceFrequencyChange,
}, ref) => {
    const [micSettings, setMicSettings] = useState<MicSettings>(getStoredMicSettings);
    const mode = micSettings.mode;
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [liveFrequency, setLiveFrequency] = useState(0);
    const setVoiceSession = useVoiceSessionStore((s) => s.setActive);

    // Voice mode turn: after a turn is sent, wait for the answer to be written and said
    const awaitingAnswerRef = useRef(false);
    const sawAnswerRef = useRef(false);
    const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const dictation = useDictation(mode === 'live_interaction' ? 'voice' : 'record', {
        onText: (text) => onText?.(text),
        onTurnEnd: (text) => {
            awaitingAnswerRef.current = true;
            sawAnswerRef.current = false;
            dictation.pauseListening();
            if (fallbackRef.current) clearTimeout(fallbackRef.current);
            fallbackRef.current = setTimeout(() => {
                if (awaitingAnswerRef.current && !sawAnswerRef.current) resume();
            }, NO_ANSWER_RESUME_MS);
            onTurnEnd?.(text);
        },
        onInterrupt: () => {
            awaitingAnswerRef.current = false;
            speechTurns.stopAll();
            onInterrupt?.();
        },
        onLevel: (level) => {
            setLiveFrequency(level);
            onVoiceFrequencyChange?.(level);
        },
        onError: (message) => {
            onError?.(message);
            stopMic();
        },
    });

    const resume = () => {
        awaitingAnswerRef.current = false;
        if (fallbackRef.current) clearTimeout(fallbackRef.current);
        dictation.resumeListening();
    };

    // The answer has been written and said: listen for the next turn
    useEffect(() => {
        if (isAnswering) sawAnswerRef.current = true;
        const check = () => {
            if (awaitingAnswerRef.current && sawAnswerRef.current && !isAnswering && speechTurns.isIdle()) resume();
        };
        check();
        return speechTurns.subscribe(check);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAnswering]);

    useEffect(() => {
        onVoiceStateChange?.(dictation.active, mode);
        setVoiceSession(dictation.active && mode === 'live_interaction');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dictation.active, mode]);

    useEffect(() => () => {
        if (fallbackRef.current) clearTimeout(fallbackRef.current);
        setVoiceSession(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const stopMic = () => {
        awaitingAnswerRef.current = false;
        if (fallbackRef.current) clearTimeout(fallbackRef.current);
        dictation.stop();
        setLiveFrequency(0);
    };

    // The user typed in the box: the microphone stops at once and nothing heard is typed any more
    useImperativeHandle(ref, () => ({
        cancel: () => {
            awaitingAnswerRef.current = false;
            if (fallbackRef.current) clearTimeout(fallbackRef.current);
            dictation.cancel();
            setLiveFrequency(0);
        },
    }));

    const toggleVoiceState = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (disabled) return;
        if (dictation.active) stopMic();
        else void dictation.start();
    };

    const handleSettingsChange = (newSettings: MicSettings) => {
        // Switching mode ends the running session
        if (dictation.active && newSettings.mode !== mode) stopMic();
        setMicSettings(newSettings);
    };

    const isActive = dictation.active;

    // Icon brightens with the voice level
    const iconGlow = useMemo(() => {
        if (!isActive) return undefined;
        const blendPercent = Math.min(65, Math.round(liveFrequency * 70));
        const color = liveFrequency > 0.04
            ? `color-mix(in srgb, var(--accent-color) ${100 - blendPercent}%, #ffffff ${blendPercent}%)`
            : 'var(--accent-color)';
        const brightness = (1 + liveFrequency * 0.25).toFixed(2);
        const filter = liveFrequency > 0.08
            ? `drop-shadow(0 0 1.5px var(--accent-color)) brightness(${brightness})`
            : undefined;
        return { color, filter, transition: 'color 0.06s ease-out, filter 0.06s ease-out' };
    }, [isActive, liveFrequency]);

    // Capsule border glows with the voice level
    const capsuleStyle = useMemo(() => {
        if (!isActive) return undefined;
        if (liveFrequency < 0.04) {
            return {
                boxShadow: 'none',
                borderColor: 'var(--border-color)',
                transition: 'box-shadow 0.15s ease-out, border-color 0.15s ease-out'
            };
        }
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
        <div className={`relative flex items-center ${className}`}>
            {/* Record Mode: VoicePill Interactive Component (Single Dedicated Pill Control) */}
            <VoicePill
                size={32}
                accentColor="var(--accent-color)"
                iconColor="var(--text-muted)"
                background="var(--bg-tertiary)"
                shape="pill"
                mode="auto"
                waveform={true}
                showTime={true}
                slideToCancel={true}
                active={isActive}
                audioLevel={liveFrequency}
                reactive="mic"
                disabled={disabled}
                onStart={() => {
                    if (!dictation.active) void dictation.start();
                }}
                onStop={({ reason }) => {
                    if (reason === 'cancel') {
                        dictation.cancel();
                    } else {
                        stopMic();
                    }
                }}
                className="transition-all"
            />
        </div>
    );
});
VoiceInputControl.displayName = 'VoiceInputControl';
export default VoiceInputControl;
