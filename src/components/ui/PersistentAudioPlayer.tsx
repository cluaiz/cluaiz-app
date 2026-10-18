import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Loader2, X, Radio } from 'lucide-react';
import { motion } from 'framer-motion';
import { audioApi } from '../../api/engine/audio/audio.api';
import { speechTurns } from '../../services/audio/speechTurns';
import { toast } from './toast';
import {
    AudioPlayerPopover,
    getStoredTtsSettings,
    TtsSettings
} from './AudioControlSettingsModal';

/** Whole-message audio already made, for replay with seeking (message id → WAV) */
const fullAudioCache = new Map<string, { url: string; textLength: number }>();

/** A sentence ends at . ! ? । (or ; :) followed by space, or at a line break */
const SENTENCE_END = /[.!?।;:]+(?=\s|$)|\n+/g;

/** Markdown the voice should not read: code blocks, inline code marks, link targets, emphasis, horizontal rules, bullets. */
const speakable = (markdown: string): string =>
    markdown
        // Remove code blocks entirely
        .replace(/```[\s\S]*?```/g, ' ')
        // Remove inline code ticks
        .replace(/`([^`]*)`/g, '$1')
        // Remove link targets, keep text: [text](url) -> text
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        // Remove markdown headings: # Heading -> Heading
        .replace(/^\s{0,3}#{1,6}\s+/gm, '')
        // Remove markdown horizontal rules (---, ***, ___) so TTS never reads "minus minus minus"
        .replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, ' ')
        // Remove markdown table divider rows (e.g. |---|---|)
        .replace(/^[ \t]*\|?([ \t]*:?-+:?[ \t]*\|)+[ \t]*$/gm, ' ')
        // Remove markdown table cell pipes
        .replace(/\|/g, ' ')
        // Remove blockquote markers (> Quote)
        .replace(/^[ \t]*>\s*/gm, '')
        // Remove bullet markers at start of lines (* item, - item, + item)
        .replace(/^[ \t]*[-*+]\s+/gm, '')
        // Remove bold / italic formatting
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/[*_~]{1,3}(?=\S)|(?<=\S)[*_~]{1,3}/g, '')
        // Replace multiple dashes or em-dashes with a natural pause
        .replace(/-{2,}|[—–]/g, ', ')
        // Collapse whitespace
        .replace(/[ \t]{2,}/g, ' ')
        .trim();

export interface PersistentAudioDeckProps {
    messageId: string;
    text: string;
    isStreamingAi?: boolean;
    onClose?: () => void;
    /** Speak as soon as the deck opens (voice mode answer, or the user pressed the speaker); a
     * message speaking before stops */
    autoStart?: boolean;
    className?: string;
}

type Status = 'idle' | 'loading' | 'playing' | 'paused';

/**
 * Speaks a message. While the answer is still being written, each finished sentence is spoken as
 * soon as it is synthesized; a finished message is streamed sentence by sentence by the engine.
 * Only one message speaks at a time (speechTurns).
 */
export const PersistentAudioDeck: React.FC<PersistentAudioDeckProps> = ({
    messageId,
    text,
    isStreamingAi = false,
    onClose,
    autoStart = false,
    className = '',
}) => {
    const [ttsSettings, setTtsSettings] = useState<TtsSettings>(getStoredTtsSettings);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [status, setStatus] = useState<Status>('idle');
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const settingsRef = useRef(ttsSettings);
    settingsRef.current = ttsSettings;
    const textRef = useRef(text);
    textRef.current = text;
    const streamingRef = useRef(isStreamingAi);
    streamingRef.current = isStreamingAi;

    const partsRef = useRef<string[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const pausedRef = useRef(false);
    const producingRef = useRef(false); // audio is being made for this message
    const producedAllRef = useRef(false); // every part of the message has been made
    const liveRef = useRef(false); // following the answer as it is written
    const spokenUpToRef = useRef(0); // characters of the answer already sent to synthesis
    const pendingRef = useRef(0); // sentences being synthesized
    const chainRef = useRef<Promise<void>>(Promise.resolve());
    const abortRef = useRef<AbortController | null>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);

    const formatTime = (secs: number) => {
        if (!secs || isNaN(secs) || secs < 0) return '00:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const payload = (input: string) => {
        const s = settingsRef.current;
        return {
            input,
            model: s.selectedModel || undefined,
            voice: s.selectedVoice && s.selectedVoice !== 'default' ? s.selectedVoice : undefined,
            speed: s.playbackSpeed || 1.0,
        };
    };

    const clearParts = () => {
        partsRef.current.forEach((url) => URL.revokeObjectURL(url));
        partsRef.current = [];
    };

    /** Stops everything for this message and gives the turn to the next one. */
    const stopAll = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        audioRef.current?.pause();
        audioRef.current = null;
        clearParts();
        liveRef.current = false;
        producingRef.current = false;
        producedAllRef.current = false;
        pausedRef.current = false;
        setStatus('idle');
        setCurrentTime(0);
    }, []);

    const finish = () => {
        audioRef.current = null;
        producingRef.current = false;
        producedAllRef.current = false;
        liveRef.current = false;
        setStatus('idle');
        setCurrentTime(0);
        speechTurns.release(messageId);
    };

    const playFile = (url: string, ownsUrl: boolean) => {
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onloadedmetadata = () => isFinite(audio.duration) && setDuration(audio.duration);
        audio.ontimeupdate = () => {
            setCurrentTime(audio.currentTime);
            if (isFinite(audio.duration)) setDuration(audio.duration);
        };
        const next = () => {
            if (ownsUrl) URL.revokeObjectURL(url);
            if (audioRef.current === audio) audioRef.current = null;
            playNextPart();
        };
        audio.onended = next;
        audio.onerror = next;
        setStatus('playing');
        audio.play().catch(next);
    };

    /** Plays the next made part when it is this message's turn; finishes when all are played. */
    const playNextPart = () => {
        if (!speechTurns.isSpeaking(messageId) || pausedRef.current || audioRef.current) return;
        const url = partsRef.current.shift();
        if (url) {
            playFile(url, true);
            return;
        }
        const allMade = producedAllRef.current && pendingRef.current === 0 && !streamingRef.current;
        if (allMade) {
            finish();
        } else {
            setStatus('loading');
        }
    };

    const addPart = (blob: Blob) => {
        partsRef.current.push(URL.createObjectURL(blob));
        playNextPart();
    };

    /** Sends every finished sentence (all of the rest when `final`) to synthesis, in order. */
    const takeSentences = (final: boolean) => {
        const full = textRef.current;
        const rest = full.slice(spokenUpToRef.current);
        let cut = 0;
        if (final) {
            cut = rest.length;
        } else {
            for (const match of rest.matchAll(SENTENCE_END)) {
                const end = (match.index ?? 0) + match[0].length;
                // Never cut inside a code block
                if ((full.slice(0, spokenUpToRef.current + end).match(/```/g)?.length ?? 0) % 2 === 0) cut = end;
            }
        }
        if (cut === 0) {
            if (final) {
                producedAllRef.current = true;
                playNextPart();
            }
            return;
        }
        const chunk = speakable(rest.slice(0, cut));
        spokenUpToRef.current += cut;
        if (chunk.replace(/[^\p{L}\p{N}]/gu, '').length > 0) {
            pendingRef.current += 1;
            chainRef.current = chainRef.current
                .then(async () => {
                    if (!liveRef.current) return;
                    const blob = await audioApi.speech(payload(chunk));
                    if (liveRef.current) addPart(blob);
                })
                .catch((err) => {
                    // Say why once and stop, instead of waiting for audio that will not come
                    if (!liveRef.current) return;
                    toast.error(err?.message || 'Speech synthesis failed');
                    stopAll();
                    speechTurns.release(messageId);
                })
                .finally(() => {
                    pendingRef.current -= 1;
                    playNextPart();
                });
        }
        if (final) {
            producedAllRef.current = true;
            playNextPart();
        }
    };

    /** Follows the answer while it is written. */
    const startLive = () => {
        liveRef.current = true;
        producingRef.current = true;
        producedAllRef.current = false;
        spokenUpToRef.current = 0;
        takeSentences(!streamingRef.current);
    };

    /** A finished message: the engine streams it sentence by sentence (or the cached file replays). */
    const startFull = () => {
        const length = textRef.current.trim().length;
        const cached = fullAudioCache.get(messageId);
        if (cached && cached.textLength >= length) {
            producedAllRef.current = true;
            playFile(cached.url, false);
            return;
        }
        producingRef.current = true;
        producedAllRef.current = false;
        setStatus('loading');
        const controller = new AbortController();
        abortRef.current = controller;
        audioApi
            .speechStream(payload(speakable(textRef.current)), addPart, controller.signal)
            .then((whole) => {
                fullAudioCache.set(messageId, { url: URL.createObjectURL(whole), textLength: length });
                producedAllRef.current = true;
                playNextPart();
            })
            .catch((err: any) => {
                if (controller.signal.aborted) return;
                const msg = err?.message || 'Failed to synthesize speech';
                toast.error(msg.toLowerCase().includes('model') ? 'No TTS model available. Check the TTS settings.' : msg);
                stopAll();
                speechTurns.release(messageId);
            });
    };

    const turn = {
        id: messageId,
        start: () => {
            pausedRef.current = false;
            if (!producingRef.current && !producedAllRef.current) {
                if (streamingRef.current) startLive();
                else startFull();
            }
            if (audioRef.current) {
                setStatus('playing');
                audioRef.current.play().catch(() => playNextPart());
            } else {
                playNextPart();
            }
        },
        stop: stopAll,
    };

    const togglePlay = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (status === 'playing') {
            pausedRef.current = true;
            audioRef.current?.pause();
            setStatus('paused');
            return;
        }
        if (!text.trim()) return;
        // The user asked for this message: it takes over from any other
        speechTurns.request(turn);
    };

    // Opened to speak: an answer being written is spoken sentence by sentence as it grows
    useEffect(() => {
        if (!autoStart || (!text.trim() && !isStreamingAi)) return;
        if (isStreamingAi) startLive();
        speechTurns.request(turn);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Follow the answer as it grows; flush the rest when it is complete
    useEffect(() => {
        if (liveRef.current) takeSentences(!isStreamingAi);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, isStreamingAi]);

    // Leaving the message stops its speech
    useEffect(() => () => {
        stopAll();
        speechTurns.release(messageId);
    }, [messageId, stopAll]);

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        const audio = audioRef.current;
        const rect = progressBarRef.current?.getBoundingClientRect();
        if (!audio || !rect || !duration) return;
        const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        audio.currentTime = fraction * duration;
        setCurrentTime(audio.currentTime);
    };

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    const following = isStreamingAi && liveRef.current;
    const statusLabel =
        status === 'loading' ? 'Preparing speech…'
                : following && status === 'playing' ? 'Speaking while the answer is written…'
                    : null;

    return (
        <div
            className={`relative w-full max-w-full font-[family-name:var(--font-family)] select-none ${className}`}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsSettingsOpen(true);
            }}
        >
            <AudioPlayerPopover
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onSettingsChange={(newSettings) => setTtsSettings(newSettings)}
            />

            <div className="flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]/60 shadow-sm transition-all duration-150">
                <button
                    type="button"
                    onClick={togglePlay}
                    className="w-6 h-6 rounded-full flex items-center justify-center bg-[var(--accent-color)] text-[var(--accent-contrast)] hover:opacity-90 transition-transform active:scale-95 cursor-pointer flex-shrink-0"
                    title={status === 'playing' ? 'Pause' : 'Play'}
                >
                    {status === 'loading' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                    ) : status === 'playing' ? (
                        <Pause className="w-3 h-3 fill-current" />
                    ) : (
                        <Play className="w-3 h-3 fill-current ml-0.5" />
                    )}
                </button>

                {statusLabel ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex items-center gap-0.5 h-3.5">
                            {[0.4, 0.8, 1.0, 0.6, 0.3].map((scale, i) => (
                                <motion.span
                                    key={i}
                                    className="w-[2px] bg-[var(--accent-color)] rounded-full"
                                    animate={status === 'playing' ? { height: [`${4 * scale}px`, `${14 * scale}px`, `${4 * scale}px`] } : { height: '4px' }}
                                    transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                                />
                            ))}
                        </div>
                        <span className="text-[10px] font-semibold text-[var(--accent-color)] flex items-center gap-1 truncate">
                            <Radio className={`w-3 h-3 shrink-0 ${status === 'playing' ? 'animate-pulse' : 'text-[var(--text-muted)]'}`} />
                            {statusLabel}
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                            ref={progressBarRef}
                            onClick={handleSeek}
                            className="flex-1 h-1.5 bg-[var(--bg-tertiary)] hover:h-2 rounded-full cursor-pointer relative overflow-hidden transition-all"
                        >
                            <div
                                className="h-full bg-[var(--accent-color)] rounded-full transition-all duration-100"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <span className="text-[10px] font-mono font-medium text-[var(--text-muted)] whitespace-nowrap">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                    </div>
                )}

                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsSettingsOpen(true);
                        }}
                        className="px-1.5 py-0.5 text-[9.5px] font-semibold rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)]/30 transition-colors cursor-pointer"
                        title="Speech settings"
                    >
                        {ttsSettings.playbackSpeed}x
                    </button>
                    {onClose && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                stopAll();
                                speechTurns.release(messageId);
                                onClose();
                            }}
                            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                            title="Stop and hide"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export const PersistentAudioPlayer = PersistentAudioDeck;
export default PersistentAudioDeck;
