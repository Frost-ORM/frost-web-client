export function valueOrNull<T>(arg: any, value: T): T | null {
    return arg ? value : null;
}
