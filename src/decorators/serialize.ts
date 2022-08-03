import 'reflect-metadata'
import { SYMBOL_PREFIX } from '../helpers/consts'

export const SerializeSymbol = Symbol.for(SYMBOL_PREFIX+':serialize')
export type Serializer<T, P> = (value: P, object: T) => any
export type Deserializer<D extends (AdvancedJSONPrimitive<P>|undefined| null),P> = (value: D, object: any) => P
export type JSONPrimitive = string | number | boolean | Record<string,any> | any[]
/**
 * This type predicts the type of the Json primitive depending on the type of property
 * 
 * if it's a number then number 
 * 
 * if it's a boolean then boolean 
 * 
 * if it's a string then string
 * 
 * else it's any (could be an array | map | string | null)
 * 
 */
export type AdvancedJSONPrimitive<T> = (T extends number? number : T extends boolean? boolean : T extends string? string : any )


export type SerializeOptionsWithNullCall<T, P> = {
    serialize: Serializer<T, P|null|undefined>
    deserialize: Deserializer<AdvancedJSONPrimitive<P>|undefined| null,P|null|undefined>
    allowNullCall:true
}
export type SerializeOptionsWithoutNullCall<T, P> = {
    serialize: Serializer<T,P >
    deserialize: Deserializer<AdvancedJSONPrimitive<P>,P>
    allowNullCall?:false
  }

export type SerializeOptions<T, P> = SerializeOptionsWithNullCall<T,P> | SerializeOptionsWithoutNullCall<T, P>
export type Serializers = Record<string | symbol, SerializeOptions<any, any>>
/**
 * Serialize Decorator is a Property Decorator
 * 
 * This used to provide the de/serializing functions to be used on the property when transforming the object to JSON
 * 
 * @param options 
 * @param options.serialize - serializing function
 * @param options.deserialize - deserializing function
 * @param options.allowNullCall - if this is true then the de/serializer will be called even on null|undefined values
 * 
 * @default options.allowNullCall false
 * 
 */
export const Serialize = <T, P>({
    serialize,
    deserialize,
    allowNullCall
}: SerializeOptions<T, P>): PropertyDecorator =>{
    return (target, propertyKey) => {
        Reflect.defineMetadata(
            SerializeSymbol,
            { serialize, deserialize, allowNullCall },
            target,
            propertyKey,
        )

        const serializers: Serializers =
            Reflect.getMetadata(SerializeSymbol, target) ?? {}
        serializers[propertyKey] = { serialize, deserialize,allowNullCall }

        Reflect.defineMetadata(SerializeSymbol, serializers, target)
    }
}

export const DateSerializers  = <T>()=> Serialize<T,Date>({serialize:(value)=>value.toString(),deserialize:(value)=> new Date(value)})
