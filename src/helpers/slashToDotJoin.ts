/**
 * Just like {@link join} but with dots instead of slashes
 * @example
 * ```ts
 * join("/users","/customers.user1")
 * // returns "users.customers.user1"
 * ```
 * 
 * @param args - multiple strings with or without surrounding slashes or dots
 * @returns a path string consisting of all the components with a single dot between each one.
 */
export function slashToDotJoin(...args: string[]) {
    return args
        .join('/')
        .replace(/\/+/g, '/') //TODO use one replace
        .replace(/\.+/g, '/')
        .split('/')
        .filter(e => e !== '')
        .join('.');
}
