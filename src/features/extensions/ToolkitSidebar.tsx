import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Cpu,
  Zap,
  Blocks,
  Boxes,
  Search,
  ChevronRight,
  Wrench,
  ArrowLeft,
  Layers,
  Globe,
  ArrowDownWideNarrow,
} from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { useToolkitSummary } from './useToolkitSummary';
import { toolkitSection, type ToolkitSectionId } from './toolkitNavigation';
import { useToolkitNavStore } from './toolkitStore';
import { useLayoutStore } from '../../store/ui/useLayoutStore';
import { pushViewRoute } from '../../core/router';
import { useCatalogue } from './useCatalogue';
import { modelCatalogue, type PublicModel } from '../../api/catalogue/models';
import { catalogueImage } from './catalogueView';
import { useModelCatalogueStore } from './modelCatalogueStore';
import { MultiLevelDropdown, type MultiLevelCategory } from '../../components/ui/dropdown';

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

/** Contextual Second Sidebar for AI Models Families Directory (Image 2) */
function ModelsSidebarDirectory({ onBack }: { onBack?: () => void }) {
  const catalogue = useCatalogue(modelCatalogue.list);
  const models = catalogue.reply?.data ?? [];
  const scrollReveal = useScrollReveal({ amount: 0.15, scale: 0.96 });

  const {
    family,
    setFamily,
    setSelectedModel,
    query,
    setQuery,
    providers,
    setProviders,
    task,
    setTask,
    format,
    setFormat,
    sort,
    setSort,
    clearFilters,
  } = useModelCatalogueStore();

  const families = useMemo(() => {
    const map = new Map<string, { family: string; provider: string; logo: string; count: number }>();
    for (const m of models) {
      if (!m.family) continue;
      const existing = map.get(m.family);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(m.family, {
          family: m.family,
          provider: m.provider || 'Open Source',
          logo: m.logo,
          count: 1,
        });
      }
    }
    return Array.from(map.values());
  }, [models]);

  const allTasks = useMemo(() => {
    const set = new Set<string>();
    for (const m of models) {
      for (const t of m.tasks || []) {
        if (t) set.add(t);
      }
    }
    return Array.from(set).sort();
  }, [models]);

  const allProviders = useMemo(() => {
    return [...new Set(models.map(m => m.provider).filter(Boolean))].sort();
  }, [models]);

  const activeFilterCount = (format ? 1 : 0) + (task ? 1 : 0) + providers.length + (sort !== 'popular' ? 1 : 0);

  const categories: MultiLevelCategory[] = [
    {
      id: 'format',
      label: 'Model Format',
      icon: Layers,
      options: [
        { value: '', label: 'All Formats' },
        { value: 'gguf', label: 'GGUF' },
        { value: 'onnx', label: 'ONNX' },
      ],
      selectedValue: format,
      onSelect: (val) => setFormat(val),
    },
    {
      id: 'task',
      label: 'Capabilities',
      icon: Sparkles,
      options: [
        { value: '', label: 'All Capabilities' },
        ...allTasks.map(t => ({ value: t, label: t })),
      ],
      selectedValue: task,
      onSelect: (val) => setTask(val),
    },
    {
      id: 'providers',
      label: 'Providers',
      icon: Globe,
      isMultiSelect: true,
      options: allProviders.map(p => ({ value: p, label: p })),
      selectedValue: providers,
      onSelect: (val) => {
        setProviders(prev => prev.includes(val) ? prev.filter(p => p !== val) : [...prev, val]);
      },
    },
    {
      id: 'sort',
      label: 'Sort By',
      icon: ArrowDownWideNarrow,
      options: [
        { value: 'popular', label: 'Popular' },
        { value: 'newest', label: 'Newest' },
        { value: 'oldest', label: 'Oldest' },
        { value: 'name', label: 'Name' },
      ],
      selectedValue: sort,
      onSelect: (val) => setSort(val as any),
    },
  ];

  const filteredFamilies = families.filter(item => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return item.family.toLowerCase().includes(q) || item.provider.toLowerCase().includes(q);
  });

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-[var(--bg-secondary)] font-sans">
      {/* 1. Section Header: Title & Subtitle */}
      <div className="p-3.5 pb-2.5 border-b border-[var(--border-color)] space-y-0.5">
        <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
          AI Models
        </h2>
        <p className="text-xs text-[var(--text-muted)]">
          Find a model for your Engine.
        </p>
      </div>

      {/* 2. Search & Filters Bar */}
      <div className="p-2.5 flex items-center gap-2 border-b border-[var(--border-color)]">
        <div className="flex-1 min-w-0">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search families…"
            leftIcon={<Search className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
            wrapperClassName="w-full"
          />
        </div>
        <MultiLevelDropdown
          categories={categories}
          activeCount={activeFilterCount}
          onClearAll={clearFilters}
          iconOnly
        />
      </div>

      {/* 3. Families Directory List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {filteredFamilies.map((item) => {
          const isSelected = family === item.family;
          const resolvedLogo = catalogueImage(item.logo || '');

          return (
            <motion.button
              key={item.family}
              {...scrollReveal}
              type="button"
              onClick={() => {
                setFamily(family === item.family ? '' : item.family);
                setSelectedModel(null);
              }}
              className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer group ${
                isSelected
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/60 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[var(--bg-tertiary)] border border-[var(--border-color)]/60 overflow-hidden">
                  {resolvedLogo ? (
                    <img
                      src={resolvedLogo}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-5 h-5 object-contain"
                    />
                  ) : (
                    <Sparkles className="w-4 h-4 text-[var(--accent-color)]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold leading-4 truncate text-[var(--text-primary)]">
                    {item.family}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] leading-3 truncate mt-0.5">
                    {item.provider}
                  </div>
                </div>
              </div>

              <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded text-[var(--text-muted)] shrink-0 ml-2">
                {item.count}
              </span>
            </motion.button>
          );
        })}

        {filteredFamilies.length === 0 && (
          <div className="p-4 text-center text-xs text-[var(--text-muted)]">
            No families match &ldquo;{query}&rdquo;
          </div>
        )}
      </div>

      {/* 4. Footer Status Indicator */}
      <div className="p-2.5 border-t border-[var(--border-color)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{families.length} Families</span>
        </span>
        <span className="text-[10px] font-mono">{models.length} models</span>
      </div>
    </div>
  );
}

export const ToolkitSidebar: React.FC = () => {
  const summary = useToolkitSummary();
  const scrollReveal = useScrollReveal({ amount: 0.15, scale: 0.96 });
  const {
    activeSection,
    showSectionPicker,
    setActiveSection,
    setShowSectionPicker,
  } = useToolkitNavStore();
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
  }, [setActiveSection]);

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

  // If in Models section and not in picker mode, render Models Directory (Image 2)
  if (activeSection === 'models' && !showSectionPicker) {
    return <ModelsSidebarDirectory onBack={() => setShowSectionPicker(true)} />;
  }

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

        {filteredItems.map((item) => {
          const Icon = item.icon;
          const { count } = item.getCount(summary);
          const isActive = activeSection === item.id;

          return (
            <motion.button
              key={`${item.id}-${item.title}`}
              {...scrollReveal}
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
            </motion.button>
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
