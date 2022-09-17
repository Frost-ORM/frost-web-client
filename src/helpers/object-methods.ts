import { isNotNullNorUndefined } from "./nullOrUndefined";

export function flattenObject(object:any, delimiter:string,prefix?:string, depth = 1):any {
	if (depth === 0) return object;
    if(typeof object === 'object' && object !== null){ // typeof null === 'object' a555555hhh
        return Object.fromEntries(
            Object.entries(object).map(([key, value]) => {
                let path =  [prefix, key].filter(isNotNullNorUndefined).join(delimiter)

                if(typeof value === 'object' && value !== null && depth > 1){
                    return Object.entries(flattenObject(value,delimiter,path,depth-1))
                }else{
                    return [[path, value]];
                }
            }).flatMap((x)=>x) as any
        );
    }else return object
}
