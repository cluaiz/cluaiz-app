import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { packageEntry, validateExtensionContract } from '@cluaiz/extension-sdk';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));

/** Only project-relative generated paths, with no symlink/junction ancestor. */
export async function ownedPath(root, relative, createParents = false) {
    packageEntry(relative);
    const parts = relative.split('/');
    let current = await fs.realpath(root);
    for (const [index, part] of parts.entries()) {
        current = path.join(current, part);
        let stat;
        try { stat = await fs.lstat(current); }
        catch (error) {
            if (error.code !== 'ENOENT') throw error;
            if (index < parts.length - 1 && createParents) await fs.mkdir(current);
            else if (index < parts.length - 1) throw error;
            continue;
        }
        if (stat.isSymbolicLink()) throw new Error('Generated paths cannot use symlinks or junctions.');
        if (index < parts.length - 1 && !stat.isDirectory()) throw new Error('Generated parent is not a directory.');
    }
    return current;
}
export async function writeOwned(root, relative, bytes) {
    await fs.writeFile(await ownedPath(root, relative, true), bytes);
}
export const jsonBytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
export async function project(root) {
    root = await fs.realpath(root);
    const pkg = await readJson(path.join(root, 'package.json'));
    const app = validateExtensionContract(pkg.app);
    if (pkg.hub_type !== 'extension' || pkg.version !== app.version) throw new Error('Project/package version must match its extension contract.');
    if (app.runtime.kind !== 'webview' || app.runtime.entry !== 'dist/index.html' || app.activation !== 'on-demand') {
        throw new Error('This devkit builds on-demand web UI packages with entry dist/index.html only.');
    }
    return { root, pkg, app };
}
export function checkTypes(root) {
    const configPath = path.join(root, 'tsconfig.json');
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, { noEmit: true });
    const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(ts.createProgram(parsed.fileNames, parsed.options))];
    if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: name => name, getCurrentDirectory: () => root, getNewLine: () => '\n',
    }));
}
