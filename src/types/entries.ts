export type Entries<T> = {
  [K in keyof T]: [K, T[K]]
}[keyof T]

export type EntriesWithValueOfType<T, U,E=Entries<T>> = E extends [any, U] ? E : never;

export type EntityNeverEntries<T> = EntriesWithValueOfType<T, never>

export type EntityFunctionEntries<T> = EntriesWithValueOfType<T, Function>

export type KeysOfEntries<T> = T extends [infer U, any] ? U : never;
