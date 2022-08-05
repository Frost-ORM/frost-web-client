import { Database } from '@firebase/database';
import { FrostApi } from './frost-api';
import { FrostObject, IFrostObject } from './frost-object';



/**
 * This decorator allows you to declare an api class and provide the FrostObject Class to it
 * This decorator is used to mark classes that extend {@link FrostApi | FrostApi\<T extends FrostObject\>}
 * 
 * @decorator
 * 
 * @example
 * ```ts
 * @FrostEntity({collectionPath : "/users"})
 * class User extends FrostObject {
 * ...
 * }
 * 
 * @FrostNode({entity : User})
 * class UsersApi extends FrostApi<User> {
 * }
 * ```
 * 
 * @param options - Api Options
 * @param options.entity - the class that extends the FrostObject Class
 */
export function FrostNode<T extends FrostObject, I extends IFrostObject<T>>({
    entity,
}: {
    entity: I;
}) {
    return function _FrostApi<E extends { new(...args: any[]): FrostApi<T>; }>(
        constructor: E
    ) {
        return class extends constructor {
            constructor(...args: any[]) {
                super(...args)
                this.collectionPath = entity.collectionPath
                this.entity = entity
            }
        }
        // Object.defineProperty(constructor.prototype, "entity", { value: entity, writable: false, enumerable: false });
        // Object.defineProperty(constructor.prototype, "collectionPath", { value: entity.collectionPath, writable: false, enumerable: false });
    };
}
