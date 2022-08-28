export type ArrayValuesType<T extends any[]> = T extends (infer U)[]? U:never;
