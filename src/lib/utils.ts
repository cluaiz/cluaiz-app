export function cn(...classes: any[]) {
    return classes.filter(Boolean).map(c => typeof c === 'object' && c && 'get' in c ? c.get() : c).join(' ');
}
