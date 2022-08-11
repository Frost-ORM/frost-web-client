export type Constructor<T> = new (...args: any[]) => T;
export type ClassOf<T> = {new (...args: any[]):T};

