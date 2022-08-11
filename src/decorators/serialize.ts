import 'reflect-metadata'
import { SYMBOL_PREFIX } from '../helpers/consts'
/**
 * @internal
 */
export const SerializeSymbol = Symbol.for(SYMBOL_PREFIX+':serialize')

/**
 * A Type of A Function that serializes the data to JSON
 * @typeParam T - the type of the Parent Object containing the property to be serialized
 * @typeParam P - type of the property to be serialized
 */
export type Serializer<T, P> = (value: P, object: T) => any

/**
 * A Type of A Function that serializes the data to JSON
 * @typeParam D - the type of serialized property ( checkout the Type {@link AdvancedJSONPrimitive | AdvancedJSONPrimitive<P\>} )
 * @typeParam P - type of the property after Deserializing 
 */
export type Deserializer<D extends (AdvancedJSONPrimitive<P>|undefined| null),P> = (value: D, object: any) => P


export type JSONPrimitive = string | number | boolean | Record<string,any> | any[]

/**
 * This type predicts the type of the Json primitive depending on the type of property
 * 
 *  - if it's a number then number 
 * 
 *  - if it's a boolean then boolean 
 * 
 *  - if it's a string then string
 * 
 *  - else it's any (could be an array | map | string | null)
 * 
 * @typeParam T - the type that is used to predict the Json primitive type
 * 
 */
export type AdvancedJSONPrimitive<T> = (T extends number? number : T extends boolean? boolean : T extends string? string : any )

/**
 * Options object passed to the function {@link Serialize}
 * @typeParam T - the type of the Parent Object containing the property to be serialized
 * @typeParam P - type of the property to be serialized
 * 
 * @property allowNullCall is set to true this means that the de/serializing functions will be called even if the values are null|undefined
 * @related SerializeOptionsWithoutNullCall
 */
export type SerializeOptionsWithNullCall<T, P> = {
    serialize: Serializer<T, P|null|undefined>
    deserialize: Deserializer<AdvancedJSONPrimitive<P>|undefined| null,P|null|undefined>
    allowNullCall:true
}

/**
 * Options object passed to the function {@link Serialize}
 * @typeParam T - the type of the Parent Object containing the property to be serialized
 * @typeParam P - type of the property to be serialized
 * 
 * @property allowNullCall is set to false|undefined this means that the de/serializing functions will not be called when the values are null|undefined
 * @related SerializeOptionsWithoutNullCall
 */
export type SerializeOptionsWithoutNullCall<T, P> = {
    serialize: Serializer<T,P >
    deserialize: Deserializer<AdvancedJSONPrimitive<P>,P>
    allowNullCall?:false
  }

/**
 * A union type of {@link SerializeOptionsWithoutNullCall | SerializeOptionsWithoutNullCall<T, P\> } and {@link SerializeOptionsWithNullCall | SerializeOptionsWithNullCall<T, P\> }
 * 
 * @see {@link SerializeOptionsWithoutNullCall | SerializeOptionsWithoutNullCall<T, P\> } 
 * @see {@link SerializeOptionsWithNullCall | SerializeOptionsWithNullCall<T, P\> }
 */
export type SerializeOptions<T, P> = SerializeOptionsWithNullCall<T,P> | SerializeOptionsWithoutNullCall<T, P>

export type Serializers = Record<string | symbol, SerializeOptions<any, any>>



/**
 * Serialize Decorator is a Property Decorator
 * @decorator
 * This used to provide the de/serializing functions to be used on the property when transforming the object to JSON
 * 
 * @param options 
 * @param options.serialize - serializing function
 * @param options.deserialize - deserializing function
 * @param options.allowNullCall - if this is true then the de/serializer will be called even on null|undefined values
 * 
 * @defaultValue options.allowNullCall false
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

/**
 * This a default Date { @link Serialize } Decorator that will use the native JS Date Class to serialize and deserialize the dates
 * 
 * use this to serialize the dates by default 
 * @decorator
 * 
 * @example
 * ```ts
 * @FrostEntity(...)
 * class A extends FrostObject {
 *      @DateSerializer()
 *      createdAt?: Date;
 * }
 * ```
 */
export const DateSerializer  = <T>()=> Serialize<T,Date>({serialize:(value)=>value.toString(),deserialize:(value)=> new Date(value)})
