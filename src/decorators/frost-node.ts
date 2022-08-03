import { Database } from '@firebase/database';
import { FrostApi } from './frost-api';
import { FrostObject, IFrostObject } from './frost-object';




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
