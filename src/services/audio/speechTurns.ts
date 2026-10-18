/**
 * One message speaks at a time. A message that starts speaking takes over: the one speaking stops
 * (a new answer cuts off the old one). Listeners hear when speaking starts or ends, so voice mode
 * knows when the answer has been said and the microphone can listen again.
 */
interface Turn {
    id: string;
    start: () => void;
    stop: () => void;
}

let current: Turn | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export const speechTurns = {
    /** Starts this message now, stopping the one speaking. */
    request(turn: Turn): void {
        if (current && current.id !== turn.id) {
            const previous = current;
            current = null;
            previous.stop();
        }
        current = turn;
        turn.start();
        notify();
    },

    /** The message finished or was stopped. */
    release(id: string): void {
        if (current?.id !== id) return;
        current = null;
        notify();
    },

    /** Stops whatever is speaking (the user interrupted). */
    stopAll(): void {
        const previous = current;
        current = null;
        previous?.stop();
        notify();
    },

    isSpeaking(id: string): boolean {
        return current?.id === id;
    },

    isIdle(): boolean {
        return current === null;
    },

    subscribe(listener: () => void): () => void {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
};
