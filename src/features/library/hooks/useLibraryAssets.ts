import { useState, useEffect, useMemo, useCallback } from 'react';
import { useChatStore, ChatMessage } from '../../../store/chat/useChatStore';
import { chatStorageManager } from '../../../services/storage/ChatStorageManager';
import { LibraryAsset, LibraryCategory, LibrarySortOption, AssetUsage } from '../types';

export function useLibraryAssets() {
    const sessions = useChatStore((state) => state.sessions);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<LibraryCategory>('all');
    const [sortOption, setSortOption] = useState<LibrarySortOption>('newest');

    // 1. Ensure messages for all non-incognito sessions are loaded into memory
    useEffect(() => {
        let isMounted = true;

        const hydrateSessionMessages = async () => {
            const unloadedSessions = Object.values(sessions).filter(
                (s) => !s.isIncognito && (!s.messages || s.messages.length === 0)
            );

            if (unloadedSessions.length === 0) return;

            setIsLoading(true);
            try {
                const loadedUpdates: Record<string, ChatMessage[]> = {};
                await Promise.all(
                    unloadedSessions.map(async (s) => {
                        try {
                            const msgs = await chatStorageManager.loadSessionMessages(s.id);
                            if (msgs && msgs.length > 0) {
                                loadedUpdates[s.id] = msgs;
                            }
                        } catch (err) {
                            console.warn(`[Library] Failed to load messages for ${s.id}:`, err);
                        }
                    })
                );

                if (isMounted && Object.keys(loadedUpdates).length > 0) {
                    useChatStore.setState((state) => {
                        const nextSessions = { ...state.sessions };
                        for (const [id, msgs] of Object.entries(loadedUpdates)) {
                            if (nextSessions[id]) {
                                nextSessions[id] = {
                                    ...nextSessions[id],
                                    messages: msgs
                                };
                            }
                        }
                        return { sessions: nextSessions };
                    });
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        hydrateSessionMessages();

        return () => {
            isMounted = false;
        };
    }, [sessions]);

    // 2. Aggregate and group all identical attachments across all chats
    const allAssets = useMemo<LibraryAsset[]>(() => {
        const assetMap = new Map<string, LibraryAsset>();

        for (const session of Object.values(sessions)) {
            if (session.isIncognito || !session.messages) continue;

            for (const msg of session.messages) {
                const timestamp = msg.date || session.updatedAt || Date.now();

                // Priority 1: Check msg.attachments
                if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
                    msg.attachments.forEach((att, attIdx) => {
                        if (!att.name) return;

                        // 1. Resolve preview / data URI from attachment or matching part
                        let resolvedUrl = att.previewUrl;
                        if (!resolvedUrl && Array.isArray(msg.parts)) {
                            const matchingPart = msg.parts.find(
                                (p) =>
                                    (p.type === 'file_url' && p.file_url?.name === att.name) ||
                                    (p.type === 'image_url' && p.image_url?.name === att.name)
                            );
                            if (matchingPart) {
                                resolvedUrl = matchingPart.file_url?.url || matchingPart.image_url?.url;
                            }
                        }

                        // 2. Decode content for text/code files
                        let decodedContent: string | undefined = undefined;
                        const isTextLike =
                            (att.type && att.type.startsWith('text/')) ||
                            /\.(tsx?|jsx?|rs|py|json|md|txt|html|css|yaml|yml|toml|sh|bat|cmd|env|lock|sql|c|cpp|h|java|go|xml)$/i.test(att.name);

                        if (resolvedUrl && resolvedUrl.startsWith('data:') && isTextLike) {
                            try {
                                const base64 = resolvedUrl.split(',')[1];
                                if (base64) {
                                    const binaryString = atob(base64);
                                    const bytes = new Uint8Array(binaryString.length);
                                    for (let i = 0; i < binaryString.length; i++) {
                                        bytes[i] = binaryString.charCodeAt(i);
                                    }
                                    decodedContent = new TextDecoder('utf-8').decode(bytes);
                                }
                            } catch {
                                try {
                                    decodedContent = atob(resolvedUrl.split(',')[1] || '');
                                } catch {}
                            }
                        }

                        // Deduplication key: identical preview URI length + name, or url, or name + size
                        const groupKey = resolvedUrl
                            ? (resolvedUrl.startsWith('data:')
                                ? `media_${resolvedUrl.length}_${att.name}`
                                : `url_${resolvedUrl}`)
                            : `file_${att.name}_${att.size || 0}`;

                        const usage: AssetUsage = {
                            sessionId: session.id,
                            sessionTitle: session.title || 'Untitled Chat',
                            messageId: msg.id,
                            timestamp
                        };

                        const existing = assetMap.get(groupKey);
                        if (existing) {
                            const alreadyInUsages = existing.usages.some(
                                (u) => u.sessionId === session.id && u.messageId === msg.id
                            );
                            if (!alreadyInUsages) {
                                existing.usages.push(usage);
                            }
                            if (timestamp > existing.latestTimestamp) {
                                existing.latestTimestamp = timestamp;
                            }
                            if (!existing.content && decodedContent) {
                                existing.content = decodedContent;
                            }
                        } else {
                            const extension = att.name.split('.').pop()?.toLowerCase() || '';
                            const isMedia =
                                (att.type && (att.type.startsWith('image/') || att.type.startsWith('video/'))) ||
                                /\.(png|jpe?g|webp|gif|svg|bmp|ico|tiff|mp4|webm|mov|mkv)$/i.test(att.name);

                            assetMap.set(groupKey, {
                                id: `asset_${groupKey}_${attIdx}`,
                                name: att.name,
                                size: att.size || 0,
                                type: att.type || (isMedia ? 'image/png' : 'application/octet-stream'),
                                previewUrl: resolvedUrl,
                                content: decodedContent,
                                category: isMedia ? 'media' : 'files',
                                extension,
                                usages: [usage],
                                latestTimestamp: timestamp
                            });
                        }
                    });
                } else if (Array.isArray(msg.parts) && msg.parts.length > 0) {
                    // Priority 2: ONLY if msg.attachments is empty, inspect parts
                    msg.parts.forEach((part, partIdx) => {
                        if (part.type === 'image_url' && part.image_url?.url) {
                            const rawUrl = part.image_url.url;
                            const name = part.image_url.name || `Image_${partIdx}.png`;
                            const groupKey = rawUrl.startsWith('data:')
                                ? `media_${rawUrl.length}_${name}`
                                : `url_${rawUrl}`;

                            const usage: AssetUsage = {
                                sessionId: session.id,
                                sessionTitle: session.title || 'Untitled Chat',
                                messageId: msg.id,
                                timestamp
                            };

                            const existing = assetMap.get(groupKey);
                            if (existing) {
                                const alreadyInUsages = existing.usages.some(
                                    (u) => u.sessionId === session.id && u.messageId === msg.id
                                );
                                if (!alreadyInUsages) {
                                    existing.usages.push(usage);
                                }
                                if (timestamp > existing.latestTimestamp) {
                                    existing.latestTimestamp = timestamp;
                                }
                            } else {
                                assetMap.set(groupKey, {
                                    id: `part_${groupKey}_${partIdx}`,
                                    name,
                                    size: 0,
                                    type: 'image/png',
                                    previewUrl: rawUrl,
                                    category: 'media',
                                    extension: 'png',
                                    usages: [usage],
                                    latestTimestamp: timestamp
                                });
                            }
                        } else if (part.type === 'file_url' && part.file_url) {
                            const name = part.file_url.name || `File_${partIdx}`;
                            const rawUrl = part.file_url.url;
                            const groupKey = rawUrl
                                ? (rawUrl.startsWith('data:') ? `file_${rawUrl.length}_${name}` : `url_${rawUrl}`)
                                : `file_${name}_0`;

                            const usage: AssetUsage = {
                                sessionId: session.id,
                                sessionTitle: session.title || 'Untitled Chat',
                                messageId: msg.id,
                                timestamp
                            };

                            const existing = assetMap.get(groupKey);
                            if (existing) {
                                const alreadyInUsages = existing.usages.some(
                                    (u) => u.sessionId === session.id && u.messageId === msg.id
                                );
                                if (!alreadyInUsages) {
                                    existing.usages.push(usage);
                                }
                                if (timestamp > existing.latestTimestamp) {
                                    existing.latestTimestamp = timestamp;
                                }
                            } else {
                                const extension = name.split('.').pop()?.toLowerCase() || '';
                                const isMedia = /\.(png|jpe?g|webp|gif|svg|bmp|ico|mp4|webm)$/i.test(name);

                                assetMap.set(groupKey, {
                                    id: `part_${groupKey}_${partIdx}`,
                                    name,
                                    size: 0,
                                    type: isMedia ? 'image/png' : 'application/octet-stream',
                                    previewUrl: rawUrl,
                                    category: isMedia ? 'media' : 'files',
                                    extension,
                                    usages: [usage],
                                    latestTimestamp: timestamp
                                });
                            }
                        }
                    });
                }
            }
        }

        return Array.from(assetMap.values());
    }, [sessions]);

    // 3. Filter and Sort assets
    const filteredAssets = useMemo(() => {
        let result = allAssets;

        // Category filter
        if (activeCategory === 'media') {
            result = result.filter((a) => a.category === 'media');
        } else if (activeCategory === 'files') {
            result = result.filter((a) => a.category === 'files');
        }

        // Search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(
                (a) =>
                    a.name.toLowerCase().includes(q) ||
                    a.extension.toLowerCase().includes(q) ||
                    a.usages.some((u) => u.sessionTitle.toLowerCase().includes(q))
            );
        }

        // Sort order
        return [...result].sort((a, b) => {
            switch (sortOption) {
                case 'newest':
                    return b.latestTimestamp - a.latestTimestamp;
                case 'oldest':
                    return a.latestTimestamp - b.latestTimestamp;
                case 'largest':
                    return b.size - a.size;
                case 'name':
                    return a.name.localeCompare(b.name);
                default:
                    return b.latestTimestamp - a.latestTimestamp;
            }
        });
    }, [allAssets, activeCategory, searchQuery, sortOption]);

    // 4. Counts by category
    const counts = useMemo(() => {
        let mediaCount = 0;
        let filesCount = 0;
        for (const a of allAssets) {
            if (a.category === 'media') mediaCount++;
            else filesCount++;
        }
        return {
            all: allAssets.length,
            media: mediaCount,
            files: filesCount
        };
    }, [allAssets]);

    // 5. Delete asset handler
    const deleteAsset = useCallback(async (asset: LibraryAsset, targetSessionId?: string) => {
        const targetUsages = targetSessionId
            ? asset.usages.filter((u) => u.sessionId === targetSessionId)
            : asset.usages;

        const affectedSessionIds = Array.from(new Set(targetUsages.map((u) => u.sessionId)));

        useChatStore.setState((state) => {
            const nextSessions = { ...state.sessions };

            for (const sId of affectedSessionIds) {
                const session = nextSessions[sId];
                if (!session || !session.messages) continue;

                const updatedMessages = session.messages.map((msg) => {
                    const nextAttachments = (msg.attachments || []).filter(
                        (att) =>
                            !(
                                att.name === asset.name &&
                                (asset.previewUrl ? att.previewUrl === asset.previewUrl : true)
                            )
                    );

                    const nextParts = (msg.parts || []).filter((part) => {
                        if (part.type === 'file_url' && part.file_url?.name === asset.name) return false;
                        if (part.type === 'image_url' && part.image_url?.url === asset.previewUrl) return false;
                        return true;
                    });

                    return {
                        ...msg,
                        attachments: nextAttachments,
                        parts: nextParts
                    };
                });

                nextSessions[sId] = {
                    ...session,
                    messages: updatedMessages
                };

                chatStorageManager.saveAllMessages(sId, updatedMessages).catch((err) => {
                    console.error(`[Library] Failed to persist deleted asset for session ${sId}:`, err);
                });
            }

            return { sessions: nextSessions };
        });
    }, []);

    return {
        assets: filteredAssets,
        allCount: allAssets.length,
        counts,
        isLoading,
        searchQuery,
        setSearchQuery,
        activeCategory,
        setActiveCategory,
        sortOption,
        setSortOption,
        deleteAsset
    };
}
