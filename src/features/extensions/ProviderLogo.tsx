import React, { useEffect, useState } from 'react';
import { Cloud } from 'lucide-react';
import { providerLogo } from '../../api/catalogue/providers';
import { CatalogueHeroImage, LogoBox } from './CatalogueUI';

/** Logo colour kind per logo URL, read once per session: one colour (drawn in the theme's text colour) or its own colours. */
const kinds = new Map<string, Promise<boolean>>();

function readOneColour(url: string): Promise<boolean> {
    let kind = kinds.get(url);
    if (!kind) {
        kind = fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' })
            .then(response => response.ok ? response.text() : '')
            .then(svg => [...svg.matchAll(/fill\s*[=:]\s*["']?\s*([^"';\s>]+)/gi)].every(([, value]) => /^(none|currentColor)$/i.test(value)))
            .catch(() => true);
        kinds.set(url, kind);
    }
    return kind;
}

function useOneColour(url: string) {
    const [oneColour, setOneColour] = useState<boolean>();
    useEffect(() => {
        let live = true;
        setOneColour(undefined);
        if (url) void readOneColour(url).then(value => { if (live) setOneColour(value); });
        return () => { live = false; };
    }, [url]);
    return oneColour;
}

function Mark({ url, oneColour, className }: { url: string; oneColour: boolean; className: string }) {
    if (!oneColour) return <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" className={`${className} object-contain`} />;
    const mask = `url(${url}) center / contain no-repeat`;
    return <span aria-hidden="true" className={`${className} bg-[var(--text-primary)]`} style={{ mask, WebkitMask: mask }} />;
}

/** A logo image, boxed or bare; a one-colour logo is drawn in the theme's text colour so it shows in light and dark */
export function ThemedLogo({ url, fallback, large = false, boxed = true, className }: {
    url: string; fallback: React.ReactNode; large?: boolean; boxed?: boolean; className?: string;
}) {
    const oneColour = useOneColour(url);
    const mark = !url ? fallback
        : oneColour !== undefined && <Mark url={url} oneColour={oneColour} className={className ?? (boxed ? 'w-3/5 h-3/5' : large ? 'w-8 h-8' : 'w-5 h-5')} />;
    return boxed ? <LogoBox large={large}>{mark}</LogoBox> : <>{mark}</>;
}

/** A provider's logo in the catalogue's logo box, or bare where the row draws its own box; custom providers get the cloud icon. */
export function ProviderLogo({ id, large = false, boxed = true }: { id: string; large?: boolean; boxed?: boolean }) {
    return <ThemedLogo url={providerLogo(id)} large={large} boxed={boxed}
        fallback={<Cloud className="w-4 h-4 text-[var(--accent-color)]" aria-hidden="true" />} />;
}

/** A logo, large and dimmed, for the page head */
export function HeroLogo({ url }: { url: string }) {
    const oneColour = useOneColour(url);
    if (!url || oneColour === undefined) return null;
    return oneColour
        ? <Mark url={url} oneColour className="absolute right-[8%] top-1/2 -translate-y-1/2 w-56 h-56 opacity-20" />
        : <CatalogueHeroImage src={url} />;
}

/** A provider's logo, large and dimmed, for the page head. */
export const ProviderHeroLogo = ({ id }: { id: string }) => <HeroLogo url={providerLogo(id)} />;
