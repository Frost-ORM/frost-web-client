import "reflect-metadata";
import { DATA_REFERENCE, SYMBOL_PREFIX } from "../helpers/consts";
import { join } from "../helpers/join";

/**
 * @internal
 */
export const __frost__relations: Record<string, Relations> = {};
/**
 * @internal
 */
const __frost__relations_tmp: Record<string, (RelationOptions & { propertyKey: string | symbol })[]> = {};
/**
 * @internal
 */
export const RelationSymbol = Symbol.for(SYMBOL_PREFIX + ":relation");
/**
 * @internal
 */
export const NodeRelationsSymbol = Symbol.for(SYMBOL_PREFIX + ":node-relations");

export enum RelationTypes {
	ONE_TO_ONE = "one_to_one",
	ONE_TO_MANY = "one_to_many",
	MANY_TO_ONE = "one_to_many",
	MANY_TO_MANY = "many_to_many",
}
/**
 * @internal
 */
export const ALL_RELATIONS = [RelationTypes.ONE_TO_ONE, RelationTypes.MANY_TO_MANY, RelationTypes.ONE_TO_MANY];
/**
 * @internal
 */
export type Prop = {
	propertyKey: string;
	metadata: {
		field: string;
		reference: string;
		relation: RelationTypes;
		type: any;
	};
};

/**
 * This decorator allows you to define the relations between the properties of {@link FrostEntity | FrostEntities}
 * @decorator
 * :::caution
 * The Relation is defined on both sides but one side is the main side and the other is secondary.
 *
 * In case of symmetric relation the order of the sides doesn't matter but with ***One-to-Many*** the main side should be the `One` side.
 * The main side should have the master property equal true.
 * :::
 *
 * @example
 * ```ts
 * @FrostEntity({collectionPath:"/a"})
 * class A extends FrostObject{
 * ...
 * @Relation({
 *  name: "AB",
 *  relation: RelationTypes.ONE_TO_MANY,
 *  type: () => B,
 * })
 * b?:B[]
 *
 * ...
 * }
 *
 * @FrostEntity({collectionPath:"/b"})
 * class B extends FrostObject{
 * ...
 * @Relation({
 *  name: "AB",
 *  type: () => A,
 * })
 * a?:() => A
 *
 * ...
 * }
 * ```
 * @param {RelationOptions} options  - options that define the relation. for more details. @see {@link RelationOptions}
 *
 */
export const Relation = ({
	name,
	relation: relationType,
	type,
	reference,
	master,
}: RelationOptions): PropertyDecorator => {
	return (target, propertyKey) => {
        const relations = new Set(Reflect.getMetadata(NodeRelationsSymbol, target) ?? []);
		relations.add(name);
		Reflect.defineMetadata(NodeRelationsSymbol, name, target, propertyKey);
		Reflect.defineMetadata(NodeRelationsSymbol, [...relations], target);
        
		__frost__relations_tmp[name] = [
			...(__frost__relations_tmp[name] ?? []),
			{
				name,
				relation: relationType,
				type,
				reference,
				master,
				propertyKey,
			},
		];
		if (__frost__relations_tmp[name].length > 2)
			throw new Error(`Relation "${name}" cannot have more than two sides`);
		if (__frost__relations_tmp[name].length != 2) return;

		let defs = __frost__relations_tmp[name];
		let rel = new Relations();
		rel.relationType = defs[0].relation ?? defs[1].relation;
        // console.log(defs[0].relation, defs[1].relation)
		if (!rel.relationType) {
			throw new Error(`Relation type is not defined on either side of the \`${name}\` relation`);
		}

		

		for (const { name, type, reference, master, propertyKey } of defs) {
			switch (rel.relationType) {
				case RelationTypes.ONE_TO_MANY:
				case RelationTypes.MANY_TO_ONE:
					{
						if (master) {
							if (rel.sides[1])
								throw new Error(`Master side is already defined for the \`${name}\` relation`);
							rel.sides[1] = type;
							rel.fields[0] = propertyKey.toString();
							if (reference) rel.setReference(0, reference);
						} else {
							if (rel.sides[0])
								throw new Error(`Slave side is already defined for the \`${name}\` relation`);
							rel.fields[1] = propertyKey.toString();
							if (reference) rel.setReference(1, reference);
							rel.sides[0] = type;
						}
					}
					break;
				case RelationTypes.ONE_TO_ONE:
				case RelationTypes.MANY_TO_MANY:
					{
						if (rel.sides[0]) {
							rel.sides[1] = type;
							rel.fields[0] = propertyKey.toString();
							if (reference) rel.setReference(0, reference);
						} else {
							rel.fields[1] = propertyKey.toString();
							if (reference) rel.setReference(1, reference);
							rel.sides[0] = type;
						}
					}
					break;
			}
		}

		__frost__relations[name] = rel;
	};
};

/**
 *
 * Interface of the options that are passed to the {@link Relation} Decorator
 *
 * @example
 * ```ts
 * class A extends FrostObject{
 * ...
 * @Relation({
 *  name: "AB",
 * relation: RelationTypes.ONE_TO_MANY,
 * type: () => B,
 * })
 * b?:() => B[]
 *
 * ...
 * }
 * ```
 */
export type RelationOptions = {
	/**
	 * the name of the relation, It should be the same on both sides
	 */
	name: string;

	/**
	 * (unrecommended)
	 * the name of the local field that contains the id that the relations is based on. this is optional and actually it's recommend not to use unless needed.
	 * <br/>
	 * Frost by default handles the relations and the stored keys that connect the nodes, but if you need access to these keys you could use the methods ({@link FrostObject.getConnectedKeys}, {@link FrostObject.getAllConnectedKeyss}
	 * or you could set the reference on the relation.
	 */
	reference?: string;

	/**
	 * the relation type [One to One, One to Many, Many to Many]
	 */
	relation?: RelationTypes;

	/**
	 * the data type of the local property that the relation is defined on, (ignore array brackets in case of many-to-many/ one-to-many).<br/>
	 * this is needed because of some limitations in the decorators in TS/JS.<br/>
	 * also it needs to be a function that returns the type to avoid cyclic dependency ```(()=>Type)```
	 *
	 * check the example
	 */
	type: any;

	/**
	 * In Case of Asymmetric (One to Many) relation, to decide which side is the one and which side is the many.
	 */
	master?: boolean;
};
export class Relations {
	public relationType: RelationTypes;
	public sides: (() => any)[] = [];
	public fields: string[] = [];
	private _references: string[] = [];

	sideIds: (0 | 1)[] = [0, 1];

	constructor(
		options?: {
			relationType?: RelationTypes;
			sides?: (() => any)[];
			fields?: string[];
			references?: string[];
		},
		private reverse?: boolean
	) {
		this.relationType = options?.relationType ?? RelationTypes.ONE_TO_ONE;
		this.sides = options?.sides ?? [];
		this.fields = options?.fields ?? [];
		this._references = options?.references ?? [];
		if (this.reverse) this.sideIds = [1, 0];
	}

	setReference(idx: 0 | 1, reference: string) {
		if (idx !== 0 && idx !== 1) throw new Error("reference index can't be anything other than 0 or 1");
		this._references[this.sideIds[idx]] = reference;
	}

	getReference(idx: 0 | 1) {
		if (idx !== 0 && idx !== 1) throw new Error("reference index can't be anything other than 0 or 1");
		if (!this.sides || !this.sides[0]?.() || !this.sides[1]?.()) throw new Error("Error in defining relationship ");

		return (
			this._references[this.sideIds[idx]] ??
			join(
				DATA_REFERENCE,
				this.relationType,
				this.fields[this.sideIds[idx]] + (this.relationType === RelationTypes.MANY_TO_MANY ? "" : "ID")
			)
		);
	}
	get localReference() {
		return this.getReference(0);
	}
	get foreignReference() {
		return this.getReference(1);
	}
	getField(idx: number) {
		if (idx !== 0 && idx !== 1) throw new Error("reference index can't be anything other than 0 or 1");

		return this.fields[this.sideIds[idx]];
	}
	get localField() {
		return this.getField(0);
	}
	get foreignField() {
		return this.getField(1);
	}

	getCollectionPath(idx: number) {
		if (idx !== 0 && idx !== 1) throw new Error("reference index can't be anything other than 0 or 1");
		if (!this.sides || !this.sides[0]?.() || !this.sides[1]?.()) throw new Error("Error in defining relationship ");
		return this.sides?.[this.sideIds[idx]]?.().collectionPath;
	}
	get localCollectionPath() {
		return this.getCollectionPath(0);
	}
	get foreignCollectionPath() {
		return this.getCollectionPath(1);
	}

	getReferences() {
		return [this.getReference(this.sideIds[0]), this.getReference(this.sideIds[1])];
	}

	isLocal(entity: any) {
		return this.sides?.[0]?.().name === entity.name;
	}
	isForeign(entity: any) {
		return this.sides?.[1]?.().name === entity.name;
	}

	get isMaster() {
		return !this.isSlave;
	}
	get isSlave() {
		return Boolean(this.reverse);
	}
	withSide(side: any) {
		// console.log({ side, sides: this.sides });
		if (this.isLocal(side)) {
			return this;
		} else if (this.isForeign(side)) {
			return new Relations({ ...this, references: this.getReferences() }, true);
		} else {
			throw new Error("Doesn't belong to either side");
		}
	}
	// static OneToOne(sides,fields){
	//   return new Relations(RelationTypes.ONE_TO_ONE,sides,fields)
	// }
	// static ManyToMany(sides,fields){
	//   return new Relations(RelationTypes.MANY_TO_MANY,sides,fields)
	// }
	// static OneToMany(master,masterField,slave,slaveField){
	//   return new Relations(RelationTypes.MANY_TO_MANY,[master,slave],[masterField,slaveField])
	// }
}
