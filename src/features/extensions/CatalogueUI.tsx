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
  return <div className={`shrink-0 flex items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] ${large ? 'w-14 h-14' : 'w-10 h-10'}`}>
    {image && !failed ? <img src={image} alt={`${name} logo`} loading="lazy" referrerPolicy="no-referrer" className="w-4/5 h-4/5 object-contain" onError={() => setFailed(true)} />
      : <Icon className="w-5 h-5 text-[var(--text-secondary)]" aria-hidden="true" />}
  </div>;
}
export function CatalogueTags({ values }: { values: string[] }) {
  if (!values.length) return null;
  return <div className="flex flex-wrap gap-1.5">{[...new Set(values)].slice(0, 5).map(value => <Badge key={value} variant="secondary" className="text-[10px]">{value}</Badge>)}</div>;
}
export function CatalogueCard({ title, subtitle, source, imageBase, icon, marker, description, tags, identity, meta, onOpen }: {
  title: string; subtitle: string; source?: string; imageBase?: string; icon?: LucideIcon; marker: string;
  description: string; tags: string[]; identity: string; meta?: string; onOpen(): void;
}) {
  return <Card className="h-full min-w-0 overflow-hidden" style={{ padding: 0 }}>
    <button type="button" aria-label={`View ${title}`} onClick={onOpen} className="w-full h-full text-left p-4 flex flex-col gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-color)] rounded-[var(--radius-card)] hover:bg-[var(--bg-tertiary)] transition-colors">
      <div className="flex items-center gap-3"><CatalogueLogo source={source} base={imageBase} name={title} icon={icon} />
        <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-[var(--text-primary)] leading-5 break-words">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{subtitle}</p>}</div>
        <Badge variant="outline" className="text-[10px] shrink-0">{marker}</Badge></div>
      <p className="text-xs leading-5 text-[var(--text-secondary)] line-clamp-2 min-h-10">{description || 'Open this package to view available details.'}</p>
      <CatalogueTags values={tags.filter(tag => tag.toLocaleLowerCase() !== marker.toLocaleLowerCase())} />
      <div className="mt-auto flex justify-between items-center gap-3 pt-1">
        <p className="min-w-0 text-[11px] text-[var(--text-muted)] truncate">{[identity !== title ? identity : '', meta].filter(Boolean).join(' · ')}</p>
        <span className="text-xs text-[var(--text-secondary)] inline-flex gap-1.5 items-center shrink-0">View details <ArrowUpRight size={13} /></span>
      </div>
    </button>
  </Card>;
}
export function CatalogueFilter({ label, icon: Icon, children }: { label: string; icon: LucideIcon; children: ReactNode }) {
  return <div className="space-y-1.5 min-w-0"><p className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]"><Icon size={12} />{label}</p>{children}</div>;
}
export function CatalogueSearch({ value, onChange, placeholder }: { value: string; onChange(value: string): void; placeholder: string }) {
  return <Input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} wrapperClassName="min-w-0 flex-1" leftIcon={<Search size={15} />} />;
}
export function CatalogueChips({ values, clear }: { values: { key: string; label: string; remove(): void }[]; clear(): void }) {
  if (!values.length) return null;
  return <div className="flex flex-wrap gap-2 items-center">{values.map(item => <Button key={item.key} variant="secondary" size="sm" onClick={item.remove}>{item.label}<X size={11} /></Button>)}
    <Button variant="ghost" size="sm" onClick={clear}>Clear filters</Button></div>;
}
