import { Badge, type BadgeProps } from '../../components/ui/Badge';

const variants: Record<string, BadgeProps['variant']> = {
    succeeded: 'default', failed: 'destructive', cancelled: 'outline',
};

export function RunStatusBadge({ status }: { status: string }) {
    return <Badge variant={variants[status] ?? 'secondary'}>{status}</Badge>;
}

export const when = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';
