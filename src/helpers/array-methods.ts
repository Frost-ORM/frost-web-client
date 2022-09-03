import { KeysOf, KeysOfEntries } from "../types-helpers";

export function mapByKey<T extends Record<PropertyKey, any>>(array: T[], key: KeysOf<T>): Record<PropertyKey,T> {
	return Object.fromEntries(array.map((value)=>([value[key],value])))
}

export function groupByKey<T extends Record<PropertyKey, any>>(array: T[], key: PropertyKey) {
	return group<T>(array, (value) => value[key]);
}
export function group<T extends Record<PropertyKey, any>>(array: T[], predicate: (value: T) => PropertyKey) {
	let output: Record<PropertyKey, T[]> = {};

	for (let item of array) {
		output[predicate(item)] = [...(output[predicate(item)] ?? []), item];
	}

	return output;
}

Object.defineProperties(Array.prototype, {
	group: {
		value: function <T>(predicate: (value: T) => PropertyKey) {
			return group<T>(this, predicate);
		},
		enumerable: false,
	},
	groupByKey: {
		value: function <T>(key: PropertyKey) {
			return groupByKey<T>(this, key);
		},
		enumerable: false,
	},
});

declare global {
	interface Array<T> {
		group(predicate: (value: T) => PropertyKey): Record<PropertyKey, T[]>;
		groupByKey(key: PropertyKey): Record<PropertyKey, T[]>;
	}
}
