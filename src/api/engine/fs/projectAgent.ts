import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';

/** One agent file of a project: a rule, workflow, skill or memory fact under `.agents/` */
export interface ProjectItem {
    name: string; kind: string; path: string; description?: string; found_in?: string;
    trigger?: string; status?: string; superseded_by?: string | null;
}
export interface ProjectInstruction { label: string; path: string; chars: number }
export interface ProjectIndex {
    root: string; instructions: ProjectInstruction[];
    rules: ProjectItem[]; workflows: ProjectItem[]; skills: ProjectItem[]; memory: ProjectItem[];
    problems: unknown[];
}
export interface ProjectFact extends ProjectItem { text: string }
export interface RememberResult { saved: string; path: string; replaced: string[]; similar: string[] }

const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const items = (value: unknown) => Array.isArray(value) && value.every(item => object(item) && text(item.name) && text(item.path));
const invalid = (method: string) => new ApiError('Engine returned an invalid project response', 200, 'INVALID_PROJECT_RESPONSE', method);
export const FACT_MAX_CHARS = 2000;

/** The project's agent files (`AGENTS.md`, `.agents/rules|workflows|skills|memory`) through the Engine. */
export const projectAgentApi = {
    index: async (signal?: AbortSignal): Promise<ProjectIndex> => {
        const result = await callCep<unknown>('workspace.index', {}, { signal });
        if (!object(result) || !text(result.root) || !Array.isArray(result.instructions)
            || !['rules', 'workflows', 'skills', 'memory'].every(key => items(result[key]))) throw invalid('workspace.index');
        return result as unknown as ProjectIndex;
    },
    item: async (name: string, kind?: string, signal?: AbortSignal): Promise<string> => {
        const result = await callCep<unknown>('workspace.item', { name, ...(kind && { kind }) }, { signal });
        if (!object(result) || typeof result.text !== 'string') throw invalid('workspace.item');
        return result.text;
    },
    facts: async (signal?: AbortSignal): Promise<ProjectFact[]> => {
        const result = await callCep<unknown>('workspace.memory', {}, { signal });
        if (!object(result) || !items(result.facts) || !(result.facts as unknown[]).every(fact => object(fact) && typeof fact.text === 'string')) {
            throw invalid('workspace.memory');
        }
        return result.facts as ProjectFact[];
    },
    remember: async (name: string, fact: string, replaces?: string, signal?: AbortSignal): Promise<RememberResult> => {
        const value = fact.trim();
        if (!name.trim() || !value || value.length > FACT_MAX_CHARS) {
            throw new ApiError(`A fact needs a name and 1–${FACT_MAX_CHARS} characters`, 400, 'INVALID_PROJECT_INPUT', 'workspace.remember');
        }
        const result = await callCep<unknown>('workspace.remember',
            { name: name.trim(), fact: value, source: 'Cluaiz App', ...(replaces && { replaces }) }, { signal });
        if (!object(result) || !text(result.saved) || !text(result.path)) throw invalid('workspace.remember');
        return { saved: result.saved, path: result.path,
            replaced: Array.isArray(result.replaced) ? result.replaced.map(String) : [],
            similar: Array.isArray(result.similar) ? result.similar.map(String) : [] };
    },
    forget: async (name: string, signal?: AbortSignal): Promise<void> => {
        const result = await callCep<unknown>('workspace.forget', { name }, { signal });
        if (!object(result) || result.forgotten !== name) throw invalid('workspace.forget');
    },
};
