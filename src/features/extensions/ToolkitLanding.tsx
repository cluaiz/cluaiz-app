import { useState } from 'react';
import {
  ArrowRight,
  Boxes,
  Blocks,
  Cpu,
  RefreshCw,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CatalogueCard, CatalogueLogo, CatalogueSearch } from './CatalogueUI';
import { useToolkitSummary } from './useToolkitSummary';
import { openExtensionWorkspace } from '../../extensions/navigation';

export interface ToolkitLandingProps {
  onSelectSection(section: 'models' | 'tools' | 'extensions' | 'components', filterParams?: { kind?: string }): void;
}

export function ToolkitLanding({ onSelectSection }: ToolkitLandingProps) {
  const summary = useToolkitSummary();
  const [search, setSearch] = useState('');

  const filterQuery = search.trim().toLowerCase();

  return (
    <div className="mx-auto w-full max-w-7xl p-5 sm:p-6 space-y-8">
      {/* 1. Hero Overview Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[var(--border-color)]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/25 flex items-center justify-center text-[var(--accent-color)]">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Toolkit Hub
            </h1>
            <Badge variant="outline" className="text-[10px] uppercase font-mono">
              Unified
            </Badge>
          </div>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Explore, install, and manage AI Models, MCP Servers, Agent Skills, Extensions, and UI SDK in one place.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={summary.refresh}
            className="flex items-center gap-1.5"
            title="Refresh catalogue inventories"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh All</span>
          </Button>
        </div>
      </div>

      {/* Engine Status Banner (if offline) */}
      {!summary.engineConnected && summary.engineError && (
        <div
          role="alert"
          className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-300 text-xs flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="truncate">
              Engine connection offline. Catalogue items are available for browsing; local installation requires the Engine.
            </span>
          </div>
          <Badge variant="secondary" className="text-[10px] shrink-0">Offline Mode</Badge>
        </div>
      )}

      {/* 2. Quick KPI Statistics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => onSelectSection('models')}
          className="text-left p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent-color)]/40 transition-all flex flex-col gap-1.5 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">AI Models</span>
            <Sparkles className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-[var(--text-primary)]">{summary.models.totalCount}</span>
            <span className="text-[10px] text-[var(--text-muted)]">avail</span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] truncate flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
            <span>{summary.models.installedCount} installed</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('tools', { kind: 'mcp' })}
          className="text-left p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent-color)]/40 transition-all flex flex-col gap-1.5 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">MCP Servers</span>
            <Cpu className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-[var(--text-primary)]">{summary.mcp.totalCount}</span>
            <span className="text-[10px] text-[var(--text-muted)]">avail</span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] truncate flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
            <span>{summary.mcp.installedCount} active</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('tools', { kind: 'skill' })}
          className="text-left p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent-color)]/40 transition-all flex flex-col gap-1.5 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">Agent Skills</span>
            <Zap className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-[var(--text-primary)]">{summary.skills.totalCount}</span>
            <span className="text-[10px] text-[var(--text-muted)]">avail</span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] truncate flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
            <span>{summary.skills.installedCount} active</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('extensions')}
          className="text-left p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent-color)]/40 transition-all flex flex-col gap-1.5 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">Extensions</span>
            <Blocks className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-[var(--text-primary)]">{summary.extensions.totalCount}</span>
            <span className="text-[10px] text-[var(--text-muted)]">bundled</span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] truncate">Integrated</div>
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('components')}
          className="col-span-2 sm:col-span-1 text-left p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent-color)]/40 transition-all flex flex-col gap-1.5 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">UI SDK</span>
            <Boxes className="w-3.5 h-3.5 text-pink-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-[var(--text-primary)]">{summary.components.totalCount}</span>
            <span className="text-[10px] text-[var(--text-muted)]">suites</span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] truncate">Components</div>
        </button>
      </div>

      {/* 3. Global Filter Input */}
      <div className="flex items-center gap-3">
        <CatalogueSearch
          value={search}
          onChange={setSearch}
          placeholder="Filter across models, MCP servers, skills, plugins, or UI components…"
        />
        {search && (
          <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
            Clear
          </Button>
        )}
      </div>

      {/* 4. Section 1: AI Inference Models */}
      <section className="space-y-3.5 pt-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">AI Models</h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Local GGUF & ONNX neural weights with zero-latency execution.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectSection('models')}
            className="text-xs text-[var(--accent-color)] flex items-center gap-1 hover:gap-1.5 transition-all"
          >
            <span>View all ({summary.models.totalCount})</span>
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summary.models.featured
            .filter(m => !filterQuery || m.name.toLowerCase().includes(filterQuery) || m.family.toLowerCase().includes(filterQuery) || m.provider.toLowerCase().includes(filterQuery))
            .map(model => (
              <CatalogueCard
                key={model.id}
                title={model.name || model.id}
                subtitle={model.provider}
                source={model.logo}
                icon={Sparkles}
                marker={`${model.variants.length} packages`}
                description={model.description || model.familyDescription || 'Inference package for local execution.'}
                tags={model.tasks}
                identity={model.family}
                meta={model.architecture}
                onOpen={() => onSelectSection('models')}
              />
            ))}
        </div>
      </section>

      {/* 5. Section 2: MCP Servers */}
      <section className="space-y-3.5 pt-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Cpu className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">MCP Servers</h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Standard protocol bridging the engine to external databases, APIs, and runtime environments.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectSection('tools', { kind: 'mcp' })}
            className="text-xs text-[var(--accent-color)] flex items-center gap-1 hover:gap-1.5 transition-all"
          >
            <span>Explore MCP ({summary.mcp.totalCount})</span>
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summary.mcp.featured
            .filter(t => !filterQuery || t.id.toLowerCase().includes(filterQuery))
            .map(tool => (
              <CatalogueCard
                key={tool.id}
                title={tool.id.replace('mcp-', '').toUpperCase()}
                subtitle="Model Context Protocol"
                icon={Cpu}
                marker="mcp"
                description={`External data bridge and tool provider (${tool.id}) connected via stdio or SSE.`}
                tags={['mcp', 'tools', 'bridge']}
                identity={tool.id}
                onOpen={() => onSelectSection('tools', { kind: 'mcp' })}
              />
            ))}
        </div>
      </section>

      {/* 6. Section 3: Agent Skills */}
      <section className="space-y-3.5 pt-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Agent Skills</h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Structured domain instructions and workflows executing deterministically.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectSection('tools', { kind: 'skill' })}
            className="text-xs text-[var(--accent-color)] flex items-center gap-1 hover:gap-1.5 transition-all"
          >
            <span>View all skills ({summary.skills.totalCount})</span>
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summary.skills.featured
            .filter(t => !filterQuery || t.id.toLowerCase().includes(filterQuery))
            .map(tool => (
              <CatalogueCard
                key={tool.id}
                title={tool.id.replace('skill-', '').replace(/-/g, ' ').toUpperCase()}
                subtitle="Agent Workflow"
                icon={Zap}
                marker="skill"
                description={`Autonomous capability package: ${tool.id}. Enhances problem-solving context.`}
                tags={['skill', 'workflow', 'prompt']}
                identity={tool.id}
                onOpen={() => onSelectSection('tools', { kind: 'skill' })}
              />
            ))}
        </div>
      </section>

      {/* 7. Section 4: System Plugins & Extensions */}
      <section className="space-y-3.5 pt-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Blocks className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Plugins & Extensions</h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Bundled workspace applications and native sandboxed extensions.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectSection('extensions')}
            className="text-xs text-[var(--accent-color)] flex items-center gap-1 hover:gap-1.5 transition-all"
          >
            <span>Manage extensions ({summary.extensions.totalCount})</span>
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {summary.extensions.items
            .filter(ext => !filterQuery || ext.name.toLowerCase().includes(filterQuery) || ext.id.toLowerCase().includes(filterQuery))
            .map(entry => (
              <Card key={entry.id} className="min-w-0" style={{ padding: 16 }}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <CatalogueLogo name={entry.name} icon={Blocks} />
                      <div>
                        <CardTitle className="text-sm font-semibold">{entry.name}</CardTitle>
                        <CardDescription className="text-[10px]">{entry.id} · v{entry.version}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">Bundled</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-2">
                  <p className="text-xs text-[var(--text-secondary)]">
                    Native application extension integrated into Cluaiz workspace.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {entry.contributes.views.map(view => (
                      <Button
                        key={view.id}
                        variant="outline"
                        size="sm"
                        onClick={() => openExtensionWorkspace({ extensionId: entry.id, viewId: view.id })}
                        className="text-xs"
                      >
                        Open {view.title}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </section>

      {/* 8. Section 5: Generative UI Components & SDK */}
      <section className="space-y-3.5 pt-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
              <Boxes className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">UI Components & SDK</h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Reusable design primitives, generative widgets, code editors, and charts.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectSection('components')}
            className="text-xs text-[var(--accent-color)] flex items-center gap-1 hover:gap-1.5 transition-all"
          >
            <span>Open UI Showcase →</span>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summary.components.categories.map((category, idx) => (
            <button
              key={category}
              type="button"
              onClick={() => onSelectSection('components')}
              className="text-left p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent-color)]/40 transition-all flex items-center justify-between gap-3 cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-mono font-bold text-[var(--accent-color)] w-5 h-5 rounded-full bg-[var(--accent-color)]/10 flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                  {category}
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
