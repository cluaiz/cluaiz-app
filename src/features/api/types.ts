export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
export type ApiProtocol = 'http' | 'c-pointer';

export interface ApiParameter {
    name: string;
    type: string;
    req?: boolean;
    desc: string;
    default?: any;
}

export interface CodeSnippet {
    language: string;
    title: string;
    code: string;
}

export interface ApiEndpoint {
    method: HttpMethod;
    path: string;
    desc: string;
    docs_url?: string;
    docs_content?: string;
    request_payload?: string;
    params?: ApiParameter[];
    response?: string;
    examples?: CodeSnippet[];
}

export interface ApiGroup {
    group: string;
    endpoints: ApiEndpoint[];
}

export interface InstalledModel {
    id: string;
    name?: string;
    category?: string;
    supported_tasks?: string[];
    extra_files?: any[];
}

export interface VoiceOption {
    value: string;
    label: string;
}

export interface ExecutionMetrics {
    status: number;
    statusText: string;
    timeMs: number;
    sizeBytes: number;
    ttft?: string;
    totalTime?: string;
    isStreaming?: boolean;
}
