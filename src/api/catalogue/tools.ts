import { readPublicCatalogue } from './public';
export type RegistryKind = 'plugin' | 'skill' | 'mcp' | 'extension';
export interface RegistryTool { id: string; kind: RegistryKind; manifest: string; }
export interface RegistryDetails { name: string; description: string; version: string; build: string;
  icon: string; tags: string[]; os: string[]; updated: string; author: string; }
const ROOT = 'https://raw.githubusercontent.com/cluaiz/cluaiz-tools/main/';
const categories = { plugins: 'plugin', skills: 'skill', mcp: 'mcp', extensions: 'extension' } as const;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown) => typeof v === 'string' ? v.slice(0, 4096) : '';
function path(value: unknown): string {
  if (typeof value !== 'string' || value.length > 256 || value.split('/').some(part => !/^[\w.-]+$/.test(part) || part === '.' || part === '..')) throw new Error('Invalid registry path');
  return value;
}
function routing(value: unknown) {
  if (!object(value) || !object(value.routing)) throw new Error('Invalid tools registry');
  const pointers = value.routing;
  const entries = Object.entries(categories).flatMap(([category, kind]) => {
    // Published v1 still calls UI extensions "souls". This is metadata compatibility, not permission to execute them.
    const source = category === 'extensions' && pointers.extensions === undefined ? 'souls' : category;
    return pointers[source] === undefined ? [] : [{ category: source, kind, path: path(pointers[source]) }];
  });
  if (!entries.length) throw new Error('No supported tool categories were published');
  return entries;
}
export function parseToolFamily(value: unknown, category: string, kind: RegistryKind): RegistryTool[] {
  if (!object(value) || value.category !== category || !object(value.items) || Object.keys(value.items).length > 1024) throw new Error('Invalid tool family');
  return Object.entries(value.items).map(([id, item]) => {
    if (!id.trim() || id.length > 256 || /[\x00-\x1f\x7f]/.test(id)) throw new Error('Invalid tool identity');
    let manifest: string;
    if (typeof item === 'string') manifest = `${ROOT}${category}/${path(item)}`;
    else if (object(item) && item.type === 'local') manifest = `${ROOT}${category}/${path(item.path)}`;
    else if (object(item) && item.type === 'remote' && typeof item.repo === 'string' && /^[\w.-]+\/[\w.-]+$/.test(item.repo)
      && !item.repo.split('/').some(part => part === '.' || part === '..')) {
      manifest = `https://raw.githubusercontent.com/${item.repo}/${path(item.branch)}/${path(item.manifest_path)}`;
    } else throw new Error('Unsupported tool source');
    return { id, kind, manifest };
  });
}
export const toolCatalogue = {
  list: async (refresh = false) => {
    const root = await readPublicCatalogue(ROOT + 'registry.json', routing, refresh);
    const results = await Promise.allSettled(root.data.map(entry => readPublicCatalogue(ROOT + entry.path,
      value => parseToolFamily(value, entry.category, entry.kind), refresh)));
    const families = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    if (!families.length) throw new Error('No published tool family could be loaded');
    const errors = results.flatMap((result, i) => result.status === 'rejected' ? [`${root.data[i].category} catalogue unavailable: ${String(result.reason)}`] : []);
    return { data: families.flatMap(family => family.data), saved: Math.min(root.saved, ...families.map(f => f.saved)),
      warning: [root.warning, ...families.map(f => f.warning), ...errors].filter(Boolean).join(' ') || undefined };
  },
  details: (tool: RegistryTool) => readPublicCatalogue(tool.manifest, value => {
    if (!object(value) || value.id !== tool.id
      || (value.hub_type !== tool.kind && !(tool.kind === 'extension' && value.hub_type === 'soul'))) throw new Error('Registry package identity does not match');
    const version = text(value.latest_version);
    const release = object(value.versions) && object(value.versions[version]) ? value.versions[version] as Record<string, unknown> : {};
    const strings = (v: unknown) => Array.isArray(v) ? v.filter((item): item is string => typeof item === 'string').slice(0, 64) : [];
    return { name: text(value.name) || tool.id, description: text(value.description), version, build: text(value.build_type),
      icon: text(value.icon) || text(value.logo), tags: strings(value.tags),
      os: [...new Set([...strings(release.builds_os), ...(object(release.os) ? Object.keys(release.os) : [])])],
      updated: text(release.updated_at), author: object(value.author) ? text(value.author.name) : text(value.author) };
  }),
};
