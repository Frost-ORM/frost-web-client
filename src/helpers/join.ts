/**
 * @example
 * ```ts
 * join("/users","/customers/")
 * // returns "/users/customers/"
 * ```
 * 
 * @param args - multiple strings with or without surrounding slashes
 * @returns a path string consisting of all the components with a single slash between each one.
 */
export function join(...args: string[]) {
    return args.join('/').replace(/\/+/g, '/');
}
