#!/usr/bin/env node
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createServer } from 'vite';
import { scaffold } from './scaffold.mjs';
import { project, checkTypes } from './project.mjs';
import { buildProject, packProject } from './build.mjs';

try {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: {
        id: { type: 'string' }, name: { type: 'string' }, sdk: { type: 'string' }, devkit: { type: 'string' },
        project: { type: 'string' }, port: { type: 'string' }, help: { type: 'boolean', short: 'h' },
    } });
    const [command, target, ...extra] = positionals;
    if (values.help || !command) {
        console.log('cluaiz-extension create <new-folder> --id publisher.app --sdk <local.tgz> --devkit <local.tgz>');
        console.log('cluaiz-extension check|dev|build|pack [--project <folder>] [--port <loopback-port>]');
        console.log('Private alpha author tools. Preview is UI-only; no Engine connection or installation.');
    } else {
        if (extra.length || (command !== 'create' && target)) throw new Error('Unexpected positional arguments. Use --help.');
        const root = path.resolve(values.project || process.cwd());
        if (command === 'create') {
            if (!target) throw new Error('create needs a new target folder.');
            const destination = path.resolve(target);
            await scaffold(destination, values);
            console.log(`Created ${destination}. Dependencies were not installed. Run npm install in that folder.`);
        } else if (command === 'check') {
            await project(root); checkTypes(root);
            console.log('Metadata and TypeScript pass. Runtime installation/compatibility is not certified.');
        } else if (command === 'build') {
            const receipt = await buildProject(root);
            console.log(`Built ${receipt.files.length} web assets. External Cluaiz runtime is not connected.`);
        } else if (command === 'pack') {
            console.log(`Created unsigned author artifact: ${await packProject(root)}`);
        } else if (command === 'dev') {
            await project(root); checkTypes(root);
            const port = values.port === undefined ? 0 : Number(values.port);
            if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid loopback port.');
            const server = await createServer({ root, configFile: false, envFile: false, publicDir: false,
                esbuild: { jsx: 'automatic' }, server: { host: '127.0.0.1', port, strictPort: true, cors: false } });
            await server.listen();
            console.log('UI-only development preview. No Engine or user App profile is connected.');
            server.printUrls();
            const close = async () => { await server.close(); process.exitCode = 0; };
            process.once('SIGINT', close); process.once('SIGTERM', close);
        } else throw new Error('Unknown command. Use --help.');
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
