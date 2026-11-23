import { useChatStore } from './useChatStore';
import { controlsFor, useChatControlsStore } from './useChatControlsStore';

/** The run settings of the chat open now, read at send time */
export const activeChatControls = () =>
    controlsFor(useChatControlsStore.getState().byChat, useChatStore.getState().activeSessionId);
