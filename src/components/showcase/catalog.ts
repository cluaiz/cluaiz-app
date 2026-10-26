import type { ComponentNavGroup } from './types';
export const COMPONENT_GROUPS: ComponentNavGroup[] = [
    {
        group: 'Design Foundations',
        items: [
            { id: 'typography', label: 'Typography & Scale', path: 'src/styles/index.css', description: 'Font stacks, type scale from 32px to 10px, weights, and tracking.', tag: 'Tokens' },
            { id: 'radius', label: 'Border Radius Scale', path: 'src/styles/index.css', description: 'Corner curvature tokens from 0px to 24px and full pills.', tag: 'Tokens' },
            { id: 'colors', label: 'Colors & Surfaces', path: 'src/styles/index.css', description: 'Three-layer background depth, text hierarchy, and status tokens.', tag: 'Tokens' },
            { id: 'themestudio', label: 'Theme Studio', path: 'src/store/ui/useThemeStore.ts', description: 'App theme, accent, typography and radius controls.', tag: 'Live' }
        ]
    },
    {
        group: 'Primitives & Actions',
        items: [
            { id: 'button', label: 'Button', path: 'src/components/ui/Button.tsx', description: '8 visual variants, 4 sizing scales, icons and states.', tag: 'Core' },
            { id: 'badge', label: 'Badge', path: 'src/components/ui/Badge.tsx', description: 'Semantic status pills, cyber, and 8-bit chip badges.', tag: 'Core' },
            { id: 'tag', label: 'Tag', path: 'src/components/ui/Tag.tsx', description: 'Interactive toggle and trending filter tags.' },
            { id: 'card', label: 'Card', path: 'src/components/ui/Card.tsx', description: 'Structured surfaces with headers, bodies, and glassmorphism.' }
        ]
    },
    {
        group: 'Inputs & Controls',
        items: [
            { id: 'input', label: 'Input', path: 'src/components/ui/Input.tsx', description: 'Text input with validation error states and disabled modes.' },
            { id: 'toggleswitch', label: 'ToggleSwitch', path: 'src/components/ui/ToggleSwitch.tsx', description: 'Controlled boolean switch with loading and disabled states.' },
            { id: 'elasticslider', label: 'ElasticSlider', path: 'src/components/ui/cursor/ElasticSlider.tsx', description: 'Spring physics numeric slider with boundary sigmoid stretch.' }
        ]
    },
    {
        group: 'Dropdowns & Portals',
        items: [
            { id: 'actiondropdown', label: 'ActionDropdown', path: 'src/components/ui/dropdown/ActionDropdown.tsx', description: 'Floating portal menu anchored to a button.' },
            { id: 'customdropdown', label: 'CustomDropdown', path: 'src/components/ui/dropdown/CustomDropdown.tsx', description: 'Searchable dropdown supporting custom values & icons.' },
            { id: 'calendardropdown', label: 'CalendarDropdown', path: 'src/components/ui/dropdown/CalendarDropdown.tsx', description: 'Drag-to-select date range picker with booked chats count.' },
            { id: 'filterdropdown', label: 'FilterDropdown', path: 'src/components/ui/dropdown/FilterDropdown.tsx', description: 'Status and category filtering checklist.' },
            { id: 'emojipicker', label: 'EmojiPicker', path: 'src/components/ui/context-menu/EmojiPicker.tsx', description: 'Floating reaction emoji picker grid.' }
        ]
    },
    {
        group: 'Modals & Overlays',
        items: [
            { id: 'confirmationmodal', label: 'ConfirmationModal', path: 'src/components/ui/modal/ConfirmationModal.tsx', description: 'Destructive action prompt with animated backdrop.' },
            { id: 'portmodal', label: 'PortConfirmModal', path: 'src/components/ui/modal/PortConfirmModal.tsx', description: 'Engine gateway port reconfiguration dialog.' },
            { id: 'labelmodal', label: 'LabelModal', path: 'src/components/ui/LabelModal.tsx', description: 'Color ribbon manager and tag pool creator.' }
        ]
    },
    {
        group: 'Visual FX & Lighting',
        items: [
            { id: 'borderglow', label: 'BorderGlow', path: 'src/components/ui/BorderGlow.tsx', description: 'Specular glowing neon edge responsive to cursor proximity.', tag: 'Cyber' },
            { id: 'clickspark', label: 'ClickSpark', path: 'src/components/ui/ClickSpark.tsx', description: 'Canvas hardware particle explosion on click interaction.', tag: 'Cyber' },
            { id: 'richhovercard', label: 'RichHoverCard', path: 'src/components/ui/RichHoverCard.tsx', description: 'Hover inspect card displaying code ranges & AI prompts.' },
            { id: 'backlight', label: 'Backlight', path: 'src/components/ui/Backlight.tsx', description: 'SVG Gaussian filter creating ambient diffused illumination.' },
            { id: 'tooltip', label: 'Tooltip', path: 'src/components/ui/tooltip.tsx', description: 'Viewport-aware floating hint tooltip with arrow alignment.' }
        ]
    },
    {
        group: 'Feedback & Timeline',
        items: [
            { id: 'toast', label: 'Toast Notifications', path: 'src/components/ui/toast/ToastContainer.tsx', description: 'Stackable notification toasts with timers and action buttons.' },
            { id: 'alertbanner', label: 'AlertBanner', path: 'src/components/ui/AlertBanner.tsx', description: 'Info, warning, success, and error notification banners.' },
            { id: 'contextchip', label: 'ContextChip', path: 'src/components/ui/ContextChip.tsx', description: 'Removable draggable file, folder, and skill context chip.' },
            { id: 'datedivider', label: 'DateDivider', path: 'src/components/ui/DateDivider.tsx', description: 'Chat stream calendar timeline divider.' }
        ]
    },
    {
        group: 'Icons & Media Previews',
        items: [
            { id: 'animatedicons', label: 'Animated Icons', path: 'src/components/animate-ui/icons/', description: '10 physics-driven micro-interaction animated vector icons.', tag: 'Anim' },
            { id: 'binarypreview', label: 'BinaryFileCard', path: 'src/components/preview/BinaryFileCard.tsx', description: 'Fallback preview for tar.gz archives and native binaries.' }
        ]
    }
];
