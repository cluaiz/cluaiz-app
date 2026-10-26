/** Build-time docs -> Explorer data. Markdown is the source; no Engine is started. */
import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseDocument } from 'yaml';

export const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultEngine = resolve(appRoot, '../cluaiz');
const outputFile = resolve(appRoot, 'public/data/api-catalog.json');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function readPage(text, path) {
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
    if (!match) return null;
    const yaml = parseDocument(match[1], { uniqueKeys: true });
    if (yaml.errors.length) throw Error(`${path}: ${yaml.errors[0].message}`);
    const header = yaml.toJS({ maxAliasCount: 0 });
    if (!object(header) || !Array.isArray(header.params)) throw Error(`${path}: missing params`);
    const isCep = header.transport === 'POST /v1/cep';
    if (!header.category || !header.summary || !header.method || (!isCep && !header.path)) {
        throw Error(`${path}: incomplete API metadata`);
    }
    const request = header.request_payload == null ? null : JSON.parse(header.request_payload);
    if (isCep && (request?.jsonrpc !== '2.0' || request.method !== header.method || !object(request.params))) {
        throw Error(`${path}: CEP example does not match the documented method`);
    }
    if (header.response != null) JSON.parse(header.response);
    return { header, request, body: text.slice(match[0].length), isCep };
}

/** Valid request-shaped JSON fences become input choices; response fragments do not. */
export function examplesFromBody(page) {
    const { header, request, body, isCep } = page;
    const examples = [];
    const seen = new Set();
    const add = (title, payload) => {
        const key = JSON.stringify(payload);
        if (seen.has(key)) return;
        seen.add(key);
        examples.push({ id: `example-${examples.length + 1}`, title, payload: JSON.stringify(payload, null, 2) });
    };
    if (request != null) add('Default request', request);
    const names = new Set(header.params.map(p => p.name));
    const required = header.params.filter(p => p.req).map(p => p.name);
    let title = 'Request example';
    let language = null;
    let lines = [];
    for (const line of body.split(/\r?\n/)) {
        const fence = /^\s*```(\w*)\s*$/.exec(line);
        if (fence) {
            if (language === null) { language = fence[1]; lines = []; continue; }
            if (language === 'json') {
                let value;
                try { value = JSON.parse(lines.join('\n')); } catch { /* Shortened examples stay in prose. */ }
                if (object(value)) {
                    if (value.jsonrpc === '2.0') {
                        if (isCep && value.method === header.method && object(value.params)) add(title, value);
                    } else if (Object.keys(value).length && Object.keys(value).every(key => names.has(key))
                        && required.every(key => key in value)) {
                        add(title, isCep ? { jsonrpc: '2.0', id: 1, method: header.method, params: value } : value);
                    }
                }
            }
            language = null;
            continue;
        }
        if (language !== null) lines.push(line);
        else if (/^#{2,4}\s/.test(line)) title = line.replace(/^#+\s+/, '').replace(/`/g, '');
    }
    return examples;
}

function snippets(body) {
    const result = [];
    const pattern = /```(bash|sh|python|js|javascript|typescript|c|cpp)\r?\n([\s\S]*?)\r?\n```/g;
    for (const [, language, code] of body.matchAll(pattern)) result.push({ language, title: language, code });
    return result;
}

export async function buildCatalog(engineRoot = defaultEngine) {
    const navigation = JSON.parse(await readFile(resolve(engineRoot, 'docs/registry.json'), 'utf8'));
    const api = navigation.find(section => section.id === 'api');
    if (!api) throw Error('Engine docs registry has no API section');
    const paths = [...new Set(api.groups.flatMap(group => group.pages.map(page => page.file_path)))];
    const groups = new Map();
    const identities = new Set();
    const documented = new Set();
    for (const path of paths) {
        const absolute = resolve(engineRoot, path);
        if (relative(resolve(engineRoot, 'docs/api'), absolute).split(sep)[0] === '..') {
            throw Error(`API page is outside docs/api: ${path}`);
        }
        const text = await readFile(absolute, 'utf8');
        // Check moved references even in overview pages (which have no request metadata).
        const prose = text.replace(/```[\s\S]*?```/g, '');
        for (const [, href] of prose.matchAll(/\]\(([^\s)]+)\)/g)) {
            const local = href.split('#')[0];
            if (local.endsWith('.md') && !/^(https?:|\/)/.test(local)) {
                await access(resolve(dirname(absolute), decodeURIComponent(local)))
                    .catch(() => { throw Error(`${path}: broken documentation link ${local}`); });
            }
        }
        const page = readPage(text, path);
        if (!page) continue;
        const { header, isCep, body } = page;
        const group = header.group || header.standard || 'HTTP';
        const key = `${header.category}/${group}`;
        if (!groups.has(key)) groups.set(key, { group, category: header.category, endpoints: [] });
        const endpoint = {
            method: isCep ? 'POST' : header.method,
            // CEP identity is a method name; all methods share the same wire route.
            path: isCep ? header.method : header.path,
            ...(isCep && { transport_path: '/v1/cep', execution: header.execution }),
            desc: header.summary, docs_content: body, params: header.params,
            request_payload: header.request_payload?.trim(), response: header.response?.trim(),
            payload_examples: examplesFromBody(page), examples: snippets(body),
        };
        const identity = `${endpoint.method} ${endpoint.path}`;
        if (identities.has(identity)) throw Error(`Duplicate documented request: ${identity}`);
        identities.add(identity);
        if (isCep) documented.add(header.method);
        groups.get(key).endpoints.push(endpoint);
    }
    const discovery = JSON.parse(await readFile(resolve(engineRoot, 'docs/api/cep/openrpc.json'), 'utf8'));
    const methods = discovery.methods.map(method => method.name);
    if (methods.length !== documented.size || methods.some(method => !documented.has(method))) {
        throw Error('CEP docs/navigation does not match openrpc.json');
    }
    for (const group of groups.values()) group.endpoints.sort((a, b) => a.path.localeCompare(b.path));
    return [...groups.values()];
}

export async function syncApiDocs({ engineRoot = defaultEngine, check = false, output = outputFile } = {}) {
    const catalog = await buildCatalog(engineRoot);
    const text = JSON.stringify(catalog) + '\n';
    if (check) {
        if (await readFile(output, 'utf8').catch(() => '') !== text) throw Error('App API catalog is stale; run npm run sync:api');
    } else {
        await mkdir(dirname(output), { recursive: true });
        await writeFile(output, text);
    }
    return catalog;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    if (process.argv.slice(2).some(arg => arg !== '--check')) throw Error('Only --check is supported');
    const catalog = await syncApiDocs({ engineRoot: process.env.CLUAIZ_ENGINE_SOURCE || defaultEngine,
        check: process.argv.includes('--check') });
    console.log(`API docs: ${catalog.flatMap(group => group.endpoints).length} requests in ${catalog.length} groups`);
}
