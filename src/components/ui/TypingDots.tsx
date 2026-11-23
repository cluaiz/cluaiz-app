/** The chat's waiting sign: three accent dots bouncing one after another */
export function TypingDots({ size = 'w-2 h-2', className = '' }: { size?: string; className?: string }) {
    return <span aria-hidden="true" className={`inline-flex items-center gap-1 ${className}`}>
        {[0, 150, 300].map(delay => <span key={delay} className={`${size} rounded-full bg-[var(--accent-color)] animate-bounce`} style={{ animationDelay: `${delay}ms` }} />)}
    </span>;
}
