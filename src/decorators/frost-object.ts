import * as _ from "lodash";
import { DATA_REFERENCE, SYMBOL_PREFIX } from "../helpers/consts";
import { slashToDotJoin } from "../helpers/slashToDotJoin";
import { KeysOfEntriesWithType } from "../types-helpers/entries";
import { OmitAllFunctions } from "../types-helpers/omit";
import { ExcludedSymbol } from "./exclude";
import { NodeRelationsSymbol, Prop, RelationTypes, __frost__relations } from "./relation";
import { Serializers, SerializeSymbol } from "./serialize";

export const PropsSymbol = Symbol.for(SYMBOL_PREFIX + ":props");
export const RelatedSymbol = Symbol.for(SYMBOL_PREFIX + ":related");

export type Related = Prop & { entity: any };
export class FrostObject<C = {id?:string}>{
	static collectionPath: string;
    /**
     * all FrostObjects should have the id property, you can override it in the derived class 
     */
	id?: string;
    
    // abstract static fromMap<T>(): T extends FireDBObject

	constructor(data:OmitAllFunctions<C>& Record<any,any>,...args) {
		let toBeOmitted: string[] = [];
		const serializers: Serializers = Reflect.getMetadata(SerializeSymbol, this) ?? {};

		Object.entries(serializers).forEach(([key, { deserialize, allowNullCall }]) => {
			if (data?.[key] || allowNullCall) {
				this[key] = deserialize(data[key], data);
				toBeOmitted.push(key);
			}
		});
		/* endregion deserialize */
		/* region relations */
		const relations: string[] = Reflect.getMetadata(NodeRelationsSymbol, this) ?? [];
		relations
			.map((key) => __frost__relations[key].withSide(this.constructor))
			.forEach((relation) => {
				const propertyKey = relation.fields[0];
				toBeOmitted.push(propertyKey);
				let type = relation.sides?.[1]?.();
				if (args?.[0]?.[propertyKey] && type) {
					if (relation.relationType === RelationTypes.ONE_TO_ONE) {
						//@ts-ignore
						this[propertyKey] = () => new type(args?.[0]?.[propertyKey]);
					} else {
						//@ts-ignore
						this[propertyKey] = () =>
							Object.values(args?.[0]?.[propertyKey] ?? {}).map((element) => new type(element));
					}
				}
			});
		Object.assign(this, {
			[DATA_REFERENCE]: data[DATA_REFERENCE],
		});
		const excluded: string[] = Reflect.getMetadata(ExcludedSymbol, this) ?? [];

		Object.assign(this, { ..._.omit(data, [...excluded, ...toBeOmitted]) });
	}


    /**
     * 
     * @param propertyName - the name of the property with the relation which keys' you require.
	 * @returns an array containing the ids of the instances that are connected. if there are no connected keys or the property name is incorrect then there'll be no key-value pair for the specific property
	 */
	getConnectedKeys(propertyName: string): string[] | null {
		let relationName = Reflect.getMetadata(NodeRelationsSymbol, this.constructor.prototype, propertyName);

		if (relationName && __frost__relations[relationName]) {
			let relation = __frost__relations[relationName].withSide(this.constructor);
			let keys = _.get(this, slashToDotJoin(relation.localReference));
            if (!keys) return null;
            if (
                relation.relationType === RelationTypes.ONE_TO_ONE ||
                (relation.relationType === RelationTypes.ONE_TO_MANY && relation.isSlave)
            ) {
                keys = [keys];
            } else {
                keys = Object.keys(keys ?? {});
            }
			return keys;

		}
		return null;
	}

    /**
     * @see {@link FrostObject.getConnectedKeys}
     * 
     * @param propertyName - the name of the property with the relation which keys' you require.
     * @param object - the object instance that you want to get the keys from
	 * @returns an array containing the ids of the instances that are connected. if there are no connected keys or the property name is incorrect then there'll be no key-value pair for the specific property
	 */
	static getConnectedKeys(propertyName: string, object: any): string[] | null {
		let relationName = Reflect.getMetadata(NodeRelationsSymbol, this.prototype, propertyName);

		if (relationName && __frost__relations[relationName]) {
			let relation = __frost__relations[relationName].withSide(this);
			let keys = _.get(object, slashToDotJoin(relation.localReference));
            if (!keys) return null;
            if (
                relation.relationType === RelationTypes.ONE_TO_ONE ||
                (relation.relationType === RelationTypes.ONE_TO_MANY && relation.isSlave)
            ) {
                keys = [keys];
            } else {
                keys = Object.keys(keys ?? {});
            }
			return keys;
		}
		return null;
	}

	/**
     * @see {@link FrostObject.getConnectedKeys}
	 * @returns a map with keys being all the properties with relations and the values being an array containing the ids of the instances that are connected. if there are no connected keys there'll be no key-value pair for the specific property
	 */
	getAllConnectedKeys(): Record<string, string[]> {
		let relationNames = Reflect.getMetadata(NodeRelationsSymbol, this.constructor.prototype);
		return Object.fromEntries(
			relationNames
				.map((relationName) => {
					if (relationName && __frost__relations[relationName]) {
						let relation = __frost__relations[relationName].withSide(this.constructor);
						let keys = _.get(this, slashToDotJoin(relation.localReference));
						console.log(keys);
						if (!keys) return null;
						if (
							relation.relationType === RelationTypes.ONE_TO_ONE ||
							(relation.relationType === RelationTypes.ONE_TO_MANY && relation.isSlave)
						) {
							keys = [keys];
						} else {
							keys = Object.keys(keys ?? {});
						}
						return [relation.localField, keys];
					}
					return null;
				})
				.filter(Boolean)
		);
	}

	/**
	 * This flattens the object and transforms into a plain js object and transforms the properties with relations from functions that return values to direct values
	 * This is beneficial in case you don't want to deal with functions that return the data.
     * @param withExcluded - to determine whether the flattened object should contain the excluded properties or not.
     * @defaultValue withExcluded true
	 * @returns plain js object containing the all the values of the main object, along with related objects as plain js arrays and maps.
	 */
	flatten(withExcluded = true): any {
		let data = JSON.parse(JSON.stringify(this));

		const relations: string[] = Reflect.getMetadata(NodeRelationsSymbol, this) ?? [];
		relations
			.map((key) => __frost__relations[key].withSide(this.constructor))
			.forEach((relation) => {
				const propertyKey = relation.localField;
				data[propertyKey] = this[propertyKey]?.();
			});
		if (!withExcluded) {
			const excluded: string[] = Reflect.getMetadata(ExcludedSymbol, this) ?? {};
			data = _.omit(data, excluded);
		}
		return data;
	}

	/**
	 *
	 * @returns plain js object containing the all the values of the main object after all the serializers have been applied. (without related objects)
	 */
	serialize(): any {
		let data = JSON.parse(JSON.stringify(this));
		const serializers: Serializers = Reflect.getMetadata(SerializeSymbol, this) ?? {};
		const excluded: string[] = Reflect.getMetadata(ExcludedSymbol, this) ?? [];
		Object.entries(serializers).forEach(([key, { serialize, allowNullCall }]) => {
			if (this[key] || allowNullCall) {
				data[key] = serialize(this[key], this);
			}
		});

		return _.omit(data, excluded);
	}
}
export type IFrostObject<T extends FrostObject> = Omit<typeof FrostObject, "new"> & { new (...args: any[]): T };
export type KeysOfEntriesWithRelation<T extends FrostObject> = Exclude<KeysOfEntriesWithType<T,Function|undefined>,KeysOfEntriesWithType<FrostObject,Function>>
