export type LibraryCategory = 'all' | 'media' | 'files';

export type LibrarySortOption = 'newest' | 'oldest' | 'largest' | 'name';

export interface AssetUsage {
    sessionId: string;
    sessionTitle: string;
    messageId: string;
    timestamp: number;
}

export interface LibraryAsset {
    id: string;
    name: string;
    size: number;
    type: string;
    previewUrl?: string;
    content?: string;
    category: 'media' | 'files';
    extension: string;
    usages: AssetUsage[];
    latestTimestamp: number;
}
