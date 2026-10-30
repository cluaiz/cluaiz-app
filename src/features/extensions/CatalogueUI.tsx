import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, Box, Search, X, type LucideIcon } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { catalogueImage } from './catalogueView';

export function CatalogueLogo({ source, name, base, icon: Icon = Box, large = false }: {
  source?: string; name: string; base?: string; icon?: LucideIcon; large?: boolean;
}) {
  const image = catalogueImage(source || '', base), [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);
  return <div className={`shrink-0 flex items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] ${large ? 'w-20 h-20' : 'w-14 h-14'}`}>
    {image && !failed ? <img src={image} alt={`${name} logo`} loading="lazy" referrerPolicy="no-referrer" className="w-4/5 h-4/5 object-contain" onError={() => setFailed(true)} />
      : <Icon className="w-7 h-7 text-[var(--accent-color)]" aria-hidden="true" />}
  </div>;
}
export function CatalogueTags({ values }: { values: string[] }) {
  return <div className="flex flex-wrap gap-1.5">{[...new Set(values)].slice(0, 5).map(value => <Badge key={value} variant="secondary" className="text-[10px]">{value}</Badge>)}</div>;
}
export function CatalogueCard({ title, subtitle, source, imageBase, icon, marker, description, tags, identity, meta, onOpen }: {
  title: string; subtitle: string; source?: string; imageBase?: string; icon?: LucideIcon; marker: string;
  description: string; tags: string[]; identity: string; meta?: string; onOpen(): void;
}) {
  return <Card className="group h-full overflow-hidden hover:border-[var(--accent-color)]/50 transition-colors">
    <button type="button" aria-label={`View ${title}`} onClick={onOpen} className="w-full h-full text-left p-5 sm:p-6 flex flex-col gap-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-color)] rounded-[var(--radius-card)]">
      <div className="flex items-start gap-4"><CatalogueLogo source={source} base={imageBase} name={title} icon={icon} />
        <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1.5 truncate">{subtitle}</p>
          <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)] leading-snug break-words">{title}</h3></div>
        <Badge variant="outline" className="text-[10px] shrink-0">{marker}</Badge></div>
      <CatalogueTags values={tags} />
      <p className="text-sm leading-relaxed text-[var(--text-secondary)] line-clamp-2 min-h-10">{description || 'Open this package to view available details.'}</p>
      <div className="mt-auto pt-4 border-t border-[var(--border-color)] flex justify-between items-center gap-3">
        <div className="min-w-0"><p className="text-xs font-mono text-[var(--text-muted)] truncate">{identity}</p>{meta && <p className="text-[11px] text-[var(--text-secondary)] mt-1">{meta}</p>}</div>
        <span className="text-xs font-semibold text-[var(--accent-color)] inline-flex gap-1.5 items-center shrink-0">View details <ArrowUpRight size={14} /></span>
      </div>
    </button>
  </Card>;
}
export function CatalogueFilter({ label, icon: Icon, children }: { label: string; icon: LucideIcon; children: ReactNode }) {
  return <div className="space-y-2 min-w-0"><p className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-[var(--text-muted)]"><Icon size={13} className="text-[var(--accent-color)]" />{label}</p>{children}</div>;
}
export function CatalogueSearch({ value, onChange, placeholder }: { value: string; onChange(value: string): void; placeholder: string }) {
  return <Input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} sizeVariant="lg" wrapperClassName="min-w-0 flex-1" leftIcon={<Search size={16} />} />;
}
export function CatalogueChips({ values, clear }: { values: { key: string; label: string; remove(): void }[]; clear(): void }) {
  if (!values.length) return null;
  return <div className="flex flex-wrap gap-2 items-center">{values.map(item => <Button key={item.key} variant="secondary" size="sm" onClick={item.remove}>{item.label}<X size={11} /></Button>)}
    <Button variant="ghost" size="sm" onClick={clear}>Clear filters</Button></div>;
}
