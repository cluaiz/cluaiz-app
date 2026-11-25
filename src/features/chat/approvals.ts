import { useChatStore } from '../../store/chat/useChatStore';
import { usePermissionStore } from '../../api/engine/permission/permission.store';
import { useNotificationStore } from '../../store/ui/useNotificationStore';
import type { ChatMessage, ChatPermissionRequest } from '../../store/chat/types';

/** A tool call of the chat that waits for the user's yes or no. */
export interface ChatApproval {
    sessionId: string;
    requestId: string;
    toolName: string;
    category?: string;
    parameters?: unknown;
}

/** Every call of one answer that asked for a yes or no, oldest first */
export const messageApprovals = (message: ChatMessage): ChatPermissionRequest[] =>
    [...(message.earlierPermissionRequests ?? []), ...(message.permissionRequest ? [message.permissionRequest] : [])];

const deciding = new Set<string>();
const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearExpiry(requestId: string) {
    clearTimeout(expiryTimers.get(requestId));
    expiryTimers.delete(requestId);
}

function expireApproval(sessionId: string, requestId: string) {
    clearExpiry(requestId);
    const store = useChatStore.getState();
    const pending = (store.sessions[sessionId]?.messages ?? []).flatMap(messageApprovals)
        .some(request => request.requestId === requestId && request.status === 'pending');
    if (!pending) return;
    store.resolvePermissionRequest(sessionId, requestId, 'timeout');
    void closeApprovalNotification(requestId);
}

/** Arm the deadline sent by the Engine as soon as the request is shown. */
export function receiveChatApproval(sessionId: string, request: ChatPermissionRequest & { timeoutSeconds?: number }) {
    useChatStore.getState().setPermissionRequestOnLastMessage(sessionId, request);
    const { requestId, timeoutSeconds } = request;
    if (typeof timeoutSeconds === 'number' && Number.isFinite(timeoutSeconds) && timeoutSeconds > 0 && !expiryTimers.has(requestId)) {
        expiryTimers.set(requestId, setTimeout(() => expireApproval(sessionId, requestId), timeoutSeconds * 1000));
    }
    void notifyApproval({ sessionId, ...request });
}

/**
 * The user's answer to a waiting call, from the card above the input or from a notification:
 * the Engine is told first, then the chat shows the decision.
 */
export async function decideChatApproval(approval: Pick<ChatApproval, 'sessionId' | 'requestId'>, approved: boolean, feedback?: string, remember?: 'chat') {
    if (deciding.has(approval.requestId)) return;
    deciding.add(approval.requestId);
    try {
        const store = usePermissionStore.getState();
        if (approved) await store.approvePermission(approval.requestId, undefined, remember);
        else await store.rejectPermission(approval.requestId, feedback);
        clearExpiry(approval.requestId);
        useChatStore.getState().resolvePermissionRequest(approval.sessionId, approval.requestId,
            approved ? 'approved' : 'rejected', approved ? undefined : feedback);
        void closeApprovalNotification(approval.requestId);
    } finally {
        deciding.delete(approval.requestId);
    }
}

const WORKER = '/approval-sw.js';
let listening = false;

async function worker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !window.isSecureContext) return null;
    try {
        const registration = await navigator.serviceWorker.register(WORKER);
        if (!listening) {
            listening = true;
            // A button pressed in the notification: the open App answers, with its own connection
            navigator.serviceWorker.addEventListener('message', event => {
                const data = event.data as { type?: string; action?: string; requestId?: string; sessionId?: string } | null;
                if (data?.type !== 'cluaiz-approval' || !data.requestId || !data.sessionId) return;
                if (data.action === 'approve' || data.action === 'reject') {
                    void decideChatApproval({ sessionId: data.sessionId, requestId: data.requestId }, data.action === 'approve')
                        .catch(() => { /* the card above the input still shows the request */ });
                } else {
                    window.focus();
                }
            });
        }
        return await navigator.serviceWorker.ready;
    } catch {
        return null;
    }
}

/** The App is not in front of the user: another tab, a minimised window or another window on top. */
export function appOutOfSight(): boolean {
    return typeof document !== 'undefined' && (document.hidden || !document.hasFocus());
}

/**
 * Tells the user about a waiting call when the App is out of sight. With a service worker the
 * notification has Approve and Reject; without one (some desktop webviews) a click brings the
 * App to the front, where the card waits.
 */
async function mayNotify(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window) || !appOutOfSight()) return false;
    if (!useNotificationStore.getState().desktopPush) return false;
    if (Notification.permission === 'default') {
        try { await Notification.requestPermission(); } catch { return false; }
    }
    return Notification.permission === 'granted';
}

/**
 * Tells the user, when the App is out of sight, that something waits for them in the App (such as
 * an install's permission question); a click brings the App to the front, where the question is.
 */
export async function notifyWaiting({ tag, title, body }: { tag: string; title: string; body: string }) {
    if (!await mayNotify()) return;
    const registration = await worker();
    try {
        if (registration) await registration.showNotification(title, { body, tag, icon: '/logo/logo.png', requireInteraction: true });
        else {
            const plain = new Notification(title, { body, tag, icon: '/logo/logo.png' });
            plain.onclick = () => { window.focus(); plain.close(); };
        }
    } catch { /* notifications are a convenience; the question still waits in the App */ }
}

export async function notifyApproval(approval: ChatApproval) {
    if (!await mayNotify()) return;
    const title = 'Approval needed';
    const body = `${approval.toolName} wants to run. Approve or reject it.`;
    const registration = await worker();
    if (registration) {
        await registration.showNotification(title, {
            body, tag: approval.requestId, icon: '/logo/logo.png', requireInteraction: true,
            data: { requestId: approval.requestId, sessionId: approval.sessionId },
            // `actions` is not in every TypeScript DOM version; browsers without buttons ignore it
            ...({ actions: [{ action: 'approve', title: 'Approve' }, { action: 'reject', title: 'Reject' }] } as object),
        });
        return;
    }
    try {
        const plain = new Notification(title, { body, tag: approval.requestId, icon: '/logo/logo.png' });
        plain.onclick = () => { window.focus(); plain.close(); };
    } catch { /* notifications are a convenience; the card above the input still asks */ }
}

async function closeApprovalNotification(requestId: string) {
    try {
        const registration = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
            ? await navigator.serviceWorker.getRegistration(WORKER) : undefined;
        for (const shown of await registration?.getNotifications({ tag: requestId }) ?? []) shown.close();
    } catch { /* nothing to close */ }
}

/**
 * The Engine waits for an answer only while the turn that asked is running. When a chat's turn ends
 * (answer, error, cancel or the Engine's own timeout), a call still shown as waiting can no longer be
 * answered: it is marked expired, and its notification closes. Returns the unsubscribe.
 */
export function startApprovalExpiry(): () => void {
    return useChatStore.subscribe((state, previous) => {
        const ended = previous.streamingSessionId;
        if (!ended || state.streamingSessionId === ended) return;
        for (const request of (state.sessions[ended]?.messages ?? []).flatMap(messageApprovals)) {
            if (request.status !== 'pending') continue;
            expireApproval(ended, request.requestId);
        }
    });
}
