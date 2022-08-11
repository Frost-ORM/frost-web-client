import { EntriesWithValueOfType, KeysOfEntries } from "./entries"

export type OmitType<E,T> = Omit<E, KeysOfEntries<EntriesWithValueOfType<E, T>>>

export type OmitNever<T> = OmitType<T,never>

export type OmitFunctions<T> = OmitType<T,Function>
export type OmitAllFunctions<T> = OmitType<T,Function|undefined|null>