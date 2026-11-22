import { useState, type ReactNode } from 'react';
import { FolderOpen, Info } from 'lucide-react';
import type { RegistryKind } from '../../api/catalogue/tools';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Tabs } from '../../components/ui/Tabs';
import { ToolInspectorModal, type PackageFiles, type ToolComponent } from '../settings/ToolInspectorModal';
import type { ToolPackage } from './toolPackages';

type DetailsTab = 'details' | 'files';

/** Build names as people say them */
const BUILDS: Record<string, string> = { wasm: 'WebAssembly' };

const Chips = ({ values, mono = false }: { values: string[]; mono?: boolean }) =>
    <div className="flex flex-wrap gap-1.5">
        {values.map(value => <span key={value} className={`rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)] ${mono ? 'font-mono' : ''}`}>{value}</span>)}
    </div>;

/**
 * What a package is, in rows a new user can read: only facts the package states, empty rows left out
 * (no "Not listed"). The package id is in the header above and run mode and approvals are in Manage,
 * so they are not repeated here.
 */
function detailRows(item: ToolPackage, kind: RegistryKind, version: string): [string, ReactNode][] {
    const { details, installed } = item;
    const build = details?.build ? BUILDS[details.build] ?? details.build : '';
    const systems = (details?.os ?? []).filter(os => os !== 'wasm');
    const functions = details?.functions?.length ? details.functions : installed?.functions.map(fn => fn.name) ?? [];
    const about = [version && `Version ${version}`, details?.author && `by ${details.author}`, details?.license,
        details?.updated && `updated ${details.updated.slice(0, 10)}`].filter(Boolean).join(' · ');
    const type = [kind && kind[0].toUpperCase() + kind.slice(1), build,
        details?.build === 'wasm' && !systems.length && 'runs on any system'].filter(Boolean).join(' · ');
    const rows: [string, ReactNode][] = [
        ['About', about],
        ['Type', type],
        ['Gives the AI', functions.length ? <Chips values={functions} mono /> : ''],
        ['Internet', details?.network ? `${details.network.hosts.length ? details.network.hosts.join(', ') : 'Any site'}${details.network.info ? `: ${details.network.info}` : ''}` : ''],
        ['API keys it can use', details?.env.length ? <Chips mono values={details.env.map(env => `${env.name}${env.need === 'required' ? '' : ' (optional)'}`)} /> : ''],
        ['Used when you ask', details?.triggers.length ? <Chips values={details.triggers} /> : ''],
        ['Works on', systems.join(', ')],
        ['Command', details?.command ? <code className="font-mono text-xs break-all">{details.command}</code> : ''],
    ];
    return rows.filter(([, value]) => value !== '' && value !== undefined);
}

/**
 * The package's details and its files in one card with two tabs, so the page stays short; the README
 * stays below the card. Files are the Engine's once installed, else the published ones.
 */
export function ToolPackageDetails({ item, kind, version, inspected, published }: {
    item: ToolPackage; kind: RegistryKind; version: string; inspected: ToolComponent; published?: PackageFiles;
}) {
    const [tab, setTab] = useState<DetailsTab>('details');
    const hasFiles = Boolean(item.installed || published);
    const rows = detailRows(item, kind, version);
    return <Card>
        <CardHeader className="pb-0">
            <Tabs<DetailsTab> variant="underline" bordered={false} value={tab} onChange={setTab}
                items={[{ id: 'details', label: 'Details', icon: Info }, ...(hasFiles ? [{ id: 'files' as const, label: 'Files', icon: FolderOpen }] : [])]} />
        </CardHeader>
        <CardContent className="pt-4">
            {tab === 'files' && hasFiles
                ? <ToolInspectorModal embedded tool={inspected} source={item.installed ? undefined : published} onClose={() => {}} />
                : <dl className="divide-y divide-[var(--border-color)]">
                    {rows.map(([label, value]) => <div key={label} className="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr] sm:gap-4">
                        <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
                        <dd className="min-w-0 text-sm text-[var(--text-primary)] break-words">{value}</dd>
                    </div>)}
                </dl>}
        </CardContent>
    </Card>;
}
