export type Entries<T> = {
  [K in keyof T]: [K, T[K]]
}[keyof T]

export type EntriesWithType<T, U,E=Entries<T>> = E extends [any, U] ? E : never;

export type EntityNeverEntries<T> = EntriesWithType<T, never>

export type EntityFunctionEntries<T> = EntriesWithType<T, Function>

export type KeysOfEntries<T> = T extends [infer U, any] ? U : never;

export type KeysOfEntriesWithType<E,T> = EntriesWithType<E,T> extends [infer U, any] ? U extends string|number|symbol? U : never : never;