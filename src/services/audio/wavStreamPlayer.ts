/**
 * Plays the WAV parts of a streamed speech response (`speech.audio.delta` events of
 * /v1/audio/speech with stream: true) back to back as they arrive, so playback starts with the
 * first sentence instead of after the whole text.
 */
export class WavStreamPlayer {
    private ctx: AudioContext | null = null;
    private nextStart = 0;
    private sources: AudioBufferSourceNode[] = [];
    // Parts decode asynchronously; the chain keeps them in arrival order
    private queue: Promise<void> = Promise.resolve();

    push(audio: string): void {
        this.queue = this.queue.then(() => this.schedule(audio)).catch((err) => {
            console.warn('[WavStreamPlayer] Could not play an audio part', err);
        });
    }

    stop(): void {
        for (const source of this.sources) {
            try {
                source.stop();
            } catch {
                // already ended
            }
        }
        this.sources = [];
        void this.ctx?.close();
        this.ctx = null;
        this.nextStart = 0;
        this.queue = Promise.resolve();
    }

    private async schedule(audio: string): Promise<void> {
        const ctx = this.ctx ?? (this.ctx = new AudioContext());
        const base64 = audio.includes(',') ? audio.slice(audio.indexOf(',') + 1) : audio;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const buffer = await ctx.decodeAudioData(bytes.buffer);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        const start = Math.max(ctx.currentTime + 0.05, this.nextStart);
        source.start(start);
        this.nextStart = start + buffer.duration;
        this.sources.push(source);
        source.onended = () => {
            this.sources = this.sources.filter((s) => s !== source);
        };
    }
}
