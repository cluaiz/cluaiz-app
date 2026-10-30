import { useEffect, useRef, useState } from 'react';
import { modelCatalogue, type PublicModel } from '../../api/catalogue/models';
import { toolCatalogue, type RegistryTool } from '../../api/catalogue/tools';
import { modelsApi } from '../../api/engine/models/models.api';
import type { ModelRegistryEntry } from '../../api/engine/models/models.types';
import { componentsApi } from '../../api';
import { workspaceExtensions } from '../../extensions/bundled';

export interface CategorySummary<T> {
  id: string;
  title: string;
  description: string;
  totalCount: number;
  installedCount: number;
  featured: T[];
  loading: boolean;
}

export interface ToolkitSummaryState {
  models: CategorySummary<PublicModel>;
  mcp: CategorySummary<RegistryTool>;
  skills: CategorySummary<RegistryTool>;
  plugins: CategorySummary<RegistryTool>;
  extensions: {
    totalCount: number;
    items: ReturnType<typeof workspaceExtensions.list>;
  };
  components: {
    totalCount: number;
    categories: string[];
  };
  engineConnected: boolean;
  engineError: string;
  refresh(): void;
}

const UI_SDK_CATEGORIES = [
  'Interactive Cards & Surfaces',
  'Buttons, Badges & Inputs',
  'Dropdowns & Menus',
  'Code Blocks & Terminal',
  'Mermaid & Charts',
  'Rich Audio & Modals',
];

export function useToolkitSummary(): ToolkitSummaryState {
  const [models, setModels] = useState<PublicModel[]>([]);
  const [installedModels, setInstalledModels] = useState<ModelRegistryEntry[]>([]);
  const [tools, setTools] = useState<RegistryTool[]>([]);
  const [installedComponents, setInstalledComponents] = useState<{
    skills: unknown[];
    plugins: unknown[];
    mcps: unknown[];
  }>({ skills: [], plugins: [], mcps: [] });
  const [engineConnected, setEngineConnected] = useState(false);
  const [engineError, setEngineError] = useState('');
  const [refreshIndex, setRefreshIndex] = useState(0);
  const scope = useRef(0);

  useEffect(() => {
    const version = ++scope.current;
    const controller = new AbortController();

    // 1. Fetch public catalogues (models + tools)
    void modelCatalogue.list(false).then(res => {
      if (scope.current === version) setModels(res.data);
    }).catch(() => {
      /* Catalogue fallback retains empty array */
    });

    void toolCatalogue.list(false).then(res => {
      if (scope.current === version) setTools(res.data);
    }).catch(() => {
      /* Catalogue fallback retains empty array */
    });

    // 2. Fetch local Engine status (installed models + components)
    void modelsApi.getInstalled(controller.signal).then(res => {
      if (scope.current === version) {
        setInstalledModels(res.installed || []);
        setEngineConnected(true);
        setEngineError('');
      }
    }).catch(err => {
      if (scope.current === version && !controller.signal.aborted) {
        setEngineConnected(false);
        setEngineError(String(err));
      }
    });

    void componentsApi.listComponents().then(data => {
      if (scope.current === version && data?.rich) {
        setInstalledComponents({
          skills: data.rich.skill || [],
          plugins: data.rich.plugin || [],
          mcps: data.rich.mcp || [],
        });
      }
    }).catch(() => {
      /* Gracefully handle offline Engine */
    });

    return () => {
      controller.abort();
    };
  }, [refreshIndex]);

  const mcpTools = tools.filter(t => t.kind === 'mcp');
  const skillTools = tools.filter(t => t.kind === 'skill');
  const pluginTools = tools.filter(t => t.kind === 'plugin');
  const bundledList = workspaceExtensions.list();

  return {
    models: {
      id: 'models',
      title: 'AI Models',
      description: 'Inference-ready open weights models (GGUF, ONNX) optimized for local and edge execution.',
      totalCount: models.length,
      installedCount: installedModels.length,
      featured: models.slice(0, 4),
      loading: models.length === 0,
    },
    mcp: {
      id: 'mcp',
      title: 'MCP Servers',
      description: 'Model Context Protocol servers connecting your AI agent to filesystem, databases, and APIs.',
      totalCount: mcpTools.length,
      installedCount: installedComponents.mcps.length,
      featured: mcpTools.slice(0, 4),
      loading: mcpTools.length === 0,
    },
    skills: {
      id: 'skills',
      title: 'Agent Skills',
      description: 'Specialized modular workflows and domain capabilities for autonomous agents.',
      totalCount: skillTools.length,
      installedCount: installedComponents.skills.length,
      featured: skillTools.slice(0, 4),
      loading: skillTools.length === 0,
    },
    plugins: {
      id: 'plugins',
      title: 'System Plugins',
      description: 'Extensions and tools executing native logic inside your workspace sandbox.',
      totalCount: pluginTools.length,
      installedCount: installedComponents.plugins.length,
      featured: pluginTools.slice(0, 4),
      loading: pluginTools.length === 0,
    },
    extensions: {
      totalCount: bundledList.length,
      items: bundledList,
    },
    components: {
      totalCount: UI_SDK_CATEGORIES.length,
      categories: UI_SDK_CATEGORIES,
    },
    engineConnected,
    engineError,
    refresh: () => setRefreshIndex(v => v + 1),
  };
}
