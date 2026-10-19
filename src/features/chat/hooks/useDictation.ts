import { useCallback, useEffect, useRef, useState } from 'react';
import { audioApi } from '../../../api/engine/audio/audio.api';

/**
 * Microphone to text while the user speaks.
 *
 * The microphone is split into phrases at pauses. While a phrase is being spoken, the audio so far
 * is transcribed again about every second, so words appear as they are said; when the user pauses,
 * the phrase is transcribed once more and kept. In voice mode a pause ends the user's turn
 * (`onTurnEnd`), and listening waits while the answer is spoken; speaking loudly then interrupts it.
 */
export type MicMode = 'record' | 'voice';

/** Loudness (0–1) above which the user is speaking */
const SPEECH_LEVEL = 0.06;
/** Loudness below which it is quiet */
const QUIET_LEVEL = 0.03;
/** Quiet this long after speech ends a phrase (and the turn, in voice mode) */
const PAUSE_MS = 800;
/** Sound shorter than this is noise, not speech */
const MIN_SPEECH_MS = 300;
/** The phrase so far is transcribed again this often */
const INTERIM_MS = 1000;
/** When one transcription takes longer than this (no GPU, large model), the phrase is only
 * transcribed at its pause, so the re-readings do not delay the final text */
const INTERIM_MAX_COST_MS = 2500;
/** While the answer is spoken, this loud for this long interrupts it */
const INTERRUPT_LEVEL = 0.15;
const INTERRUPT_MS = 400;
/** Quiet before the user starts speaking is not kept beyond this (it would only lengthen the audio) */
const IDLE_RESTART_MS = 4000;
/** A phrase is cut here even mid-speech: speech-to-text models read at most 30 s at a time */
const MAX_PHRASE_MS = 25000;

export interface DictationCallbacks {
    /** Everything heard in this session so far (kept phrases + the phrase being spoken) */
    onText: (text: string) => void;
    /** Voice mode: the user paused after speaking; the turn's text */
    onTurnEnd: (text: string) => void;
    /** Voice mode: the user spoke over the answer */
    onInterrupt: () => void;
    onLevel: (level: number) => void;
    onError: (message: string) => void;
}

interface Phrase {
    id: number;
    recorder: MediaRecorder;
    chunks: Blob[];
    startedAt: number;
    speechMs: number;
    discard: boolean;
    /** Cut at MAX_PHRASE_MS while the user was still speaking: their turn goes on */
    split: boolean;
}

/** A transcript worth keeping has a letter or a digit (not a lone "." from noise) */
const meaningful = (text: string) => /[\p{L}\p{N}]/u.test(text);
const join = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join(' ');

const pickMimeType = () =>
    ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'].find(
        (t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)
    ) || 'audio/webm';

/** Duration of the last transcription, to decide whether re-reading while speaking is affordable */
let lastTranscribeMs = 0;

const transcribe = async (blob: Blob): Promise<string> => {
    const started = performance.now();
    const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
    const res = await audioApi.transcriptions({ file: dataUri, stream: false });
    lastTranscribeMs = performance.now() - started;
    return (res?.text || '').trim();
};

export function useDictation(mode: MicMode, callbacks: DictationCallbacks) {
    const [active, setActive] = useState(false);
    const modeRef = useRef(mode);
    modeRef.current = mode;
    const cb = useRef(callbacks);
    cb.current = callbacks;

    const streamRef = useRef<MediaStream | null>(null);
    const ctxRef = useRef<AudioContext | null>(null);
    const rafRef = useRef<number | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const phraseRef = useRef<Phrase | null>(null);
    const phraseCounter = useRef(0);
    /** Changes when the microphone starts or is cancelled: readings of an older session are dropped */
    const sessionRef = useRef(0);
    const orderRef = useRef<Promise<void>>(Promise.resolve());
    const mimeRef = useRef('audio/webm');
    const committedRef = useRef('');
    const interimRef = useRef('');
    const interimBusyRef = useRef(false);
    const listeningRef = useRef(true);
    const speakingRef = useRef(false);
    const lastLoudRef = useRef(0);
    const lastFrameRef = useRef(0);
    const interruptMsRef = useRef(0);
    const failedRef = useRef(false);

    const emit = () => cb.current.onText(join(committedRef.current, interimRef.current));

    const fail = (err: any) => {
        if (failedRef.current) return;
        failedRef.current = true;
        const msg = err?.message || 'Speech recognition failed';
        cb.current.onError(/404|not found|model/i.test(msg) ? 'No speech-to-text model found. Install one in Model Settings.' : msg);
    };

    /** Starts recording a new phrase on the open microphone. */
    const newPhrase = () => {
        const stream = streamRef.current;
        if (!stream) return;
        const recorder = new MediaRecorder(stream, { mimeType: mimeRef.current });
        const session = sessionRef.current;
        const phrase: Phrase = {
            id: ++phraseCounter.current,
            recorder,
            chunks: [],
            startedAt: performance.now(),
            speechMs: 0,
            discard: false,
            split: false,
        };
        recorder.ondataavailable = (e) => e.data.size > 0 && phrase.chunks.push(e.data);
        recorder.onstop = () => {
            if (session !== sessionRef.current) return;
            if (phrase.discard || phrase.speechMs < MIN_SPEECH_MS || phrase.chunks.length === 0) {
                if (!phrase.discard) {
                    interimRef.current = '';
                    emit();
                }
                return;
            }
            const reading = transcribe(new Blob(phrase.chunks, { type: mimeRef.current }));
            reading.catch(() => {}); // handled in order below
            // Phrases are kept in the order they were spoken, whichever reading finishes first
            orderRef.current = orderRef.current.then(async () => {
                try {
                    const text = await reading;
                    if (phrase.discard || session !== sessionRef.current) return;
                    if (meaningful(text)) committedRef.current = join(committedRef.current, text);
                    interimRef.current = '';
                    emit();
                    if (modeRef.current === 'voice' && committedRef.current && !phrase.split) {
                        const turn = committedRef.current;
                        committedRef.current = '';
                        cb.current.onTurnEnd(turn);
                    }
                } catch (err) {
                    if (session === sessionRef.current) fail(err);
                }
            });
        };
        recorder.start(250);
        phraseRef.current = phrase;
        speakingRef.current = false;
    };

    /** Ends the phrase being recorded (it is transcribed and kept); `next` starts the following one. */
    const endPhrase = (next: boolean) => {
        const phrase = phraseRef.current;
        phraseRef.current = null;
        if (next) newPhrase();
        if (phrase && phrase.recorder.state !== 'inactive') phrase.recorder.stop();
    };

    const dropPhrase = () => {
        const phrase = phraseRef.current;
        phraseRef.current = null;
        if (phrase) {
            phrase.discard = true;
            if (phrase.recorder.state !== 'inactive') phrase.recorder.stop();
        }
        interimRef.current = '';
    };

    const teardown = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        void ctxRef.current?.close().catch(() => {});
        ctxRef.current = null;
        cb.current.onLevel(0);
        setActive(false);
    };

    const start = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
            streamRef.current = stream;
            mimeRef.current = pickMimeType();
            sessionRef.current += 1;
            committedRef.current = '';
            interimRef.current = '';
            listeningRef.current = true;
            failedRef.current = false;
            newPhrase();

            const ctx = new AudioContext();
            ctxRef.current = ctx;
            if (ctx.state === 'suspended') await ctx.resume();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            analyser.smoothingTimeConstant = 0.8;
            ctx.createMediaStreamSource(stream).connect(analyser);
            const bins = new Uint8Array(analyser.frequencyBinCount);
            lastFrameRef.current = performance.now();

            const frame = () => {
                analyser.getByteFrequencyData(bins);
                // Voice band (bins 1–23), with a floor that ignores room noise
                let sum = 0;
                const end = Math.min(bins.length, 24);
                for (let i = 1; i < end; i++) sum += bins[i];
                const level = Math.pow(Math.min(1, Math.max(0, (sum / (end - 1) - 20) / 80)), 2);
                cb.current.onLevel(level);

                const now = performance.now();
                const dt = now - lastFrameRef.current;
                lastFrameRef.current = now;

                if (!listeningRef.current) {
                    // The answer is being spoken: only a clear interruption starts listening again
                    interruptMsRef.current = level > INTERRUPT_LEVEL ? interruptMsRef.current + dt : 0;
                    if (interruptMsRef.current >= INTERRUPT_MS) {
                        interruptMsRef.current = 0;
                        listeningRef.current = true;
                        cb.current.onInterrupt();
                        newPhrase();
                    }
                } else if (phraseRef.current) {
                    const phrase = phraseRef.current;
                    const age = now - phrase.startedAt;
                    if (level > SPEECH_LEVEL) {
                        speakingRef.current = true;
                        phrase.speechMs += dt;
                        lastLoudRef.current = now;
                    }
                    if (speakingRef.current && level < QUIET_LEVEL && now - lastLoudRef.current > PAUSE_MS) {
                        endPhrase(true);
                    } else if (!speakingRef.current && level < QUIET_LEVEL && age > IDLE_RESTART_MS) {
                        // Nothing said yet: start over so the silence is not sent
                        dropPhrase();
                        newPhrase();
                    } else if (age > MAX_PHRASE_MS) {
                        phrase.split = true;
                        endPhrase(true);
                    }
                }
                rafRef.current = requestAnimationFrame(frame);
            };
            frame();

            // Words appear while the phrase is spoken: re-read it when the last reading is done
            intervalRef.current = setInterval(() => {
                const phrase = phraseRef.current;
                if (!phrase || !listeningRef.current || interimBusyRef.current || phrase.speechMs < MIN_SPEECH_MS) return;
                if (lastTranscribeMs > INTERIM_MAX_COST_MS) return;
                interimBusyRef.current = true;
                const session = sessionRef.current;
                transcribe(new Blob(phrase.chunks, { type: mimeRef.current }))
                    .then((text) => {
                        if (phraseRef.current?.id === phrase.id && meaningful(text)) {
                            interimRef.current = text;
                            emit();
                        }
                    })
                    .catch((err) => session === sessionRef.current && fail(err))
                    .finally(() => {
                        interimBusyRef.current = false;
                    });
            }, INTERIM_MS);

            setActive(true);
        } catch (err: any) {
            teardown();
            cb.current.onError(err?.message || 'Microphone access was denied');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** Stops the microphone. Record mode keeps the last phrase; voice mode drops an unsent one. */
    const stop = useCallback(() => {
        if (modeRef.current === 'record') endPhrase(false);
        else dropPhrase();
        teardown();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** The user took over (typed in the box): stop now and drop everything not yet typed, including
     * readings still on their way, so nothing overwrites what the user wrote. */
    const cancel = useCallback(() => {
        sessionRef.current += 1;
        dropPhrase();
        if (streamRef.current) teardown();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** Voice mode: stop listening while the answer is written and spoken. */
    const pauseListening = useCallback(() => {
        listeningRef.current = false;
        interruptMsRef.current = 0;
        dropPhrase();
        emit();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** Voice mode: the answer has been said; listen for the next turn. */
    const resumeListening = useCallback(() => {
        if (!streamRef.current || listeningRef.current) return;
        listeningRef.current = true;
        newPhrase();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Leaving the chat input releases the microphone
    useEffect(() => () => {
        dropPhrase();
        teardown();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { active, start, stop, cancel, pauseListening, resumeListening };
}
