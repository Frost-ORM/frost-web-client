import { isNotNullNorUndefined } from "./nullOrUndefined";

export function flattenObject(object, delimiter,prefix?, depth = 1) {
	if (depth === 0) return object;
	return Object.fromEntries(
		Object.entries(object).map(([key, value]) => {
            let path =  [prefix, key].filter(isNotNullNorUndefined).join(delimiter)

            if(typeof value === 'object' && depth > 1){
                return Object.entries(flattenObject(value,delimiter,path,depth-1))
            }else{
                return [[path, value]];
            }
		}).flatMap((x)=>x) as any
	);
}
