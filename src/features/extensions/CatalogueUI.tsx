import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpDown, ArrowUpRight, Box, Check, Search, X, type LucideIcon } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { catalogueImage, cleanModelDescription } from './catalogueView';

export function LogoBox({ large = false, children }: { large?: boolean; children: ReactNode }) {
  return <div className={`shrink-0 flex items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] ${large ? 'w-14 h-14' : 'w-10 h-10'}`}>
    {children}
  </div>;
}
export function CatalogueLogo({ source, name, base, icon: Icon = Box, large = false }: {
  source?: string; name: string; base?: string; icon?: LucideIcon; large?: boolean;
}) {
  const image = catalogueImage(source || '', base), [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);
  return <LogoBox large={large}>
    {image && !failed ? <img src={image} alt={`${name} logo`} loading="lazy" referrerPolicy="no-referrer" className="w-4/5 h-4/5 object-contain" onError={() => setFailed(true)} />
      : <Icon className="w-5 h-5 text-[var(--text-secondary)]" aria-hidden="true" />}
  </LogoBox>;
}
/** A family's or provider's page head: name, maker, model count, description and tags, with its logo large on the right. */
export function CatalogueHero({ title, by, count, description, tags, logo }: {
  title: string; by?: string; count?: number; description?: string; tags: string[]; logo?: ReactNode;
}) {
  return <div className="relative pt-0 pb-6 min-h-[220px] sm:min-h-[280px] flex items-center text-left">
    {logo && <div className="absolute inset-y-0 right-0 w-[40%] pointer-events-none select-none z-0 flex items-center justify-end overflow-hidden" aria-hidden="true">
      {logo}
    </div>}
    <div className="relative z-10 space-y-3 max-w-2xl text-left">
      <h1 className="text-3xl sm:text-4xl font-extrabold font-mono uppercase text-[var(--text-primary)] tracking-tight">{title}</h1>
      {by !== undefined && count !== undefined && <div className="flex items-center gap-2.5 text-xs sm:text-sm font-mono flex-wrap">
        <span className="text-[var(--text-muted)]">by <span className="text-[var(--text-secondary)] font-semibold">{by}</span></span>
        <span className="text-[var(--border-color)]">·</span>
        <Badge variant="outline" className="text-xs font-mono font-bold uppercase tracking-wider">{count} {count === 1 ? 'Model' : 'Models'}</Badge>
      </div>}
      {description && <p className="text-xs sm:text-sm leading-relaxed text-[var(--text-secondary)] pt-0.5 max-w-xl">{description}</p>}
      <div className="flex items-center gap-1.5 flex-wrap pt-1"><CatalogueTags values={tags} /></div>
    </div>
  </div>;
}
/** SVG filter `remove-white-bg`: removes the white box around a logo. Rendered once per catalogue page. */
export function CatalogueImageFilters() {
  return <svg className="absolute w-0 h-0 pointer-events-none opacity-0 overflow-hidden" aria-hidden="true">
    <defs>
      <filter id="remove-white-bg" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                -2 -2 -2 0 5.5" result="filtered" />
        <feComposite in="filtered" in2="SourceGraphic" operator="in" />
      </filter>
    </defs>
  </svg>;
}
/** The hero's large, dimmed logo; a white background is removed by `CatalogueImageFilters`. */
export function CatalogueHeroImage({ src }: { src: string }) {
  return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer"
    className="absolute right-[8%] top-1/2 -translate-y-1/2 w-72 h-72 object-contain opacity-40 transition-opacity duration-300"
    style={{ filter: 'url(#remove-white-bg)' }} />;
}
/** Search, an optional filter menu, and sort above a family's model cards. */
export function CatalogueToolbar<Sort extends string>({ query, onQuery, placeholder, sort, sorts, onSort, filter }: {
  query: string; onQuery(value: string): void; placeholder: string; sort: Sort; sorts: Record<Sort, string>; onSort(value: Sort): void;
  filter?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 pb-1">
    <div className="relative flex-1 max-w-sm">
      <Input value={query} onChange={event => onQuery(event.target.value)} placeholder={placeholder} sizeVariant="sm" leftIcon={<Search size={14} />}
        rightElement={query ? <button type="button" onClick={() => onQuery('')} title="Clear search"
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer p-0.5"><X size={12} /></button> : null} />
    </div>
    <div className="relative flex items-center gap-2 self-end sm:self-auto">
      {filter}
      <Button variant="secondary" size="sm" onClick={() => setOpen(!open)} className="flex items-center gap-1.5 font-mono text-xs cursor-pointer shadow-xs">
        <ArrowUpDown size={12} className="text-[var(--accent-color)]" />
        <span className="text-[var(--text-muted)]">Sort:</span>
        <span className="font-semibold text-[var(--text-primary)]">{sorts[sort]}</span>
      </Button>
      {open && <>
        <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-xl z-40 py-1 font-mono text-xs overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {(Object.keys(sorts) as Sort[]).map(option => <button key={option} type="button" onClick={() => { onSort(option); setOpen(false); }}
            className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors ${
              sort === option ? 'text-[var(--accent-color)] font-bold bg-[var(--bg-tertiary)]/50' : 'text-[var(--text-secondary)]'}`}>
            <span>{sorts[option]}</span>
            {sort === option && <Check size={12} />}
          </button>)}
        </div>
      </>}
    </div>
  </div>;
}
/** Label and value pairs of a model's specifications. */
export function SpecList({ specs }: { specs: [string, ReactNode][] }) {
  return <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
    {specs.map(([label, value]) => <div key={label} className="min-w-0">
      <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
      <dd className="text-sm text-[var(--text-primary)] break-words mt-1">{value}</dd>
    </div>)}
  </dl>;
}
export function CatalogueTags({ values }: { values: string[] }) {
  if (!values.length) return null;
  return <div className="flex flex-wrap gap-1.5">{[...new Set(values.map(v => v.trim().toUpperCase()))].slice(0, 5).map(value => <Badge key={value} variant="secondary" className="text-[10px]">{value}</Badge>)}</div>;
}
export function CatalogueCard({ title, subtitle, source, imageBase, icon, marker, description, tags, identity, meta, onOpen }: {
  title: string; subtitle: string; source?: string; imageBase?: string; icon?: LucideIcon; marker: string;
  description: string; tags: string[]; identity: string; meta?: string; onOpen(): void;
}) {
  const sanitizedDesc = cleanModelDescription(description);
  const cleanTags = [...new Set(tags.map(t => t.trim().toUpperCase()))].filter(
    t => t && t.toLowerCase() !== marker.toLowerCase()
  );

  return <Card className="h-full min-w-0 overflow-hidden" style={{ padding: 0 }}>
    <button type="button" aria-label={`View ${title}`} onClick={onOpen} className="w-full h-full text-left p-4 flex flex-col gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-color)] rounded-[var(--radius-card)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer">
      <div className="flex items-center gap-3">
        <CatalogueLogo source={source} base={imageBase} name={title} icon={icon} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-5 break-words">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{subtitle}</p>}
        </div>
        <Badge variant="outline" className="text-[10px] font-semibold shrink-0 uppercase tracking-wider">{marker}</Badge>
      </div>
      {/* Capability Tags directly under Header (Above description) */}
      <CatalogueTags values={cleanTags} />
      {/* Sanitized Short Description under Tags */}
      <p className="text-xs leading-5 text-[var(--text-secondary)] line-clamp-2 min-h-10">
        {sanitizedDesc || 'Open this package to view available details.'}
      </p>
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

export { CatalogueStickyHeader, type CatalogueStickyHeaderProps } from './CatalogueStickyHeader';
