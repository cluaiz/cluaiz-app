import { Button } from '../ui/Button';

export const STYLE_EXAMPLE = `import '@cluaiz/extension-sdk/ui.css';

// Semantic tokens follow the App theme in a connected extension.
const panel = {
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-base)',
  fontFamily: 'var(--font-family)',
};`;
export function DeveloperGuide({ onCopy, copiedText }: { onCopy(text: string): void; copiedText: string | null }) {
    return <details className="border-b border-[var(--border-color)] p-5">
        <summary className="font-semibold cursor-pointer">Developer guide · build outside the App</summary>
        <div className="space-y-4 mt-4 text-sm text-[var(--text-secondary)]">
            <p>Create a separate project in VS Code or your editor. Your extension does not live inside cluaiz-app.
                The private SDK/devkit are currently supplied as local tarballs; a public npm package is not published.</p>
            <ol className="list-decimal pl-5 space-y-2">
                <li>Maintainer: run <code>npm run build:extensions</code>, then <code>npm pack --workspace @cluaiz/extension-sdk --ignore-scripts</code> and the same for <code>@cluaiz/extension-devkit</code>.</li>
                <li>From the App checkout, scaffold a new independent folder with the existing CLI:</li>
            </ol>
            <pre className="p-3 bg-[var(--bg-secondary)] overflow-x-auto text-xs"><code>{'node packages/extension-devkit/src/cli.mjs create <new-project-folder> --id author.notes --sdk <sdk.tgz> --devkit <devkit.tgz>'}</code></pre>
            <p>Inside that new project: <code>npm install</code> → <code>npm run dev</code> → <code>npm run check</code> → <code>npm run build</code> → <code>npm run pack</code>.
                Dependencies belong to that project. The build embeds compiled UI/CSS; users do not install the author node_modules.</p>
            <p>The standalone preview is UI-only. A connected developer run receives the App theme and only its approved SDK services.
                In a development App, open Toolkit → Extensions → Developer preview and select your built <code>dist/index.html</code>.
                Web and Windows consume that same document. Signing, general package installation and background/native execution are separate capabilities.</p>
            <h3 className="font-semibold text-[var(--text-primary)]">Theme, CSS and components</h3>
            <p>Import <code>ui.css</code> once. Use the component imports in this page and semantic variables for surfaces,
                text, borders, accent, radius and font. Do not import App stores or native commands into an independent extension.
                Your own utility classes need your own build; the SDK stylesheet contains the shared controls.</p>
            <Button size="sm" variant="outline" onClick={() => onCopy(STYLE_EXAMPLE)}>{copiedText === STYLE_EXAMPLE ? 'Copied CSS setup' : 'Copy CSS setup'}</Button>
            <pre className="p-3 bg-[var(--bg-secondary)] overflow-x-auto text-xs"><code>{STYLE_EXAMPLE}</code></pre>
            <p>“SDK export” entries are available through the package. “App-connected” and “Source reference” entries show existing App components without promising standalone imports.</p>
        </div>
    </details>;
}
