import {
  NodeRelationsSymbol, RelationTypes,
  __frost__relations
} from './relation';
import * as _ from 'lodash';
import { Serializers, SerializeSymbol } from './serialize';
import { ExcludedSymbol } from './exclude';
import { DATA_REFERENCE } from '../helpers/consts';
import { FrostObject } from './frost-object';

/*
TODO
[x] flatten
[ ] setters/getters
[x] serialize/deserialize
[x] exclude

[ ] many-to-many with $ or {connected:true}
[x] disconnect all
[x] getIndexOn

[x] listen to nested
[x] query Observable

 [ ] fix connect already connected 
 [ ] updateMap connect one possible array
 [ ] mappedType for connect options

 [ ] migrate
 [ ] code-gen

 Caveats:
  null assertion in props
  limit to join add maps
  have to use fetched objects with disconnect all or true
 */



export type FrostEntityDecoratorOptions = {
  collectionPath: string;
};

const FrostEntityOld = ({
  collectionPath,
}: FrostEntityDecoratorOptions) => {
  return <T extends { new(...args: any[]): FrostObject; }>(constructor: T) => {


    let c = class extends constructor {
      static collectionPath = collectionPath;

      constructor(...args: any[]) {
        let data = args[0];
        super(...args);
        let toBeOmitted: string[] = [];
        /* region deserialize */
        const serializers: Serializers = Reflect.getMetadata(SerializeSymbol, this) ?? {};

        Object.entries(serializers).forEach(
          ([key, { deserialize, allowNullCall }]) => {
            if (data[key] || allowNullCall) {
              this[key] = deserialize(data[key], data);
              toBeOmitted.push(key);
            }
          }
        );
        /* endregion deserialize */
        /* region relations */
        const relations: string[] = Reflect.getMetadata(NodeRelationsSymbol, this) ?? [];
        relations
          .map(key => __frost__relations[key].withSide(constructor))
          .forEach(relation => {
            const propertyKey = relation.fields[0];
            toBeOmitted.push(propertyKey);
            let type = relation.sides?.[1]?.();
            if (args?.[0]?.[propertyKey] && type) {
              if (relation.relationType ===
                RelationTypes.ONE_TO_ONE) {
                //@ts-ignore
                this[propertyKey] = () => new type(args?.[0]?.[propertyKey]);
              } else {
                //@ts-ignore
                this[propertyKey] = () => Object.values(
                  args?.[0]?.[propertyKey] ?? {}
                ).map(element => new (type())(element));
              }
            }
          });
        Object.assign(this, {
          [DATA_REFERENCE]: args[0]?.[DATA_REFERENCE],
        });

        const excluded: string[] = Reflect.getMetadata(ExcludedSymbol, this) ?? [];


        Object.assign(this, { ...(_.omit(data, [...excluded, ...toBeOmitted])) });
        /* endregion relations */
        // console.log(
        //     Reflect.getMetadata(RelationSymbol,this,'test'),
        //     Reflect.getMetadataKeys(this,'test'),
        //     Reflect.hasMetadata(RelationSymbol,this,'test'),
        //     '\n',
        //     Reflect.getMetadata('props',this),
        //     Reflect.getMetadataKeys(this),
        //     Reflect.hasMetadata('props',this),
        // )
      }
    };
    Object.defineProperty(c, 'name', { value: constructor.name });
    return c;
  };
};

/**
 * This decorator allows you to declare a class as a node in FirebaseDB and provide the path for it 
 *
 * This decorator is used to mark classes that extend {@link FrostObject}
 * 
 * @decorator
 * 
 * @example
 * ```ts
 * @FrostEntity({collectionPath : "/users"})
 * class User extends FrostObject {
 * }
 * ```
 * 
 * @param options - Entity Options
 * @param options.collectionPath - the path of the node in firebaseDB
 * @returns {ClassDecorator}
 */
export const FrostEntity = ({
  collectionPath,
}: FrostEntityDecoratorOptions) => {
  return <T extends { new(...args: any[]): FrostObject; }>(constructor: T) => {
    Object.defineProperty(constructor, 'collectionPath', { value: collectionPath });
  };
};
