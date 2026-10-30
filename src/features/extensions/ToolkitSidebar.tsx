import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Cpu,
  Zap,
  Blocks,
  Boxes,
  Search,
  ChevronRight,
  Wrench,
} from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { useToolkitSummary } from './useToolkitSummary';
import { toolkitSection, type ToolkitSectionId } from './toolkitNavigation';
import { useLayoutStore } from '../../store/ui/useLayoutStore';
import { pushViewRoute } from '../../core/router';

interface NavItem {
  id: ToolkitSectionId;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  getCount: (summary: ReturnType<typeof useToolkitSummary>) => { label: string; count: number };
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'models',
    title: 'AI Models',
    subtitle: 'GGUF & ONNX weights',
    icon: Sparkles,
    iconColor: 'text-purple-400',
    getCount: summary => ({
      label: summary.models.installedCount > 0 ? `${summary.models.installedCount} inst` : 'models',
      count: summary.models.totalCount,
    }),
  },
  {
    id: 'mcp',
    title: 'MCP Servers',
    subtitle: 'MCP servers & bridges',
    icon: Cpu,
    iconColor: 'text-cyan-400',
    getCount: summary => ({
      label: 'mcp',
      count: summary.mcp.totalCount,
    }),
  },
  {
    id: 'skills',
    title: 'Agent Skills',
    subtitle: 'Autonomous workflows',
    icon: Zap,
    iconColor: 'text-amber-400',
    getCount: summary => ({
      label: 'skills',
      count: summary.skills.totalCount,
    }),
  },
  {
    id: 'plugins',
    title: 'Plugins & Tools',
    subtitle: 'Runtime plugins & tools',
    icon: Wrench,
    iconColor: 'text-emerald-400',
    getCount: summary => ({
      label: 'plugins',
      count: summary.plugins.totalCount,
    }),
  },
  {
    id: 'extensions',
    title: 'App Extensions',
    subtitle: 'Bundled applications',
    icon: Blocks,
    iconColor: 'text-blue-400',
    getCount: summary => ({
      label: 'ext',
      count: summary.extensions.totalCount,
    }),
  },
  {
    id: 'components',
    title: 'UI SDK & Showroom',
    subtitle: 'Generative UI widgets',
    icon: Boxes,
    iconColor: 'text-pink-400',
    getCount: summary => ({
      label: 'suites',
      count: summary.components.totalCount,
    }),
  },
];

export const ToolkitSidebar: React.FC = () => {
  const summary = useToolkitSummary();
  const [activeSection, setActiveSection] = useState<ToolkitSectionId>(() =>
    typeof window !== 'undefined' ? toolkitSection(window.location.search) : 'models'
  );
  const [search, setSearch] = useState('');

  // Listen to popstate or custom section changes
  useEffect(() => {
    const sync = () => {
      setActiveSection(toolkitSection(window.location.search));
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('toolkit-section-change', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('toolkit-section-change', sync);
    };
  }, []);

  const handleSelect = (sectionId: ToolkitSectionId) => {
    setActiveSection(sectionId);

    // 1. Ensure Toolkit view is active in layout store
    if (useLayoutStore.getState().activeView !== 'toolkit') {
      useLayoutStore.getState().setActiveView('toolkit');
      pushViewRoute('toolkit');
    }

    // 2. Update search parameter
    const url = new URL(window.location.href);
    url.pathname = '/toolkit';
    url.hash = '';
    url.searchParams.set('section', sectionId);
    window.history.pushState(window.history.state, '', url);

    // 3. Dispatch notification event for ToolkitWorkspace
    window.dispatchEvent(new CustomEvent('toolkit-section-change', { detail: { section: sectionId } }));
  };

  const query = search.trim().toLowerCase();
  const filteredItems = NAV_ITEMS.filter(
    item =>
      !query ||
      item.title.toLowerCase().includes(query) ||
      item.subtitle.toLowerCase().includes(query)
  );

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-[var(--bg-secondary)] font-sans">
      {/* 1. Quick Search Box */}
      <div className="p-3 border-b border-[var(--border-color)]">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter toolkit items…"
          leftIcon={<Search className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
        />
      </div>

      {/* 2. Categorized Navigation List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
          Capabilities & Assets
        </div>

        {filteredItems.map((item, idx) => {
          const Icon = item.icon;
          const { count, label } = item.getCount(summary);
          const isActive = activeSection === item.id;

          return (
            <button
              key={`${item.id}-${item.title}`}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all cursor-pointer group ${
                isActive
                  ? 'bg-[var(--accent-color)]/10 text-[var(--text-primary)] font-semibold border-l-2 border-[var(--accent-color)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                    isActive ? 'bg-[var(--accent-color)]/20' : 'bg-[var(--bg-tertiary)] group-hover:bg-[var(--bg-primary)]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${item.iconColor}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs leading-4 truncate font-medium">{item.title}</div>
                  <div className="text-[10px] text-[var(--text-muted)] leading-3 truncate mt-0.5">
                    {item.subtitle}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-2">
                {count > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-color)]">
                    {count}
                  </span>
                )}
                <ChevronRight
                  className={`w-3 h-3 transition-transform ${
                    isActive
                      ? 'text-[var(--accent-color)] translate-x-0.5'
                      : 'text-[var(--text-muted)] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5'
                  }`}
                />
              </div>
            </button>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="p-4 text-center text-xs text-[var(--text-muted)]">
            No toolkit items match &ldquo;{search}&rdquo;
          </div>
        )}
      </div>

      {/* 3. Footer Status Indicator */}
      <div className="p-2.5 border-t border-[var(--border-color)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              summary.engineConnected ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <span>{summary.engineConnected ? 'Engine Ready' : 'Engine Offline'}</span>
        </span>
        <span className="text-[10px] font-mono">{summary.models.totalCount} models</span>
      </div>
    </div>
  );
};
