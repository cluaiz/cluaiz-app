import { modelInstallReference, type PublicModel, type PublicVariant } from '../../api/catalogue/models';
import type { RegistryDetails, RegistryTool } from '../../api/catalogue/tools';
import type { ModelRegistryEntry } from '../../api/engine/models/models.types';

export type CatalogueSort = 'popular' | 'newest' | 'oldest' | 'name';
export interface ModelFilters { query: string; providers: string[]; capabilities: string[]; format: string; sort: CatalogueSort; family: string; }
/** Keep explicit choices, but do not default to an unusable metadata/imatrix entry. */
export function chooseModelVariant(model: PublicModel, variants: PublicVariant[], chosen?: string): PublicVariant | undefined {
  const selected = variants.find(variant => variant.id === chosen);
  if (selected) return selected;
  return variants.find(variant => {
    try { modelInstallReference(model, variant); return true; }
    catch { return false; }
  }) ?? variants[0];
}
/** Catalogue references and Engine-installed IDs differ; match actual repo/primary file. */
export function installedModelForVariant(installed: ModelRegistryEntry[], model: PublicModel, variant?: PublicVariant): ModelRegistryEntry | undefined {
  if (!variant) return;
  return installed.find(entry => entry.huggingface_repo === model.repo
    && (entry.format_type ?? entry.format) === variant.format
    && Array.isArray(entry.files) && entry.files.some(file => file?.is_primary === true && file.name === variant.file));
}
const lower = (value: string) => value.toLocaleLowerCase().trim();
const date = (value: string) => { const result = Date.parse(value); return Number.isFinite(result) ? result : null; };
function compareOptional(a: number | null, b: number | null, descending: boolean) {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return descending ? b - a : a - b;
}
export function filterModels(models: PublicModel[], filters: ModelFilters): PublicModel[] {
  const query = lower(filters.query);
  return models.filter(model => (!filters.family || model.family === filters.family)
    && (!filters.providers.length || filters.providers.includes(model.provider))
    && (!filters.capabilities.length || model.tasks.some(task => filters.capabilities.includes(task)))
    && (!filters.format || model.variants.some(variant => variant.format === filters.format))
    && (!query || lower([model.name, model.id, model.family, model.provider, model.repo, model.description, model.architecture, ...model.tasks].join(' ')).includes(query)))
    .sort((a, b) => {
      const difference = filters.sort === 'popular' ? compareOptional(a.downloads, b.downloads, true)
        : filters.sort === 'name' ? 0 : compareOptional(date(a.created), date(b.created), filters.sort === 'newest');
      return difference || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    });
}

/** Clean raw HTML snippets (like <img>, <ul>, <li>) from model descriptions. */
export function cleanModelDescription(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract deduplicated, normalized capability task tags from a family's models. */
export function extractFamilyCapabilities(models: PublicModel[]): string[] {
  const tasks = new Set<string>();
  for (const model of models) {
    for (const t of model.tasks) {
      if (t && typeof t === 'string') {
        const normalized = t.trim().toUpperCase();
        if (normalized) tasks.add(normalized);
      }
    }
  }
  return Array.from(tasks);
}

/** An image element is an image boundary; remote markup is never injected into the App DOM. */
export function catalogueImage(source: string, base = 'https://cluaiz.com'): string | undefined {
  if (!source) return;
  try {
    const url = new URL(source, base);
    const host = url.hostname;
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return;
    if (host !== 'cluaiz.com' && !host.endsWith('.cluaiz.com') && host !== 'raw.githubusercontent.com'
      && host !== 'huggingface.co' && !/^pub-[a-z0-9]+\.r2\.dev$/.test(host)) return;
    return url.href;
  } catch { return; }
}

export interface ToolRow { tool: RegistryTool; details?: RegistryDetails; error?: string; }
export function filterTools(rows: ToolRow[], filters: { query: string; kind: string; build: string; os: string; sort: string }): ToolRow[] {
  const query = lower(filters.query);
  return rows.filter(({ tool, details }) => (!filters.kind || tool.kind === filters.kind)
    && (!filters.build || details?.build === filters.build)
    && (!filters.os || details?.os.some(os => lower(os) === lower(filters.os)))
    && (!query || lower([tool.id, details?.name, details?.description, details?.author, ...(details?.tags ?? [])].join(' ')).includes(query)))
    .sort((a, b) => (filters.sort === 'newest' ? compareOptional(date(a.details?.updated ?? ''), date(b.details?.updated ?? ''), true) : 0)
      || (a.details?.name || a.tool.id).localeCompare(b.details?.name || b.tool.id));
}
