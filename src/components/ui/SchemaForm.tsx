import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { parse, stringify } from 'yaml';
import { Input } from './Input';
import { ToggleSwitch } from './ToggleSwitch';
import { CustomDropdown } from './dropdown/CustomDropdown';

export type Schema = Record<string, unknown>;

export interface SchemaFormProps {
    /** An object schema: its `properties` become the fields */
    schema: Schema;
    value: unknown;
    /** One field changed; `undefined` removes it */
    onChange: (name: string, value: unknown) => void;
    /** Follows `$ref`s of the schema's document */
    resolve?: (part: Schema) => Schema;
    /** Fields not shown here (edited elsewhere) */
    exclude?: string[];
    /** Fields drawn by the caller instead (a picker), by name */
    custom?: Record<string, (value: unknown, set: (value: unknown) => void) => React.ReactNode>;
}

const object = (value: unknown): value is Schema => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Text, numbers, choices and switches as inputs; anything with structure as YAML, read when the field is left */
function Field({ name, schema, value, required, onChange }: { name: string; schema: Schema; value: unknown; required: boolean; onChange: (value: unknown) => void }) {
    const type = schema.type;
    if (Array.isArray(schema.enum)) {
        const options = schema.enum.map(String);
        return <CustomDropdown floating value={value === undefined ? '' : String(value)} placeholder="Default"
            options={required ? options : [{ value: '', label: 'Default' }, ...options]}
            onChange={next => onChange(next === '' ? undefined : schema.enum && (schema.enum as unknown[]).find(item => String(item) === next))} />;
    }
    if (type === 'boolean') {
        return <div className="flex items-center gap-2">
            <ToggleSwitch size="sm" active={value === true} onToggle={() => onChange(!(value === true))} aria-label={name} />
            <span className="text-[11px] text-[var(--text-muted)]">{value === undefined ? 'default' : String(value)}</span>
        </div>;
    }
    if (type === 'string' || type === 'integer' || type === 'number') {
        const numeric = type !== 'string';
        return <Input sizeVariant="sm" value={value === undefined || value === null ? '' : typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value)}
            type={numeric ? 'number' : 'text'}
            onChange={event => {
                const raw = event.target.value;
                onChange(raw === '' ? undefined : numeric ? Number(raw) : raw);
            }} />;
    }
    return <YamlField value={value} onChange={onChange} />;
}

function YamlField({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) {
    const shown = value === undefined ? '' : stringify(value, { lineWidth: 0 }).trimEnd();
    const [draft, setDraft] = useState(shown);
    const [error, setError] = useState('');
    useEffect(() => { setDraft(shown); setError(''); }, [shown]);
    return <div className="space-y-1">
        <textarea value={draft} spellCheck={false} rows={Math.min(8, Math.max(2, draft.split('\n').length))}
            className="ui-input w-full font-mono text-[11px] leading-relaxed resize-y py-1.5"
            onChange={event => setDraft(event.target.value)}
            onBlur={() => {
                if (draft === shown) return;
                if (!draft.trim()) { onChange(undefined); return; }
                try { onChange(parse(draft)); setError(''); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
            }} />
        {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>;
}

/**
 * A form made from a JSON Schema. Required and filled-in fields show first; the rest wait under "more".
 * Each change names one field, so the owner of the value decides how it is written.
 */
export function SchemaForm({ schema, value, onChange, resolve = part => part, exclude = [], custom = {} }: SchemaFormProps) {
    const [more, setMore] = useState(false);
    const properties = object(schema.properties) ? schema.properties : {};
    const required = new Set(Array.isArray(schema.required) ? schema.required.map(String) : []);
    const current = object(value) ? value : {};
    const names = Object.keys(properties).filter(name => !exclude.includes(name));
    const shown = names.filter(name => required.has(name) || current[name] !== undefined);
    const hidden = names.filter(name => !shown.includes(name));

    const row = (name: string) => {
        const part = resolve(object(properties[name]) ? properties[name] : {});
        const set = (next: unknown) => onChange(name, next);
        return <label key={name} className="block space-y-1">
            <span className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-[var(--text-secondary)] font-mono">
                    {name}{required.has(name) && <span className="text-red-400"> *</span>}
                </span>
                {current[name] !== undefined && !required.has(name) && <button type="button" title="Back to the default"
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer" onClick={() => set(undefined)}>
                    <RotateCcw className="w-3 h-3" />
                </button>}
            </span>
            {custom[name] ? custom[name](current[name], set) : <Field name={name} schema={part} value={current[name]} required={required.has(name)} onChange={set} />}
            {typeof part.description === 'string' && <span className="block text-[10px] leading-snug text-[var(--text-muted)]">{part.description}</span>}
        </label>;
    };

    if (!names.length) return <p className="text-[11px] text-[var(--text-muted)]">Nothing to set here.</p>;
    return <div className="space-y-3">
        {shown.map(row)}
        {hidden.length > 0 && <div className="space-y-3">
            <button type="button" onClick={() => setMore(open => !open)}
                className="flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                {more ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {more ? 'Fewer fields' : `${hidden.length} more field${hidden.length === 1 ? '' : 's'}`}
            </button>
            {more && hidden.map(row)}
        </div>}
    </div>;
}
