import { DATA_REFERENCE, SYMBOL_PREFIX } from "../helpers/consts";
import { join } from "../helpers/join";
import { Model,TranspilerRelation as TranspilerRelation } from "../global-types";

// TODO fix local and foreign field changes due to isMaster

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

type ModelWithoutRelations = Omit<Model,'relations'>
type TranspilerRelationWithModels = TranspilerRelation & {localModel:ModelWithoutRelations,foreignModel:ModelWithoutRelations,}
export type ModelWithEnhancedRelations  = Model & {relations:TranspilerRelationWithModels[]}
export class Relation {
	public relationType: RelationTypes;
	public sides: ModelWithoutRelations[] = [];
	public fields: string[] = [];
	private _references: string[] = [];
	public name:string;
	sideIds: (0 | 1)[] = [0, 1];
	protected _isMaster: boolean = true
	constructor(
		options?: {
			relationType?: RelationTypes;
			sides?: ModelWithoutRelations[];
			fields?: string[];
			references?: string[];
			name?: string;
			isMaster?:Boolean
		},
		private reverse?: boolean
	) {
		this.name = options?.name;
		this.relationType = options?.relationType ?? RelationTypes.ONE_TO_ONE;
		this.sides = options?.sides ?? [];
		this.fields = options?.fields ?? [];
		this._references = options?.references ?? [];
		this._isMaster = Boolean(options?.isMaster);
		if (this.reverse) this.sideIds = [1, 0];
	}

	static fromTranspilerRelation({foreignField,foreignModel,localField,localModel,relationType,name}: TranspilerRelationWithModels ):Relation{
		return new Relation({
			name,
			relationType: relationType as RelationTypes,
			fields:[localField.name,foreignField.name],
			sides:[localModel,foreignModel],
			isMaster:Boolean(localField.isArray)
			//todo add missing
		})
		
	}
	static fromModel<B extends string = 'map' |'array'>(model:Model,returnType?:B): B extends 'array'? Relation[]:Record<string,Relation>{
		//@ts-ignore
		if(returnType === 'array' as const){
			//@ts-ignore
			return model.relations.map(this.fromTranspilerRelation)
		}else{
			//@ts-ignore
			return Object.fromEntries(model.relations.map((rel)=>[rel.name,this.fromTranspilerRelation(rel)]))
		}
	}
	setReference(idx: 0 | 1, reference: string) {
		if (idx !== 0 && idx !== 1) throw new Error("reference index can't be anything other than 0 or 1");
		this._references[this.sideIds[idx]] = reference;
	}

	getReference(idx: 0 | 1) {
		if (idx !== 0 && idx !== 1) throw new Error("reference index can't be anything other than 0 or 1");
		if (!this.sides || !this.sides[0] || !this.sides[1]) throw new Error("Error in defining relationship ");

		return (
			this._references[this.sideIds[idx]] ??
			join(
				DATA_REFERENCE,
				this.relationType,
				this.fields[this.sideIds[idx]] //+ (this.relationType === RelationTypes.MANY_TO_MANY ? "" : "ID")
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

	getSide(idx: number) {
		if (idx !== 0 && idx !== 1) throw new Error(" index can't be anything other than 0 or 1");

		return this.sides[this.sideIds[idx]];
	}
	get localSide() {
		return this.getSide(0);
	}
	get foreignSide() {
		return this.getSide(1);
	}

	getCollectionPath(idx: number) {
		if (idx !== 0 && idx !== 1) throw new Error("reference index can't be anything other than 0 or 1");
		if (!this.sides || !this.sides[0] || !this.sides[1]) throw new Error("Error in defining relationship ");
		return this.sides?.[this.sideIds[idx]]?.path;
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

	isLocal(entity: string|Model) {
		const idx = this.sideIds[0]; //Added
		if (typeof entity  === 'string') {
			return this.sides?.[idx].name === entity;
		}else{
			return this.sides?.[idx].name === entity.name;
		}
	}
	isForeign(entity: string|Model) {
		const idx = this.sideIds[1]; //Added
		if (typeof entity  === 'string') {
			return this.sides?.[idx].name === entity;
			
		}else{
			return this.sides?.[idx].name === entity.name;

		}
	}

	get isMaster() {
		return !this.isSlave;
	}
	get isSlave() {
		// return Boolean(this.reverse);
		return (this.reverse)? this._isMaster : !this._isMaster
	}
	withSide(side: string|Model) {
		// console.log({ side, sides: this.sides });
		if (this.isLocal(side)) {
			return this;
		} else if (this.isForeign(side)) {
			return new Relation({ ...this, references: this._references,isMaster:this._isMaster}, !this.reverse); //Added
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