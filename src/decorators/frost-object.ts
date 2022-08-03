import {
    NodeRelationsSymbol,
    Prop,
    RelationSymbol,
    RelationTypes,
    __frost__relations,
} from './relation'
import {
    getDatabase,
    runTransaction,
    Unsubscribe,
} from 'firebase/database'
import * as _ from 'lodash'
import {
    from,
} from 'rxjs'
import { Serialize, Serializers, SerializeSymbol } from './serialize'
import { Exclude, ExcludedSymbol } from './exclude'
import { DATA_REFERENCE, SYMBOL_PREFIX } from '../helpers/consts'
import { slashToDotJoin } from '../helpers/slashToDotJoin'

export const PropsSymbol = Symbol.for(SYMBOL_PREFIX + ':props')
export const RelatedSymbol = Symbol.for(SYMBOL_PREFIX + ':related')
export type Related = Prop & { entity: any }
/**
 * TODO:
 * [x] flatten
 * [-] setters/getters
 * [x] serialize/deserialize
 * [x] exclude
 *
 * [-] many-to-many with $ or {connected:true}
 * [x] disconnect all
 * [x] getIndexOn
 *
 * [x] listen to nested
 * [Y] query Observable
 *
 *
 * [ ] migrate
 * [ ] code-gen
 *
 * Caveats:
 *  null assertion in props
 *  limit to join add maps
 *  have to use fetched objects with disconnect all or true
 */
export type FrostEntityDecoratorOptions = {
    collectionPath: string
}
export const FrostEntityOld = ({
    collectionPath,
}: FrostEntityDecoratorOptions) => {
    return <T extends { new(...args: any[]): FrostObject} >(constructor: T) => {


      let c = class extends constructor {
        static collectionPath = collectionPath;

        constructor(...args: any[]) {
          let data = args[0]
          super(...args)
          let toBeOmitted:string[] = []
          /* region deserialize */
          const serializers: Serializers = Reflect.getMetadata(SerializeSymbol, this) ?? {}

          Object.entries(serializers).forEach(
            ([key, { deserialize, allowNullCall }]) => {
              if (data[key] || allowNullCall) {
                this[key] = deserialize(data[key], data)
                toBeOmitted.push(key)
              }
            }
          )
          /* endregion deserialize */
          /* region relations */
          const relations: string[] = Reflect.getMetadata(NodeRelationsSymbol, this) ?? []
          relations
            .map(key => __frost__relations[key].withSide(constructor))
            .forEach(relation => {
              const propertyKey = relation.fields[0]
              toBeOmitted.push(propertyKey)
              let type = relation.sides?.[1]?.()
              if (args?.[0]?.[propertyKey] && type) {
                if (relation.relationType ===
                  RelationTypes.ONE_TO_ONE) {
                  //@ts-ignore
                  this[propertyKey] = () => new type(args?.[0]?.[propertyKey])
                } else {
                  //@ts-ignore
                  this[propertyKey] = () => Object.values(
                    args?.[0]?.[propertyKey] ?? {}
                  ).map(element => new (type())(element))
                }
              }
            })
          Object.assign(this, {
            [DATA_REFERENCE]: args[0]?.[DATA_REFERENCE],
          })

          const excluded: string[] =
            Reflect.getMetadata(ExcludedSymbol, this) ?? []


            Object.assign(this, {...(_.omit(data, [...excluded,...toBeOmitted]))})
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
      }
      Object.defineProperty(c, 'name', { value: constructor.name })
      return c
    }
}
export const FrostEntity = ({
    collectionPath,
}: FrostEntityDecoratorOptions) => {
    return <T extends { new(...args: any[]): FrostObject} >(constructor: T) => {
      Object.defineProperty(constructor, 'collectionPath', { value: collectionPath })
    }
}

export class FrostObject {
    static collectionPath: string
    id?: string
    // abstract static fromMap<T>(): T extends FireDBObject

    constructor(...args){
      let data = args[0]
      let toBeOmitted:string[] = []
      const serializers: Serializers = Reflect.getMetadata(SerializeSymbol, this) ?? {}

      Object.entries(serializers).forEach(
        ([key, { deserialize, allowNullCall }]) => {
          if (data?.[key] || allowNullCall) {
            this[key] = deserialize(data[key], data)
            toBeOmitted.push(key)
          }
        }
      )
      /* endregion deserialize */
      /* region relations */
      const relations: string[] = Reflect.getMetadata(NodeRelationsSymbol, this) ?? []
      relations
        .map(key => __frost__relations[key].withSide(this.constructor))
        .forEach(relation => {
          const propertyKey = relation.fields[0]
          toBeOmitted.push(propertyKey)
          let type = relation.sides?.[1]?.()
          if (args?.[0]?.[propertyKey] && type) {
            if (relation.relationType ===
              RelationTypes.ONE_TO_ONE) {
              //@ts-ignore
              this[propertyKey] = () => new type(args?.[0]?.[propertyKey])
            } else {
              //@ts-ignore
              this[propertyKey] = () => Object.values(
                args?.[0]?.[propertyKey] ?? {}
              ).map(element => new type(element))
            }
          }
        })
      Object.assign(this, {
        [DATA_REFERENCE]: args[0][DATA_REFERENCE],
      })
      const excluded: string[] =
      Reflect.getMetadata(ExcludedSymbol, this) ?? []

      Object.assign(this, {...(_.omit(data, [...excluded,...toBeOmitted]))})

    }
    getConnectedKeys(propertyName: string): string[] | null {
        let relationName = Reflect.getMetadata(
            NodeRelationsSymbol,
            this.constructor.prototype,
            propertyName,
        )

        if (relationName && __frost__relations[relationName]) {
            let relation = __frost__relations[relationName].withSide(
                this.constructor,
            )
            let keys = _.get(this,slashToDotJoin(relation.localReference))
            if (relation.relationType === RelationTypes.ONE_TO_ONE) {
                keys = [keys]
            } else {
                keys = Object.keys(keys ?? {})
            }
            return keys
        }
        return null
    }
    getAllConnectedKeys(): Record<string,string[]> {
        let relationNames = Reflect.getMetadata(
            NodeRelationsSymbol,
            this.constructor.prototype,
        )
        return Object.fromEntries(
          relationNames.map(
          (relationName)=>{
            if (relationName && __frost__relations[relationName]) {
              let relation = __frost__relations[relationName].withSide(
                  this.constructor,
              )
              let keys = _.get(this,slashToDotJoin(relation.localReference))
              console.log(keys)
              if(!keys) return null
              if ((relation.relationType === RelationTypes.ONE_TO_ONE || (relation.relationType === RelationTypes.ONE_TO_MANY && relation.isSlave))) {
                  keys = [keys]
              } else {
                  keys = Object.keys(keys ?? {})
              }
              return [relation.localField,keys]
          }
          return null
          }
        ).filter(Boolean)
        )


    }

    flatten(withExcluded = true): any {
        let data = JSON.parse(JSON.stringify(this))

        const relations: string[] =
            Reflect.getMetadata(NodeRelationsSymbol, this) ?? []
        relations
            .map(key => __frost__relations[key].withSide(this.constructor))
            .forEach(relation => {
                const propertyKey = relation.localField
                data[propertyKey] = this[propertyKey]?.()
            })
        if (!withExcluded) {
            const excluded: string[] =
                Reflect.getMetadata(ExcludedSymbol, this) ?? {}
            data = _.omit(data, excluded)
        }
        return data
    }

    serialize(): any {
        let data = JSON.parse(JSON.stringify(this))
        const serializers: Serializers =
            Reflect.getMetadata(SerializeSymbol, this) ?? {}
        const excluded: string[] =
            Reflect.getMetadata(ExcludedSymbol, this) ?? []
        Object.entries(serializers).forEach(
            ([key, { serialize, allowNullCall }]) => {
                if (this[key] || allowNullCall) {
                    data[key] = serialize(this[key], this)
                }
            },
        )

        return _.omit(data, excluded)
    }

}
export type IFrostObject<T extends FrostObject> = Omit<
    typeof FrostObject,
    'new'
> & { new (...args: any[]): T }




