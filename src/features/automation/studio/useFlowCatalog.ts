import { useEffect, useState } from 'react';
import { errorMessage } from '../../../api/client/errors';
import { flowsApi, type FlowNodes, type JsonSchema } from '../../../api/engine/automation';

export interface FlowCatalog { nodes: FlowNodes; schema: JsonSchema }

let shared: Promise<FlowCatalog> | null = null;

/** What steps can run here (`flows.nodes`) and the file's JSON Schema (`flows.schema`), read once per App session */
export function useFlowCatalog() {
    const [catalog, setCatalog] = useState<FlowCatalog | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let alive = true;
        shared ??= Promise.all([flowsApi.nodes(), flowsApi.schema()]).then(([nodes, file]) => ({ nodes, schema: file.schema }));
        shared.then(value => { if (alive) setCatalog(value); })
            .catch(reason => { shared = null; if (alive) setError(errorMessage(reason)); });
        return () => { alive = false; };
    }, []);
    return { catalog, error, reload: () => { shared = null; setCatalog(null); setError(''); } };
}

const object = (value: unknown): value is JsonSchema => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The schema branch of one step kind or trigger kind (`$defs.step.oneOf[].title`) */
export function kindSchema(schema: JsonSchema, of: 'step' | 'trigger', kind: string): JsonSchema | null {
    const defs = object(schema.$defs) ? schema.$defs : {};
    const branch = object(defs[of]) && Array.isArray(defs[of].oneOf) ? defs[of].oneOf : [];
    return branch.find((item): item is JsonSchema => object(item) && item.title === kind) ?? null;
}

/** Follows a local `$ref` (`#/$defs/expression`) */
export function resolveRef(schema: JsonSchema, part: JsonSchema): JsonSchema {
    const ref = typeof part.$ref === 'string' ? part.$ref : '';
    if (!ref.startsWith('#/')) return part;
    const found = ref.slice(2).split('/').reduce<unknown>((at, key) => object(at) ? at[key] : undefined, schema);
    return object(found) ? { ...found, description: part.description ?? found.description } : part;
}
