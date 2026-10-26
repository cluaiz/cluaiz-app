import type { ComponentId } from './types';

export interface SDKReference {
    exports: readonly string[];
    props: readonly [string, string][];
    example: string;
}
function example(exports: string[], jsx: string, state = ''): SDKReference['example'] {
    return `${state ? "import { useState } from 'react';\n" : ''}import { ${exports.join(', ')} } from '@cluaiz/extension-sdk/ui';
import '@cluaiz/extension-sdk/ui.css';

export default function Example() {
  ${state}
  return (${jsx});
}`;
}
/** These imports are checked against the built package, not proposed exports. */
export const SDK_REFERENCES: Partial<Record<ComponentId, SDKReference>> = {
    button: { exports: ['Button'], props: [['variant', 'default, secondary, destructive, outline, ghost, link, cyber, pixel; default: default'], ['size', 'default, sm, lg, icon; default: default'], ['onClick / disabled', 'Standard button event and disabled state']],
        example: example(['Button'], '<Button variant="outline" onClick={() => setCount(count + 1)}>Clicked {count}</Button>', 'const [count, setCount] = useState(0);') },
    input: { exports: ['Input'], props: [['value / onChange', 'Standard controlled input value and change event'], ['error', 'Optional error string'], ['sizeVariant', 'sm, default, lg; default: default']],
        example: example(['Input'], '<Input aria-label="Title" value={title} onChange={event => setTitle(event.target.value)} />', 'const [title, setTitle] = useState(\'\');') },
    card: { exports: ['Card', 'CardHeader', 'CardTitle', 'CardContent'], props: [['hover', 'Optional hover state; default: false'], ['className / children', 'Standard div styling and contents']],
        example: example(['Card', 'CardHeader', 'CardTitle', 'CardContent'], '<Card><CardHeader><CardTitle>My extension</CardTitle></CardHeader><CardContent>Uses the App surface and text tokens.</CardContent></Card>') },
    badge: { exports: ['Badge'], props: [['variant', 'default, secondary, outline, destructive, cyber, pixel; default: default'], ['children', 'Badge contents']],
        example: example(['Badge'], '<Badge variant="outline">Local</Badge>') },
    tag: { exports: ['Tag'], props: [['active', 'Selected styling; default: false'], ['onClick', 'Standard button event']],
        example: example(['Tag'], '<Tag active={active} onClick={() => setActive(!active)}>Favourite</Tag>', 'const [active, setActive] = useState(false);') },
    toggleswitch: { exports: ['ToggleSwitch'], props: [['active', 'Required boolean'], ['onToggle', 'Optional callback without event arguments'], ['size / disabled / loading', 'sm or md (default md); disabled/loading default false']],
        example: example(['ToggleSwitch'], '<ToggleSwitch aria-label="Enable feature" active={active} onToggle={() => setActive(!active)} />', 'const [active, setActive] = useState(false);') },
    alertbanner: { exports: ['AlertBanner'], props: [['message', 'Required React contents'], ['variant', 'warning, error, info, success; default: warning'], ['title / action', 'Optional title and {label, onClick, loading} action']],
        example: example(['AlertBanner'], '<AlertBanner variant="info" title="Choose a model" message="Select an installed model to continue." />') },
    customdropdown: { exports: ['CustomDropdown'], props: [['options', 'Required strings or {value, label, description?, fontFamily?} array'], ['value / onChange', 'Selected string; callback receives the new string'], ['floating / allowCustomInput', 'Optional booleans; both default false'], ['disabled / loading', 'Optional booleans; both default false']],
        example: example(['CustomDropdown'], '<CustomDropdown value={density} onChange={setDensity} options={[{value: \'compact\', label: \'Compact\'}, {value: \'comfortable\', label: \'Comfortable\'}]} />', 'const [density, setDensity] = useState(\'compact\');') },
    tooltip: { exports: ['Tooltip', 'Button'], props: [['title / children', 'Required text and trigger element'], ['position', 'right, top, bottom, bottom-end, left; default: top'], ['subtitle / disabled', 'Optional detail and disabled state']],
        example: example(['Tooltip', 'Button'], '<Tooltip title="Open details"><Button variant="ghost">Details</Button></Tooltip>') },
};

export function componentAvailability(id: ComponentId): { label: string; description: string } {
    if (SDK_REFERENCES[id]) return { label: 'SDK export', description: 'Import from @cluaiz/extension-sdk/ui in your independent project.' };
    if (['typography', 'radius', 'colors'].includes(id)) return { label: 'Shared CSS tokens', description: 'Use ui.css and semantic CSS variables. Connected extensions inherit the host theme.' };
    if (['contextchip', 'richhovercard', 'themestudio'].includes(id)) return { label: 'App-connected', description: 'This preview uses App context, stores or services. It is not a standalone SDK export.' };
    return { label: 'Source reference', description: 'Available in the App source and gallery. This component is not currently exported by the independent SDK.' };
}
