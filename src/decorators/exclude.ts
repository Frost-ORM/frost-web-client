import 'reflect-metadata'
import { SYMBOL_PREFIX } from '../helpers/consts'

export const ExcludedSymbol = Symbol.for(SYMBOL_PREFIX + ':exclude')

/**
 * This decorator allows you to add properties to the Class that extends FireDbObject while excluding them from the database.
 *
 * The Property that is marked by this decorator will not be serialized and add to the node in firebase real-time database.
 *
 * @returns @link PropertyDecorator
 */
export const Exclude = (): PropertyDecorator => {
    return (target, propertyKey) => {
        const exclude = new Set(
            Reflect.getMetadata(ExcludedSymbol, target) ?? [],
        )
        exclude.add(propertyKey)
        Reflect.defineMetadata(ExcludedSymbol, [...exclude], target)
    }
}
