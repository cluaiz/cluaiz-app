import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Loader2, X, Radio } from 'lucide-react';
import { motion } from 'framer-motion';
import { audioApi } from '../../api/engine/audio/audio.api';
import { speechTurns } from '../../services/audio/speechTurns';
import { useSpeechHighlightStore } from '../../store/chat/useSpeechHighlightStore';
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

interface QueuedAudioPart {
    url: string;
    ownsUrl: boolean;
    rawSentence: string;
    sentenceIndex: number;
    words: string[];
    wordWeights: number[];
    totalWeight: number;
}

function tokenizeSentenceWords(sentence: string): { words: string[]; wordWeights: number[]; totalWeight: number } {
    const rawTokens = sentence.trim().split(/\s+/).filter(Boolean);
    const words: string[] = [];
    const wordWeights: number[] = [];
    let total = 0;

    for (const t of rawTokens) {
        words.push(t);
        let w = Math.max(2, t.length);
        if (/[.,!?;:।]/.test(t)) {
            w += 2;
        }
        wordWeights.push(w);
        total += w;
    }

    return { words, wordWeights, totalWeight: Math.max(1, total) };
}

function calculateActiveWordIndex(
    progress: number,
    wordWeights: number[],
    totalWeight: number,
    wordCount: number
): number {
    if (wordCount <= 0) return 0;
    if (progress <= 0) return 0;
    if (progress >= 1) return wordCount - 1;

    const target = progress * totalWeight;
    let accumulated = 0;
    for (let i = 0; i < wordCount; i++) {
        accumulated += wordWeights[i];
        if (accumulated >= target) {
            return i;
        }
    }
    return wordCount - 1;
}

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
    const [error, setError] = useState<string | null>(null);

    const settingsRef = useRef(ttsSettings);
    settingsRef.current = ttsSettings;
    const textRef = useRef(text);
    textRef.current = text;
    const streamingRef = useRef(isStreamingAi);
    streamingRef.current = isStreamingAi;

    const cachedPartsRef = useRef<QueuedAudioPart[]>([]);
    const playbackIndexRef = useRef(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const currentPartRef = useRef<QueuedAudioPart | null>(null);
    const pausedRef = useRef(false);
    const producingRef = useRef(false); // audio is being made for this message
    const producedAllRef = useRef(false); // all text queued; pendingRef tracks unfinished synthesis
    const liveRef = useRef(false); // following the answer as it is written
    const spokenUpToRef = useRef(0); // characters of the answer already sent to synthesis
    const sentenceIndexRef = useRef(0); // counter for sentence indices
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
        cachedPartsRef.current.forEach((part) => {
            if (part.ownsUrl) URL.revokeObjectURL(part.url);
        });
        cachedPartsRef.current = [];
        playbackIndexRef.current = 0;
    };

    /** Stops everything for this message and gives the turn to the next one. */
    const stopAll = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        audioRef.current?.pause();
        audioRef.current = null;
        currentPartRef.current = null;
        clearParts();
        liveRef.current = false;
        producingRef.current = false;
        producedAllRef.current = false;
        pausedRef.current = false;
        sentenceIndexRef.current = 0;
        pendingRef.current = 0;
        chainRef.current = Promise.resolve();
        setStatus('idle');
        setCurrentTime(0);
        setDuration(0);
        setError(null);
        useSpeechHighlightStore.getState().clear(messageId);
    }, [messageId]);

    const fail = (cause: unknown) => {
        const message = cause instanceof Error ? cause.message : 'Speech playback failed';
        stopAll();
        setError(message);
        toast.error(message);
        speechTurns.release(messageId);
    };

    const resumeAudio = (audio: HTMLAudioElement) => {
        setStatus('playing');
        useSpeechHighlightStore.getState().setPlaying(true);
        audio.play().catch((cause) => {
            if (audioRef.current === audio && !pausedRef.current && speechTurns.isSpeaking(messageId)) {
                fail(cause);
            }
        });
    };

    const finish = () => {
        audioRef.current = null;
        currentPartRef.current = null;
        playbackIndexRef.current = 0;
        producingRef.current = false;
        liveRef.current = false;
        pausedRef.current = true;
        setStatus('paused');
        setCurrentTime(0);
        useSpeechHighlightStore.getState().clear(messageId);
        speechTurns.release(messageId);
    };

    const syncProgress = useCallback(() => {
        const audio = audioRef.current;
        const part = currentPartRef.current;
        if (!audio || !part) return;

        const cur = audio.currentTime;
        const dur = audio.duration;
        setCurrentTime(cur);

        if (isFinite(dur) && dur > 0 && part.words.length > 0) {
            setDuration(dur);
            const progress = Math.min(1, Math.max(0, cur / dur));
            const wordIdx = calculateActiveWordIndex(progress, part.wordWeights, part.totalWeight, part.words.length);
            useSpeechHighlightStore.getState().updateWordProgress(wordIdx, part.words[wordIdx]);
        }
    }, []);

    const playFile = (part: QueuedAudioPart, index: number) => {
        const audio = new Audio(part.url);
        audioRef.current = audio;
        currentPartRef.current = part;
        playbackIndexRef.current = index;

        useSpeechHighlightStore.getState().setActiveSentence({
            messageId,
            sentenceText: part.rawSentence,
            sentenceIndex: part.sentenceIndex,
        });

        audio.onloadedmetadata = () => {
            if (audioRef.current !== audio) return;
            if (isFinite(audio.duration)) setDuration(audio.duration);
            syncProgress();
        };

        audio.ontimeupdate = () => {
            if (audioRef.current === audio) syncProgress();
        };

        const next = () => {
            if (audioRef.current !== audio) return;
            audioRef.current = null;
            currentPartRef.current = null;
            playbackIndexRef.current = index + 1;
            playNextPart();
        };

        audio.onended = next;
        audio.onerror = () => {
            if (audioRef.current === audio) {
                fail(new Error(audio.error?.message || 'Audio could not be played.'));
            }
        };
        resumeAudio(audio);
    };

    /** Plays the next made part when it is this message's turn; finishes when all are played. */
    const playNextPart = () => {
        if (!speechTurns.isSpeaking(messageId) || pausedRef.current || audioRef.current) return;
        const nextIdx = playbackIndexRef.current;
        if (nextIdx < cachedPartsRef.current.length) {
            const part = cachedPartsRef.current[nextIdx];
            playFile(part, nextIdx);
            return;
        }
        const allMade = producedAllRef.current && pendingRef.current === 0 && !streamingRef.current;
        if (allMade) {
            finish();
        } else {
            setStatus('loading');
        }
    };

    const addPart = (
        blob: Blob,
        rawSentence: string,
        sentenceIndex: number,
        words: string[],
        wordWeights: number[],
        totalWeight: number
    ) => {
        cachedPartsRef.current.push({
            url: URL.createObjectURL(blob),
            ownsUrl: true,
            rawSentence,
            sentenceIndex,
            words,
            wordWeights,
            totalWeight,
        });
        playNextPart();
    };

    /** Sends finished sentences to synthesis, one distinct sentence per queue part. */
    const takeSentences = (final: boolean) => {
        const run = abortRef.current;
        if (!run || run.signal.aborted) return;
        const isCurrent = () => abortRef.current === run && !run.signal.aborted;
        while (true) {
            const full = textRef.current;
            const rest = full.slice(spokenUpToRef.current);
            if (!rest.trim()) {
                if (final) {
                    producedAllRef.current = true;
                    playNextPart();
                }
                break;
            }

            let cut = 0;
            // Find the first sentence ending punctuation or newline
            const match = rest.match(/[.!?।;:]+(?=\s|$)|\n+/);
            if (match && match.index !== undefined) {
                const candidateEnd = match.index + match[0].length;
                // Guard: check if candidate is inside an unclosed code block
                const prefix = full.slice(0, spokenUpToRef.current + candidateEnd);
                const codeTicks = (prefix.match(/```/g)?.length ?? 0);
                if (codeTicks % 2 === 0) {
                    cut = candidateEnd;
                } else {
                    // Inside code block, find closing ticks
                    const closing = rest.indexOf('```', candidateEnd);
                    if (closing !== -1) {
                        cut = closing + 3;
                    } else if (!final) {
                        break; // Wait for code block to finish streaming
                    } else {
                        cut = rest.length;
                    }
                }
            } else if (final) {
                // End of message, take remainder
                cut = rest.length;
            } else {
                // Incomplete sentence while streaming, wait for more tokens
                break;
            }

            if (cut === 0) break;

            const rawChunk = rest.slice(0, cut);
            const chunk = speakable(rawChunk);
            spokenUpToRef.current += cut;

            if (chunk.replace(/[^\p{L}\p{N}]/gu, '').length > 0) {
                const currentSentenceIndex = sentenceIndexRef.current++;
                const { words, wordWeights, totalWeight } = tokenizeSentenceWords(rawChunk);
                pendingRef.current += 1;
                chainRef.current = chainRef.current
                    .then(async () => {
                        if (!isCurrent()) return;
                        const blob = await audioApi.speech(payload(chunk), run.signal);
                        if (isCurrent()) {
                            addPart(blob, rawChunk, currentSentenceIndex, words, wordWeights, totalWeight);
                        }
                    })
                    .catch((err) => {
                        if (isCurrent()) fail(err);
                    })
                    .finally(() => {
                        if (!isCurrent()) return;
                        pendingRef.current -= 1;
                        if (producedAllRef.current && pendingRef.current === 0) producingRef.current = false;
                        playNextPart();
                    });
            }
        }
        if (final) {
            producedAllRef.current = true;
            // End of input is not cancellation: queued requests still need to run.
            if (pendingRef.current === 0) producingRef.current = false;
            playNextPart();
        }
    };

    /** Follows the answer while it is written. */
    const startLive = () => {
        if (producingRef.current) return;
        abortRef.current = new AbortController();
        setError(null);
        liveRef.current = true;
        producingRef.current = true;
        producedAllRef.current = false;
        spokenUpToRef.current = 0;
        sentenceIndexRef.current = 0;
        playbackIndexRef.current = 0;
        takeSentences(!streamingRef.current);
    };

    /** A finished message: synthesize queued sentences with live word tracking. */
    const startFull = () => {
        // If already completely synthesized and cached: REPLAY INSTANTLY!
        if (cachedPartsRef.current.length > 0 && producedAllRef.current) {
            playbackIndexRef.current = 0;
            playNextPart();
            return;
        }
        if (producingRef.current) return;
        abortRef.current = new AbortController();
        setError(null);
        producingRef.current = true;
        producedAllRef.current = false;
        spokenUpToRef.current = 0;
        sentenceIndexRef.current = 0;
        playbackIndexRef.current = 0;
        setStatus('loading');
        takeSentences(true);
    };

    const turn = {
        id: messageId,
        start: () => {
            pausedRef.current = false;

            // 1. Instant replay if all audio already cached in memory
            if (cachedPartsRef.current.length > 0 && producedAllRef.current) {
                if (audioRef.current) {
                    resumeAudio(audioRef.current);
                } else {
                    if (playbackIndexRef.current >= cachedPartsRef.current.length) {
                        playbackIndexRef.current = 0;
                    }
                    playNextPart();
                }
                return;
            }

            // 2. Synthesize if not already started
            if (!producingRef.current && !producedAllRef.current) {
                if (streamingRef.current) startLive();
                else startFull();
            }

            if (audioRef.current) {
                resumeAudio(audioRef.current);
            } else {
                playNextPart();
            }
        },
        stop: () => {
            pausedRef.current = true;
            audioRef.current?.pause();
            setStatus('paused');
            useSpeechHighlightStore.getState().setPlaying(false);
        },
    };

    const togglePlay = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (status === 'playing') {
            pausedRef.current = true;
            audioRef.current?.pause();
            setStatus('paused');
            useSpeechHighlightStore.getState().setPlaying(false);
            return;
        }
        if (!text.trim()) return;

        // If audio is already completely cached, replay instantly:
        if (cachedPartsRef.current.length > 0 && producedAllRef.current) {
            pausedRef.current = false;
            speechTurns.request(turn);
            return;
        }

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
        syncProgress();
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
            {error && <p role="alert" className="mt-1 text-xs text-[var(--text-primary)]">{error} Press Play to retry.</p>}
        </div>
    );
};

export const PersistentAudioPlayer = PersistentAudioDeck;
export default PersistentAudioDeck;
