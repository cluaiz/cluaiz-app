import { stringify } from 'yaml';

export interface AgentDraft { name: string; title: string; description: string; instructions: string; tools: string[]; confirm: 'auto' | 'strict' | 'sandboxed' | 'full_access' }

/** A flow file name: lower case, digits and dashes */
export const agentName = (title: string) => title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/**
 * An agent is a workflow with a `tool` trigger: once on, chats, the coding agent and MCP clients can call it as
 * `flow_<name>`. It takes one input (`request`), runs a model with the chosen tools (an `agent` step; an `ask` step
 * when no tool is chosen), and returns the answer. The person can change it later on the canvas.
 */
export function agentFlowText(draft: AgentDraft): string {
    const work = draft.tools.length
        ? { id: 'work', agent: draft.instructions, with: { request: '${{ inputs.request }}' }, tools: draft.tools }
        : { id: 'work', ask: draft.instructions, with: { request: '${{ inputs.request }}' } };
    return stringify({
        flow: 'cluaiz.flow/1',
        name: draft.name,
        description: draft.description,
        inputs: { request: { type: 'string', description: 'What the agent should do' } },
        outputs: { answer: '${{ steps.work.output }}' },
        on: [{ tool: { title: draft.title, description: draft.description, confirm: draft.confirm } }],
        steps: [work],
        meta: { folder: 'Agents' },
    }, { lineWidth: 0 });
}
