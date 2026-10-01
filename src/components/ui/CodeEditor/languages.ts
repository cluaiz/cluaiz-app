// Comprehensive dictionary mapping for short aliases -> standard Monaco language IDs
// Clean O(1) lookup without any repetitive if-else chains
export const LANGUAGE_ALIASES: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    python3: 'python',
    rs: 'rust',
    go: 'go',
    golang: 'go',
    c: 'c',
    cpp: 'cpp',
    'c++': 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    cs: 'csharp',
    'c#': 'csharp',
    csharp: 'csharp',
    java: 'java',
    kt: 'kotlin',
    kts: 'kotlin',
    php: 'php',
    rb: 'ruby',
    ruby: 'ruby',
    swift: 'swift',
    dart: 'dart',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    shell: 'shell',
    ps: 'powershell',
    ps1: 'powershell',
    powershell: 'powershell',
    bat: 'bat',
    cmd: 'bat',
    sql: 'sql',
    mysql: 'mysql',
    pgsql: 'pgsql',
    postgres: 'pgsql',
    postgresql: 'pgsql',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'less',
    json: 'json',
    jsonc: 'json',
    yml: 'yaml',
    yaml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    svg: 'xml',
    gql: 'graphql',
    graphql: 'graphql',
    docker: 'dockerfile',
    dockerfile: 'dockerfile',
    md: 'markdown',
    markdown: 'markdown',
    txt: 'plaintext',
    text: 'plaintext',
    plaintext: 'plaintext',
    r: 'r',
    lua: 'lua',
    clj: 'clojure',
    clojure: 'clojure',
    ex: 'elixir',
    elixir: 'elixir',
    scala: 'scala',
    jl: 'julia',
    julia: 'julia',
    pl: 'perl',
    perl: 'perl',
    fs: 'fsharp',
    fsharp: 'fsharp',
    proto: 'proto',
    protobuf: 'proto',
    hcl: 'hcl',
    tf: 'hcl',
    terraform: 'hcl',
    ini: 'ini',
    cel: 'cel',
    'c-pointer': 'rust'
} as const;

export type SupportedLanguage = 
    | keyof typeof LANGUAGE_ALIASES 
    | (typeof LANGUAGE_ALIASES)[keyof typeof LANGUAGE_ALIASES]
    | (string & {});


export interface LanguageItem {
    label: string;
    value: string;
    category: string;
}

// Full catalogue of languages natively supported by Monaco Editor
export const DEFAULT_MONACO_LANGUAGES: LanguageItem[] = [
    // Web & Frontend
    { label: 'JavaScript', value: 'javascript', category: 'Web & Scripts' },
    { label: 'TypeScript', value: 'typescript', category: 'Web & Scripts' },
    { label: 'HTML', value: 'html', category: 'Web & Scripts' },
    { label: 'CSS', value: 'css', category: 'Web & Scripts' },
    { label: 'SCSS', value: 'scss', category: 'Web & Scripts' },
    { label: 'Less', value: 'less', category: 'Web & Scripts' },
    { label: 'GraphQL', value: 'graphql', category: 'Web & Scripts' },
    { label: 'Handlebars', value: 'handlebars', category: 'Web & Scripts' },
    { label: 'Pug', value: 'pug', category: 'Web & Scripts' },
    { label: 'Twig', value: 'twig', category: 'Web & Scripts' },

    // Data, Config & Serialization
    { label: 'JSON', value: 'json', category: 'Data & Config' },
    { label: 'YAML', value: 'yaml', category: 'Data & Config' },
    { label: 'TOML', value: 'toml', category: 'Data & Config' },
    { label: 'XML', value: 'xml', category: 'Data & Config' },
    { label: 'INI', value: 'ini', category: 'Data & Config' },
    { label: 'Protocol Buffers', value: 'proto', category: 'Data & Config' },
    { label: 'HCL / Terraform', value: 'hcl', category: 'Data & Config' },
    { label: 'Bicep', value: 'bicep', category: 'Data & Config' },

    // Backend, Systems & General Purpose
    { label: 'Python', value: 'python', category: 'Systems & Backend' },
    { label: 'Rust', value: 'rust', category: 'Systems & Backend' },
    { label: 'Go', value: 'go', category: 'Systems & Backend' },
    { label: 'C', value: 'c', category: 'Systems & Backend' },
    { label: 'C++', value: 'cpp', category: 'Systems & Backend' },
    { label: 'C#', value: 'csharp', category: 'Systems & Backend' },
    { label: 'Java', value: 'java', category: 'Systems & Backend' },
    { label: 'Kotlin', value: 'kotlin', category: 'Systems & Backend' },
    { label: 'PHP', value: 'php', category: 'Systems & Backend' },
    { label: 'Swift', value: 'swift', category: 'Systems & Backend' },
    { label: 'Ruby', value: 'ruby', category: 'Systems & Backend' },
    { label: 'Dart', value: 'dart', category: 'Systems & Backend' },
    { label: 'Scala', value: 'scala', category: 'Systems & Backend' },
    { label: 'Lua', value: 'lua', category: 'Systems & Backend' },
    { label: 'Julia', value: 'julia', category: 'Systems & Backend' },
    { label: 'Elixir', value: 'elixir', category: 'Systems & Backend' },
    { label: 'Clojure', value: 'clojure', category: 'Systems & Backend' },
    { label: 'Perl', value: 'perl', category: 'Systems & Backend' },
    { label: 'F#', value: 'fsharp', category: 'Systems & Backend' },
    { label: 'R', value: 'r', category: 'Systems & Backend' },
    { label: 'Pascal', value: 'pascal', category: 'Systems & Backend' },
    { label: 'Objective-C', value: 'objective-c', category: 'Systems & Backend' },
    { label: 'Visual Basic', value: 'vb', category: 'Systems & Backend' },

    // DevOps, Shell & CLI
    { label: 'Shell / Bash', value: 'shell', category: 'DevOps & Shell' },
    { label: 'PowerShell', value: 'powershell', category: 'DevOps & Shell' },
    { label: 'Dockerfile', value: 'dockerfile', category: 'DevOps & Shell' },
    { label: 'Batch / CMD', value: 'bat', category: 'DevOps & Shell' },
    { label: 'Azure CLI', value: 'azcli', category: 'DevOps & Shell' },

    // Database & Query Languages
    { label: 'SQL', value: 'sql', category: 'Database & Query' },
    { label: 'MySQL', value: 'mysql', category: 'Database & Query' },
    { label: 'PostgreSQL', value: 'pgsql', category: 'Database & Query' },
    { label: 'Redis', value: 'redis', category: 'Database & Query' },
    { label: 'Redshift', value: 'redshift', category: 'Database & Query' },
    { label: 'SPARQL', value: 'sparql', category: 'Database & Query' },
    { label: 'Cypher', value: 'cypher', category: 'Database & Query' },
    { label: 'CEL (Common Expression)', value: 'cel', category: 'Database & Query' },

    // Text, Docs & Specialized
    { label: 'Markdown', value: 'markdown', category: 'Docs & Text' },
    { label: 'Plain Text', value: 'plaintext', category: 'Docs & Text' },
    { label: 'RestructuredText', value: 'restructuredtext', category: 'Docs & Text' },
    { label: 'Solidity', value: 'sol', category: 'Specialized' },
    { label: 'SystemVerilog', value: 'systemverilog', category: 'Specialized' },
    { label: 'WGSL (WebGPU)', value: 'wgsl', category: 'Specialized' },
    { label: 'MIPS Assembly', value: 'mips', category: 'Specialized' },
    { label: 'PowerQuery', value: 'powerquery', category: 'Specialized' },
    { label: 'Apex', value: 'apex', category: 'Specialized' }
];

// O(1) Language Resolver function
export const normalizeLanguage = (lang?: string): string => {
    if (!lang) return 'json';
    const clean = lang.toLowerCase().trim();
    return LANGUAGE_ALIASES[clean] || clean;
};

// Dynamically extract all registered languages from Monaco instance
export const getMonacoLanguagesWithCategories = (monacoInstance?: any): LanguageItem[] => {
    if (!monacoInstance || !monacoInstance.languages) {
        return DEFAULT_MONACO_LANGUAGES;
    }

    const registered = monacoInstance.languages.getLanguages();
    if (!registered || registered.length === 0) {
        return DEFAULT_MONACO_LANGUAGES;
    }

    const knownMap = new Map(DEFAULT_MONACO_LANGUAGES.map((l) => [l.value, l]));
    registered.forEach((reg: any) => {
        if (!knownMap.has(reg.id)) {
            const formattedLabel = reg.aliases && reg.aliases[0] ? reg.aliases[0] : reg.id.toUpperCase();
            knownMap.set(reg.id, {
                label: formattedLabel,
                value: reg.id,
                category: 'Other'
            });
        }
    });

    return Array.from(knownMap.values());
};
