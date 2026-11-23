/** Small bars of a count per day (oldest first); decorative, the number beside it carries the meaning */
export function Bars({ values, className = '' }: { values: number[]; className?: string }) {
    const top = Math.max(1, ...values);
    return <span aria-hidden className={`inline-flex h-5 items-end gap-[3px] ${className}`}>
        {values.map((value, index) => <span key={index} className={`w-[3px] rounded-sm ${value ? 'bg-[var(--text-secondary)]' : 'bg-[var(--border-color)]'}`}
            style={{ height: `${Math.max(15, (value / top) * 100)}%` }} />)}
    </span>;
}
