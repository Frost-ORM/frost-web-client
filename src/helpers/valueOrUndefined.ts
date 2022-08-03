
export function valueOrUndefined<T>(arg: any, value: T): T | undefined {
    return arg ? value : undefined;
}
