import { useCallback, useEffect, useState } from 'react';
import { Box, Cloud } from 'lucide-react';
import { modelCatalogue } from '../../../api/catalogue/models';
import { providerLogo } from '../../../api/catalogue/providers';
import { ThemedLogo } from '../../extensions/ProviderLogo';
import { catalogueImage } from '../../extensions/catalogueView';
import { useCatalogue } from '../../extensions/useCatalogue';

const SIZE = 'w-4 h-4 shrink-0';

/** A catalogue logo as a plain image, as the catalogue cards draw it (its host sends no CORS header, so it cannot be
 * read for the one-colour check); a missing or broken one falls back to the box icon */
function LocalLogo({ url }: { url: string }) {
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [url]);
    return url && !failed ? <img src={url} alt="" aria-hidden="true" loading="lazy" referrerPolicy="no-referrer"
        className={`${SIZE} object-contain`} onError={() => setFailed(true)} />
        : <Box size={13} className="shrink-0 text-[var(--accent-color)]" />;
}

/**
 * Logo lookup for the model picker. A local model's logo is its catalogue model's (matched by the Hugging Face
 * repository, the saved model list, no extra read); a cloud model's is its maker's ("qwen" in "qwen/qwen3-32b")
 * when models.dev has one, else its provider's. Without either, the plain box or cloud icon stays.
 */
export function useModelLogos() {
    const catalogue = useCatalogue(modelCatalogue.list);
    const models = catalogue.reply?.data;
    const local = useCallback((repo?: unknown) => {
        const model = typeof repo === "string" && repo ? models?.find(item => item.repo.toLowerCase() === repo.toLowerCase()) : undefined;
        return <LocalLogo url={catalogueImage(model?.logo || '') || ''} />;
    }, [models]);
    const cloud = useCallback((model: string, provider: string) => {
        const maker = model.includes('/') ? model.split('/')[0].toLowerCase() : '';
        return <ThemedLogo url={(maker && providerLogo(maker)) || providerLogo(provider)} boxed={false} className={SIZE}
            fallback={<Cloud size={13} className="shrink-0 text-[var(--accent-color)]" />} />;
    }, []);
    return { local, cloud };
}
