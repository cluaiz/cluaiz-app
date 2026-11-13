import { readPublicCatalogue } from './public';
export type RegistryKind = 'plugin' | 'skill' | 'mcp' | 'extension';
export interface RegistryTool { id: string; kind: RegistryKind; manifest: string; }
export interface RegistryDetails { name: string; description: string; version: string; build: string;
  icon: string; tags: string[]; os: string[]; updated: string; author: string;
  license: string; triggers: string[]; functions: string[];
  /** The command the Engine runs (MCP servers, executable skills) */
  command: string;
  /** Network access the package asks for: why, and the hosts */
  network: { info: string; hosts: string[] } | null;
  /** Environment settings it reads, and whether each is required */
  env: { name: string; need: string; info: string }[];
  /** The manifest as published (package.json), for reading */
  manifest: string; }
const ROOT = 'https://raw.githubusercontent.com/cluaiz/cluaiz-tools/main/';
/** Files read as bytes, not text: never fetched for the package file reader */
const BINARY = /\.(wasm|png|jpe?g|gif|webp|ico|zip|gz|tar|exe|dll|so|dylib|onnx|gguf|bin|pdf|woff2?|ttf)$/i;
/** The repository, branch and folder (ending in '/') a package's manifest is published in */
function packageFolder(tool: RegistryTool) {
  const match = /^https:\/\/raw\.githubusercontent\.com\/([\w.-]+\/[\w.-]+)\/([\w.-]+)\/(.*\/)?[^/]+$/.exec(tool.manifest);
  if (!match) throw new Error('This package is not published on GitHub');
  return { repo: match[1], branch: match[2], folder: match[3] ?? '' };
}
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
  /** The published packages of one kind (all kinds when left out), each with its manifest's details where it could be read */
  packages: async (kind?: RegistryKind, refresh = false) => {
    const list = await toolCatalogue.list(refresh);
    const tools = list.data.filter(tool => !kind || tool.kind === kind);
    const details = await Promise.allSettled(tools.map(tool => toolCatalogue.details(tool, refresh)));
    return { data: tools.map((tool, i) => {
      const result = details[i];
      return { tool, details: result.status === 'fulfilled' ? result.value.data : undefined };
    }), saved: list.saved, warning: list.warning };
  },
  details: (tool: RegistryTool, refresh = false) => readPublicCatalogue(tool.manifest, value => {
    if (!object(value) || value.id !== tool.id
      || (value.hub_type !== tool.kind && !(tool.kind === 'extension' && value.hub_type === 'soul'))) throw new Error('Registry package identity does not match');
    const version = text(value.latest_version);
    const release = object(value.versions) && object(value.versions[version]) ? value.versions[version] as Record<string, unknown> : {};
    const strings = (v: unknown) => Array.isArray(v) ? v.filter((item): item is string => typeof item === 'string').slice(0, 64) : [];
    return { name: text(value.name) || tool.id, description: text(value.description), version, build: text(value.build_type),
      icon: text(value.icon) || text(value.logo), tags: strings(value.tags),
      os: [...new Set([...strings(release.builds_os), ...(object(release.os) ? Object.keys(release.os) : [])])],
      updated: text(release.updated_at), author: object(value.author) ? text(value.author.name) : text(value.author),
      license: text(value.license), triggers: strings(value.triggers),
      functions: Array.isArray(value.functions) ? value.functions.flatMap(item => object(item) && text(item.name) ? [text(item.name)] : []).slice(0, 128) : [],
      command: object(value.execution) ? [text(value.execution.command), ...strings(value.execution.args)].filter(Boolean).join(' ') : '',
      network: object(value.permissions) && object(value.permissions.network) && value.permissions.network.allow !== false
        ? { info: text(value.permissions.network.info), hosts: strings(value.permissions.network.hosts) } : null,
      env: object(value.env) ? Object.entries(value.env).slice(0, 64).map(([name, item]) =>
        ({ name: name.slice(0, 128), need: object(item) ? text(item.need) : '', info: object(item) ? text(item.info) : '' })) : [],
      manifest: JSON.stringify(value, null, 2).slice(0, 256 * 1024) };
  }, refresh),
  /** The files of a published package: its folder in the repository's git tree, paths relative to that folder */
  files: async (tool: RegistryTool, refresh = false) => {
    const source = packageFolder(tool);
    const reply = await readPublicCatalogue(`https://api.github.com/repos/${source.repo}/git/trees/${source.branch}?recursive=1`, value => {
      if (!object(value) || !Array.isArray(value.tree)) throw new Error('Invalid repository file list');
      return value.tree.flatMap(item => object(item) && typeof item.path === 'string' && (item.type === 'blob' || item.type === 'tree')
        && item.path.startsWith(source.folder) ? [{ path: item.path.slice(source.folder.length), is_dir: item.type === 'tree' }] : [])
        .filter(item => item.path).slice(0, 2048)
        .map(item => ({ ...item, name: item.path.slice(item.path.lastIndexOf('/') + 1) }));
    }, refresh, value => object(value) && Array.isArray(value.tree) /* one saved list for every package of the repository */
      ? { tree: value.tree.flatMap(item => object(item) ? [{ path: item.path, type: item.type }] : []) } : value);
    return reply.data;
  },
  /** One text file of a published package; binary files are not read */
  file: async (tool: RegistryTool, path: string, refresh = false) => {
    if (path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid package file path');
    if (BINARY.test(path)) throw new Error('This is a binary file; it is not shown here.');
    const reply = await readPublicCatalogue(new URL(path, tool.manifest).href,
      value => typeof value === 'string' ? value : JSON.stringify(value, null, 2), refresh);
    return reply.data;
  },
  /** The package's README.md, published beside its manifest ('' when it has none) */
  readme: (tool: RegistryTool, refresh = false) => readPublicCatalogue(new URL('README.md', tool.manifest).href,
    value => typeof value === 'string' ? value.slice(0, 512 * 1024) : '', refresh),
};
