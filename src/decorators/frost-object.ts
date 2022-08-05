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

    static getConnectedKeys(propertyName: string,object:FrostObject): string[] | null {

      let relationName = Reflect.getMetadata(
          NodeRelationsSymbol,
          this.prototype,
          propertyName,
      )

      if (relationName && __frost__relations[relationName]) {
          let relation = __frost__relations[relationName].withSide(
              this,
          )
          let keys = _.get(object,slashToDotJoin(relation.localReference))
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




