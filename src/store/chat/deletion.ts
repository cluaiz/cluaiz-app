import { chatHistoryApi } from '../../api/engine/chat/history';
import { chatStorageManager } from '../../services/storage/ChatStorageManager';
import { useConnectionStore } from '../engine/useConnectionStore';
import type { ChatSession } from './types';

interface DeletionOwner {
  session(id: string): ChatSession | undefined;
  streaming(id: string): boolean;
  beforeStorage(id: string): Promise<void>;
  removed(id: string): void;
  failed(id: string, error: unknown): void;
}

let generation = 0;
useConnectionStore.subscribe((next, previous) => {
  if (next.protocol !== previous.protocol || next.host !== previous.host || next.port !== previous.port) ++generation;
});

/** A bulk action must not continue its remaining ids against another Engine. */
export async function deleteSessionBatch(ids: string[], remove: (id: string) => Promise<boolean>) {
  const started = generation, removed: string[] = [];
  for (const id of ids) {
    if (started !== generation) break;
    if (await remove(id)) removed.push(id);
  }
  return removed;
}

/** One acknowledged operation per session; all UI/retention callers use the same owner. */
export function createSessionDeleter(owner: DeletionOwner) {
  const pending = new Map<string, Promise<boolean>>();
  return (id: string, eligible = () => true): Promise<boolean> => {
    const existing = pending.get(id);
    if (existing) return existing;
    const session = owner.session(id), started = generation;
    if (!session) return Promise.resolve(false);
    const guard = () => {
      if (generation !== started) throw new Error('Engine connection changed; chat deletion stopped');
      if (owner.session(id) !== session) throw new Error('Chat changed during deletion; retry explicitly');
      if (owner.streaming(id)) throw new Error('Stop the active answer before deleting this chat');
      if (!eligible()) throw new Error('Chat is now protected by the cleanup policy');
    };
    const task = Promise.resolve().then(async () => {
      try {
        guard();
        await chatHistoryApi.deleteChat(id);
        guard();
        if (!session.isIncognito) {
          await owner.beforeStorage(id);
          guard();
          await chatStorageManager.deleteSession(id, guard);
          guard();
        }
        owner.removed(id);
        return true;
      } catch (error) { owner.failed(id, error); return false; }
      finally { pending.delete(id); }
    });
    pending.set(id, task);
    return task;
  };
}
