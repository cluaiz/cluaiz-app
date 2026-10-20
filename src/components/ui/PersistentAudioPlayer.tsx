import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { PlayIcon, PauseIcon } from '@animateicons/react/lucide';
import { audioApi } from '../../api/engine/audio/audio.api';
import { speechTurns } from '../../services/audio/speechTurns';
import { useSpeechHighlightStore } from '../../store/chat/useSpeechHighlightStore';
import { toast } from './toast';
import {
    getStoredTtsSettings,
    saveStoredTtsSettings,
    TtsSettings
} from './AudioControlSettingsModal';

const SPEED_STEPS = [0.75, 1.0, 1.25, 1.5];


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
        // Remove bold / italic formatting without destroying snake_case identifiers like execute_code
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/[*~]{1,3}(?=\S)|(?<=\S)[*~]{1,3}/g, '')
        .replace(/(?<=^|\s)_(?=\S)(.*?)(?<=\S)_(?=\s|$|[.,!?;:।])/g, '$1')
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



/**
 * Dynamic speech frequency waveform bars (58 dense bars).
 * Organic vocal profile with natural speech harmonic heights (5px to 26px).
 */
const DENSE_WAVE_BARS = [
    6, 10, 14, 18, 12, 16, 22, 17, 23, 14,
    19, 25, 18, 11, 16, 22, 19, 14, 22, 26,
    19, 15, 23, 25, 18, 13, 20, 26, 21, 15,
    23, 17, 12, 19, 25, 18, 13, 21, 19, 15,
    23, 18, 12, 16, 22, 16, 19, 14, 18, 12,
    16, 10, 14, 18, 13, 9, 7, 5,
];

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
    const [status, setStatus] = useState<Status>('idle');
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [cumulativeElapsed, setCumulativeElapsed] = useState(0);
    const [totalSynthesizedDuration, setTotalSynthesizedDuration] = useState(0);
    const [isLiveStream, setIsLiveStream] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const [hoverFraction, setHoverFraction] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const waveformRef = useRef<HTMLDivElement>(null);
    const completedDurationRef = useRef(0);
    const partDurationsRef = useRef<number[]>([]);

    const [freqLevels, setFreqLevels] = useState<number[]>(() => new Array(DENSE_WAVE_BARS.length).fill(0));
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animFrameRef = useRef<number | null>(null);

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
            voice: s.voiceMode === 'reference_source' && s.referenceSource?.trim() ? s.referenceSource.trim() : (s.selectedVoice && s.selectedVoice !== 'default' ? s.selectedVoice : undefined),
            language: s.selectedLanguage && s.selectedLanguage !== 'auto' ? s.selectedLanguage : undefined,
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
        completedDurationRef.current = 0;
        partDurationsRef.current = [];
        setCumulativeElapsed(0);
        setTotalSynthesizedDuration(0);
        setIsLiveStream(true);
        setStatus('idle');
        setCurrentTime(0);
        setDuration(0);
        setError(null);
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'none';
        }
        setFreqLevels(new Array(DENSE_WAVE_BARS.length).fill(0));
        useSpeechHighlightStore.getState().clear(messageId);
    }, [messageId]);

    const fail = (cause: unknown) => {
        const message = cause instanceof Error ? cause.message : 'Speech playback failed';
        stopAll();
        setError(message);
        toast.error(message);
        speechTurns.release(messageId);
    };

    const connectAnalyser = useCallback((audio: HTMLAudioElement) => {
        try {
            if (!audioCtxRef.current) {
                const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioCtx) {
                    audioCtxRef.current = new AudioCtx();
                    const analyser = audioCtxRef.current.createAnalyser();
                    analyser.fftSize = 128;
                    analyser.smoothingTimeConstant = 0.65;
                    analyser.minDecibels = -80;
                    analyser.maxDecibels = -25;
                    analyserRef.current = analyser;
                    analyser.connect(audioCtxRef.current.destination);
                }
            }
            if (audioCtxRef.current && analyserRef.current) {
                if (audioCtxRef.current.state === 'suspended') {
                    audioCtxRef.current.resume().catch(() => {});
                }
                const source = audioCtxRef.current.createMediaElementSource(audio);
                source.connect(analyserRef.current);
            }
        } catch {
            // Gracefully ignore if source is already connected
        }
    }, []);

    const resumeAudio = (audio: HTMLAudioElement) => {
        pausedRef.current = false;
        setStatus('playing');
        audio.playbackRate = settingsRef.current.playbackSpeed || 1.0;
        useSpeechHighlightStore.getState().setPlaying(true);
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
        }
        connectAnalyser(audio);
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
        completedDurationRef.current = 0;
        setCumulativeElapsed(0);
        setStatus('paused');
        setCurrentTime(0);
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'none';
        }
        useSpeechHighlightStore.getState().clear(messageId);
        speechTurns.release(messageId);
    };

    useEffect(() => {
        if (status !== 'playing') {
            useSpeechHighlightStore.getState().setAudioLevel(0);
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
                animFrameRef.current = null;
            }
            return;
        }

        const analyser = analyserRef.current;
        const binCount = analyser ? analyser.frequencyBinCount : 64;
        const dataArray = new Uint8Array(binCount);
        const barCount = DENSE_WAVE_BARS.length;

        const updateFrequencies = () => {
            let hasSignal = false;
            if (analyser) {
                analyser.getByteFrequencyData(dataArray);
                for (let j = 0; j < binCount; j++) {
                    if (dataArray[j] > 4) {
                        hasSignal = true;
                        break;
                    }
                }
            }

            if (hasSignal && analyser) {
                const newLevels = new Array(barCount);
                // Speech formants reside primarily in bins 0-16 (up to ~6 kHz)
                const speechBins = Math.min(binCount, 16);
                let totalSpeechPower = 0;
                for (let j = 0; j < speechBins; j++) {
                    totalSpeechPower += dataArray[j];
                }
                const rawAvg = totalSpeechPower / (speechBins * 255);
                // Dynamic voice gate: clean drop-off to 0 during silence / pauses between words
                const voiceGate = Math.max(0, (rawAvg - 0.05) / 0.95);
                useSpeechHighlightStore.getState().setAudioLevel(voiceGate);

                for (let i = 0; i < barCount; i++) {
                    const ratio = i / (barCount - 1); // 0.0 (left) to 1.0 (right)
                    // Map bars across speech formants so all 58 bars are actively engaged
                    const targetBin = Math.min(speechBins - 1, Math.round(Math.pow(ratio, 0.9) * (speechBins - 1)));
                    
                    // Subtract noise floor so quiet pauses between syllables drop cleanly to 0
                    const rawVal = Math.max(0, (dataArray[targetBin] - 15) / 240);

                    // Speech formant pre-emphasis boost: higher speech harmonics have lower raw energy
                    const formantBoost = 1.0 + Math.pow(ratio, 0.75) * 1.5;
                    const barFreq = Math.min(1.0, rawVal * formantBoost);

                    // Tone and rhythm modulation: ensures bars across the spectrum follow voice inflection without false floor
                    const barProfile = DENSE_WAVE_BARS[i] / 24;
                    const toneComponent = voiceGate * (0.3 + 0.7 * barProfile);

                    // Directly match voice: jumps on words, drops down to 0 on pauses
                    const level = Math.max(barFreq, toneComponent * 0.85);
                    newLevels[i] = Math.max(0, Math.min(1.0, level));
                }
                setFreqLevels(newLevels);
            } else {
                // Organic vocal frequency envelope modulation (propagating strictly Left to Right)
                const t = performance.now() * 0.007;
                const newLevels = new Array(barCount);
                for (let i = 0; i < barCount; i++) {
                    const wave = Math.sin(t * 1.8 - i * 0.32) * 0.35 + Math.cos(t * 2.4 - i * 0.22) * 0.25 + 0.35;
                    newLevels[i] = Math.max(0.06, Math.min(0.95, wave));
                }
                setFreqLevels(newLevels);
                useSpeechHighlightStore.getState().setAudioLevel(0.25);
            }

            // 60fps real-time word highlight sync (eliminates 250ms ontimeupdate lag and word skipping)
            if (status === 'playing' && audioRef.current && !pausedRef.current) {
                const audio = audioRef.current;
                const part = currentPartRef.current;
                if (audio && part && isFinite(audio.duration) && audio.duration > 0 && part.words.length > 0) {
                    const cur = audio.currentTime;
                    const dur = audio.duration;
                    const leadIn = Math.min(0.06, dur * 0.04);
                    const leadOut = Math.min(0.10, dur * 0.05);
                    const effectiveDur = Math.max(0.05, dur - leadIn - leadOut);
                    const effectiveCur = Math.max(0, Math.min(effectiveDur, cur - leadIn));
                    const progress = effectiveCur / effectiveDur;
                    const wordIdx = calculateActiveWordIndex(progress, part.wordWeights, part.totalWeight, part.words.length);
                    useSpeechHighlightStore.getState().updateWordProgress(wordIdx, part.words[wordIdx]);
                }
            }

            animFrameRef.current = requestAnimationFrame(updateFrequencies);
        };

        animFrameRef.current = requestAnimationFrame(updateFrequencies);

        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
                animFrameRef.current = null;
            }
        };
    }, [status]);

    const syncProgress = useCallback(() => {
        const audio = audioRef.current;
        const part = currentPartRef.current;
        if (!audio || !part) return;

        const cur = audio.currentTime;
        const dur = audio.duration;
        setCurrentTime(cur);
        setCumulativeElapsed(completedDurationRef.current + cur);

        if (isFinite(dur) && dur > 0 && part.words.length > 0) {
            setDuration(dur);
            const leadIn = Math.min(0.06, dur * 0.04);
            const leadOut = Math.min(0.10, dur * 0.05);
            const effectiveDur = Math.max(0.05, dur - leadIn - leadOut);
            const effectiveCur = Math.max(0, Math.min(effectiveDur, cur - leadIn));
            const progress = effectiveCur / effectiveDur;
            const wordIdx = calculateActiveWordIndex(progress, part.wordWeights, part.totalWeight, part.words.length);
            useSpeechHighlightStore.getState().updateWordProgress(wordIdx, part.words[wordIdx]);
        }
    }, []);

    const checkIfAllDone = useCallback(() => {
        if (
            producedAllRef.current &&
            pendingRef.current === 0 &&
            !streamingRef.current
        ) {
            const count = cachedPartsRef.current.length;
            if (count === 0) return;
            let allKnown = true;
            let sum = 0;
            for (let i = 0; i < count; i++) {
                const d = partDurationsRef.current[i];
                if (d && d > 0) {
                    sum += d;
                } else {
                    allKnown = false;
                    break;
                }
            }
            if (allKnown && sum > 0) {
                setTotalSynthesizedDuration(sum);
                setIsLiveStream(false);
            }
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
            if (isFinite(audio.duration) && audio.duration > 0) {
                partDurationsRef.current[index] = audio.duration;
                setDuration(audio.duration);
                checkIfAllDone();
            }
            syncProgress();
        };

        audio.ontimeupdate = () => {
            if (audioRef.current === audio) syncProgress();
        };

        audio.onpause = () => {
            if (audioRef.current === audio && !audio.ended) {
                pausedRef.current = true;
                setStatus('paused');
                useSpeechHighlightStore.getState().setPlaying(false);
                if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = 'paused';
                }
            }
        };

        audio.onplay = () => {
            if (audioRef.current === audio) {
                pausedRef.current = false;
                setStatus('playing');
                useSpeechHighlightStore.getState().setPlaying(true);
                if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = 'playing';
                }
            }
        };

        const next = () => {
            if (audioRef.current !== audio) return;
            if (isFinite(audio.duration) && audio.duration > 0) {
                completedDurationRef.current += audio.duration;
            }
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
        const url = URL.createObjectURL(blob);
        cachedPartsRef.current.push({
            url,
            ownsUrl: true,
            rawSentence,
            sentenceIndex,
            words,
            wordWeights,
            totalWeight,
        });

        // Immediately probe metadata for this chunk so totalDuration is ready as soon as all chunks finish
        const probeAudio = new Audio(url);
        probeAudio.preload = 'metadata';
        probeAudio.onloadedmetadata = () => {
            if (isFinite(probeAudio.duration) && probeAudio.duration > 0) {
                partDurationsRef.current[sentenceIndex] = probeAudio.duration;
                checkIfAllDone();
            }
        };

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
            // Find the first sentence ending punctuation or newline (ignoring list numbers like 1. or 2.)
            const match = rest.match(/(?<!\b\d)[.!?।;:]+(?=\s|$)|\n+/);
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
                const { words, wordWeights, totalWeight } = tokenizeSentenceWords(chunk);
                pendingRef.current += 1;
                chainRef.current = chainRef.current
                    .then(async () => {
                        if (!isCurrent()) return;
                        const blob = await audioApi.speech(payload(chunk), run.signal);
                        if (isCurrent()) {
                            addPart(blob, chunk, currentSentenceIndex, words, wordWeights, totalWeight);
                        }
                    })
                    .catch((err) => {
                        if (isCurrent()) fail(err);
                    })
                    .finally(() => {
                        if (!isCurrent()) return;
                        pendingRef.current -= 1;
                        if (producedAllRef.current && pendingRef.current === 0) {
                            producingRef.current = false;
                            checkIfAllDone();
                        }
                        playNextPart();
                    });
            }
        }
        if (final) {
            producedAllRef.current = true;
            // End of input is not cancellation: queued requests still need to run.
            if (pendingRef.current === 0) {
                producingRef.current = false;
                checkIfAllDone();
            }
            playNextPart();
        }
    };

    /** Follows the answer while it is written. */
    const startLive = () => {
        if (producingRef.current) return;
        abortRef.current = new AbortController();
        setError(null);
        setIsLiveStream(true);
        liveRef.current = true;
        producingRef.current = true;
        producedAllRef.current = false;
        spokenUpToRef.current = 0;
        sentenceIndexRef.current = 0;
        playbackIndexRef.current = 0;
        setStatus('loading');
        takeSentences(!streamingRef.current);
    };

    /** A finished message: synthesize queued sentences with live word tracking. */
    const startFull = () => {
        // If already completely synthesized and cached: REPLAY INSTANTLY!
        if (cachedPartsRef.current.length > 0 && producedAllRef.current && pendingRef.current === 0) {
            playbackIndexRef.current = 0;
            playNextPart();
            return;
        }
        if (producingRef.current) return;
        abortRef.current = new AbortController();
        setError(null);
        setIsLiveStream(true);
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
            if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'paused';
            }
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

    // System & Browser MediaSession synchronization (Chrome Media Hub, OS & Bluetooth Media Keys)
    useEffect(() => {
        if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: 'Cluaiz Speech',
                artist: 'Cluaiz Assistant',
                album: 'Chat Voice',
            });

            navigator.mediaSession.setActionHandler('play', () => {
                if (!speechTurns.isSpeaking(messageId)) {
                    speechTurns.request(turn);
                } else if (audioRef.current && pausedRef.current) {
                    resumeAudio(audioRef.current);
                } else {
                    playNextPart();
                }
            });

            navigator.mediaSession.setActionHandler('pause', () => {
                if (audioRef.current && !pausedRef.current) {
                    pausedRef.current = true;
                    audioRef.current.pause();
                    setStatus('paused');
                    useSpeechHighlightStore.getState().setPlaying(false);
                    navigator.mediaSession.playbackState = 'paused';
                }
            });

            navigator.mediaSession.setActionHandler('stop', () => {
                stopAll();
                speechTurns.release(messageId);
            });
        } catch {
            // MediaSession error guard
        }

        return () => {
            if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
                try {
                    navigator.mediaSession.setActionHandler('play', null);
                    navigator.mediaSession.setActionHandler('pause', null);
                    navigator.mediaSession.setActionHandler('stop', null);
                    navigator.mediaSession.playbackState = 'none';
                } catch {}
            }
        };
    }, [messageId, stopAll]);


    const executeSeek = useCallback((fraction: number) => {
        const targetTotal = totalSynthesizedDuration > 0 ? totalSynthesizedDuration : (duration > 0 ? duration : 0);
        if (targetTotal <= 0) return;

        // If playing single continuous audio
        if (totalSynthesizedDuration <= 0 && duration > 0 && audioRef.current) {
            audioRef.current.currentTime = fraction * duration;
            setCurrentTime(audioRef.current.currentTime);
            setCumulativeElapsed(audioRef.current.currentTime);
            syncProgress();
            return;
        }

        // If seeking across synthesized chunks
        if (cachedPartsRef.current.length > 0) {
            const targetTime = fraction * targetTotal;
            let accumulated = 0;
            let targetIdx = 0;
            let timeInPart = 0;

            for (let i = 0; i < cachedPartsRef.current.length; i++) {
                const partDur = partDurationsRef.current[i] || 2.0;
                if (targetTime < accumulated + partDur || i === cachedPartsRef.current.length - 1) {
                    targetIdx = i;
                    timeInPart = Math.max(0, targetTime - accumulated);
                    break;
                }
                accumulated += partDur;
            }

            completedDurationRef.current = accumulated;
            setCumulativeElapsed(targetTime);

            if (playbackIndexRef.current === targetIdx && audioRef.current) {
                audioRef.current.currentTime = timeInPart;
                setCurrentTime(timeInPart);
            } else {
                audioRef.current?.pause();
                audioRef.current = null;
                currentPartRef.current = null;
                playbackIndexRef.current = targetIdx;
                const part = cachedPartsRef.current[targetIdx];
                if (part) {
                    playFile(part, targetIdx);
                    setTimeout(() => {
                        if (audioRef.current) {
                            audioRef.current.currentTime = timeInPart;
                            setCurrentTime(timeInPart);
                        }
                    }, 50);
                }
            }
        }
    }, [totalSynthesizedDuration, duration, syncProgress]);

    const handleSeekFromClientX = useCallback((clientX: number) => {
        const rect = waveformRef.current?.getBoundingClientRect();
        if (!rect || rect.width <= 0) return;
        const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        executeSeek(fraction);
    }, [executeSeek]);

    useEffect(() => {
        if (!isDragging) return;
        const onMouseMove = (e: MouseEvent) => {
            handleSeekFromClientX(e.clientX);
        };
        const onMouseUp = () => {
            setIsDragging(false);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [isDragging, handleSeekFromClientX]);

    const scrollToActiveHighlight = useCallback(() => {
        const el =
            document.querySelector('[data-speech-active-word="true"]') ||
            document.getElementById(`msg-turn-${messageId}`) ||
            document.querySelector(`[data-message-id="${messageId}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [messageId]);

    const effectiveTotalDuration = totalSynthesizedDuration > 0 ? totalSynthesizedDuration : (!isLiveStream && duration > 0 ? duration : 0);
    const progressPercent = effectiveTotalDuration > 0 ? Math.min(100, Math.max(0, ((cumulativeElapsed || currentTime) / effectiveTotalDuration) * 100)) : 0;

    return (
        <div className={`group/deck relative w-full max-w-full font-[family-name:var(--font-family)] select-none ${className}`}>

            {/* Sound bar card wrapper with attached close button */}
            <div className="relative">
                <div className="relative flex items-center justify-between gap-3 px-3.5 py-2 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)]/70 shadow-lg backdrop-blur-md transition-all duration-200 overflow-hidden">
                    <button
                        type="button"
                        onClick={togglePlay}
                        className="flex items-center justify-center text-[var(--accent-color)] hover:text-[var(--text-primary)] transition-colors active:scale-90 cursor-pointer flex-shrink-0 z-10 p-1"
                        title={status === 'playing' ? 'Pause' : 'Play'}
                    >
                        {status === 'loading' ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-color)]" />
                        ) : status === 'playing' ? (
                            <PauseIcon size={18} isAnimated />
                        ) : (
                            <PlayIcon size={18} isAnimated className="ml-0.5" />
                        )}
                    </button>

                    {/* Center Audio Track Area: Dense Waveform Scrubber */}
                    <div
                        ref={waveformRef}
                        onClick={(e) => {
                            if (!isLiveStream) handleSeekFromClientX(e.clientX);
                        }}
                        onMouseDown={(e) => {
                            if (!isLiveStream) {
                                setIsDragging(true);
                                handleSeekFromClientX(e.clientX);
                            }
                        }}
                        onMouseMove={(e) => {
                            if (!isLiveStream && waveformRef.current) {
                                const rect = waveformRef.current.getBoundingClientRect();
                                if (rect.width > 0) {
                                    setHoverFraction(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
                                }
                            }
                        }}
                        onMouseLeave={() => {
                            setHoverFraction(null);
                        }}
                        className={`flex-1 relative flex items-center justify-between gap-[2px] h-7 px-1 mx-2 select-none ${
                            isLiveStream ? 'cursor-default' : 'cursor-pointer group/wave'
                        }`}
                        title={isLiveStream ? 'Streaming audio…' : 'Click or drag across waveform to seek'}
                    >
                        {DENSE_WAVE_BARS.map((baseHeight, idx) => {
                            const barRatio = (idx + 0.5) / DENSE_WAVE_BARS.length;
                            const isPlayed = !isLiveStream && barRatio <= (progressPercent / 100);
                            const isHovered = !isLiveStream && hoverFraction !== null && barRatio <= hoverFraction;
                            const isPlaying = status === 'playing';
                            const isLoading = status === 'loading';

                            const freq = isPlaying ? (freqLevels[idx] ?? 0) : 0;
                            const currentHeight = isPlaying
                                ? Math.round(3.5 + freq * (baseHeight - 3.5))
                                : 3.5; // Visible 3.5px resting dot height when paused

                            // Strictly Left-to-Right sweep timing: idx 0 starts first, idx 57 last
                            const sweepDelay = `${(idx / DENSE_WAVE_BARS.length) * (isLoading ? 1.5 : 2.0)}s`;

                            return (
                                <span
                                    key={idx}
                                    style={{
                                        height: isLoading ? undefined : `${currentHeight}px`,
                                        animationDelay: (isLoading || isLiveStream) ? sweepDelay : undefined,
                                    }}
                                    className={`w-[2.5px] rounded-full transition-all duration-75 flex-shrink-0 ${
                                        isLoading
                                            ? 'cluaiz-loading-bar bg-[var(--accent-color)]/80'
                                            : isLiveStream
                                            ? isPlaying
                                                ? 'cluaiz-pulse-bar bg-[var(--accent-color)]/80'
                                                : 'bg-[var(--accent-color)]/40 opacity-40'
                                            : isPlayed
                                            ? 'bg-[var(--accent-color)]/80 shadow-[0_0_4px_var(--accent-color)]/25'
                                            : isHovered
                                            ? 'bg-[var(--accent-color)]/50'
                                            : 'bg-[var(--text-muted)]/55'
                                    }`}
                                />
                            );
                        })}
                    </div>

                    {/* Right controls: Timer, Speed pill */}
                    <div className="flex items-center gap-2 flex-shrink-0 z-10">
                        {/* Clickable Timer to jump directly to currently spoken word in chat */}
                        <button
                            type="button"
                            onClick={scrollToActiveHighlight}
                            title="Click to jump to active spoken word in chat"
                            className="text-[10.5px] font-mono font-medium text-[var(--text-muted)] hover:text-[var(--accent-color)] hover:underline whitespace-nowrap transition-colors cursor-pointer select-none"
                        >
                            {isLiveStream ? (
                                status === 'loading' ? 'Preparing…' : formatTime(cumulativeElapsed || currentTime)
                            ) : (
                                `${formatTime(cumulativeElapsed || currentTime)} / ${formatTime(effectiveTotalDuration)}`
                            )}
                        </button>

                        {/* Compact Click-to-Cycle Speed Pill */}
                        <button
                            type="button"
                            onClick={() => {
                                const current = ttsSettings.playbackSpeed || 1.0;
                                const idx = SPEED_STEPS.indexOf(current);
                                const nextSpeed = SPEED_STEPS[(idx + 1) % SPEED_STEPS.length];
                                const updated = { ...ttsSettings, playbackSpeed: nextSpeed };
                                setTtsSettings(updated);
                                saveStoredTtsSettings(updated);
                                if (audioRef.current) {
                                    audioRef.current.playbackRate = nextSpeed;
                                }
                            }}
                            title="Click to cycle playback speed"
                            className="px-1.5 py-0.5 text-[10.5px] font-mono font-semibold rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] active:scale-95 transition-all select-none cursor-pointer"
                        >
                            {(ttsSettings.playbackSpeed || 1.0)}x
                        </button>

                    </div>
                </div>

                {/* Subtle floating close button centered directly on the bottom border of the soundbar */}
                <button
                    type="button"
                    onClick={() => {
                        stopAll();
                        if (onClose) onClose();
                        else useSpeechHighlightStore.getState().closeDeck();
                    }}
                    className="absolute left-1/2 -translate-x-1/2 -bottom-2.5 z-20 flex items-center justify-center w-5 h-5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent-color)] hover:scale-110 active:scale-95 shadow-md opacity-0 pointer-events-none group-hover/deck:opacity-100 group-hover/deck:pointer-events-auto transition-all duration-150 cursor-pointer"
                    title="Close audio player"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>

            {error && <p role="alert" className="mt-1 text-xs text-[var(--text-primary)]">{error} Press Play to retry.</p>}
        </div>
    );
};

export const PersistentAudioPlayer = PersistentAudioDeck;
export default PersistentAudioDeck;
