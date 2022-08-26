export const isNullOrUndefined = (x) => x === null || x === undefined;
export const isNotNullNorUndefined = (x) => !isNullOrUndefined(x);

export function mapClear<T extends Record<any,any> >(map:T):Required<T>{
	//@ts-ignore
	return Object.fromEntries(Object.entries(map).filter(([_,value])=>( value !== null || value !== undefined)))
}