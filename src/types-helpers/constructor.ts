export type Constructor<T> = new (...args: any[]) => T;
/** @hidden */
export type ClassOf<T> = {new (...args: any[]):T};

