import { create } from 'zustand';
import { readFlow } from './model/flowDoc';

/** The flow open in the builder, which a flow file in a chat answer can be applied to */
export interface FlowApplyTarget { name: string; apply: (text: string) => void }

export const useFlowApplyTarget = create<{ target: FlowApplyTarget | null; setTarget: (target: FlowApplyTarget | null) => void }>(set => ({
    target: null,
    setTarget: target => set({ target }),
}));

/** A code block that is a whole flow file (`flow:` and `steps:`), not a part of one */
export function isFlowText(text: string): boolean {
    const { value } = readFlow(text);
    return Boolean(value && typeof value.flow === 'string' && Array.isArray(value.steps));
}
