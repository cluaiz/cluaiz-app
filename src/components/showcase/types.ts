export type ComponentId =
    | 'typography'
    | 'radius'
    | 'colors'
    | 'themestudio'
    | 'button'
    | 'input'
    | 'toggleswitch'
    | 'elasticslider'
    | 'badge'
    | 'tag'
    | 'contextchip'
    | 'datedivider'
    | 'customdropdown'
    | 'calendardropdown'
    | 'filterdropdown'
    | 'actiondropdown'
    | 'confirmationmodal'
    | 'portmodal'
    | 'labelmodal'
    | 'emojipicker'
    | 'borderglow'
    | 'clickspark'
    | 'richhovercard'
    | 'backlight'
    | 'tooltip'
    | 'toast'
    | 'alertbanner'
    | 'animatedicons'
    | 'binarypreview'
    | 'card';

export interface ComponentNavGroup {
    group: string;
    items: {
        id: ComponentId;
        label: string;
        path: string;
        description: string;
        tag?: string;
    }[];
}
