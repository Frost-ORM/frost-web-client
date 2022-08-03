export function join(...args: string[]) {
    return args.join('/').replace(/\/+/g, '/');
}
