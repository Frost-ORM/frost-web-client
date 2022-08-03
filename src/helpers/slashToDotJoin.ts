export function slashToDotJoin(...args: string[]) {
    return args
        .join('/')
        .replace(/\/+/g, '/')
        .split('/')
        .filter(e => e !== '')
        .join('.');
}
