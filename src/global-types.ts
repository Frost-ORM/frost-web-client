
export type OneToManyMetadata = Record<string, boolean | null | undefined>;

export type ManyToManyMetadata = Record<string, { connected?: boolean | null; lastChange: string } | null | undefined>;

/**
 * an array of the property names with relations that you want to be included in the fetch request.
 *
 * if the array is empty or undefined no relations will be included
 *
 */
export type IncludeOptions<T extends PropertyKey = PropertyKey> = Partial<Record<T, boolean>>;
export type With<T, R extends Record<PropertyKey, any>, I extends IncludeOptions> = T & Pick<R, keyof I>;

export type RelationType = "one_to_one" | "one_to_many" | "many_to_many";

export type RelationTypeWithSubTypes =
	| "one_to_one"
	| "one_to_many"
	| "many_to_many"
	| "one_to_many_master_fields"
	| "one_to_many_slave_fields";


/**
 * The related instances to connect
 *
 * - undefined which won't connect any relations or
 * - a map with the keys of the properties to connect and the possible values are one of the following:
 * 	- Incase of One to One: the string of the id of the instance to be connected
 * 	- Incase of Many to Many: an array of the ids of the instances to be connected
 * 	- Incase of Many to Many:
 * 		- From the One side:  an array of the ids of the instances to be connected
 * 		- From the Many side: the string of the id of the instance to be connected
 *
 * @example Symmetric: One-to-One and Many-to-Many
 * ```json
 * {
 * 	"studentProfileData":"-N8ZU2qq5erVSvauDtuR", // One-to-One
 * 	"courses": [
 * 		"-N8ZU2tQNvC_1GV5kMa8",
 *		"-N8ZU2w3diHdn0b5AIsB",
 *		"-N8ZU30J_KfcwcRlUcPK",
 *		"-N8ZU33c0V8yIB-7oDV3",
 * ],// Many-to-Many
 * }
 *```
 *
 * @example One-to-Many (One Side)
 * ```json
 * {
 * 	"posts":[
 *		"-N8ZU2tQNvC_1GV5kMa8",
 *		"-N8ZU2w3diHdn0b5AIsB",
 *		"-N8ZU30J_KfcwcRlUcPK",
 *		"-N8ZU33c0V8yIB-7oDV3",
 *	],
 * }
 * ```
 * @example  One-to-Many (Many Side)
 * ```json
 * {
 * 	"author":"-N8ZU2qq5erVSvauDtuR",
 * }
 * ```
 */
export type ConnectOptions<T extends Partial<Record<RelationType, any>>> = Partial<
	Record<T["one_to_one"], string> &
    Record<T["one_to_many" | "many_to_many"], string[]>
>;

/**
 * The related instances to disconnect
 * 
 * - Either the string `all` which will disconnect all relations or
 * - undefined which won't disconnect any relations or
 * - a map with the keys of the properties to disconnect and the possible values are one of the following:
 * 	- `all`|true, works with all relation types. will disconnect everything
 * 	- Incase of One to One: the string of the id of the connected instance
 * 	- Incase of Many to Many: an array of the ids of the connected instances
 * 	- Incase of Many to Many:
 * 		- From the One side:  an array of the ids of the connected instances
 * 		- From the Many side: the string of the id of the connected instance
 * @example All Relations
 * ```json
 * "all"
 *```

 * @example All specific relations
 * ```json
 * {
 * 	"posts": "all",
 * 	"comments": "all",
 * }
 * //OR 
 * {
 * 	"posts": true,
 *  "comments": true,
 * }
 * ```
 * @example  Disconnect specific nodes
 * ```json
 * {
 * 	"posts": [
 * 		"-N8ZU2tQNvC_1GV5kMa8",
 *		"-N8ZU2w3diHdn0b5AIsB",
 *		"-N8ZU30J_KfcwcRlUcPK",
 *		"-N8ZU33c0V8yIB-7oDV3",
 * ],
 *  "comments": [
 * 		"-N8ZU24sYM2NoXV1NdA2",
 * 		"-N8ZU2oH4rRaaWaA2M8Y",
 * ],
 * }
 *```

 */
export type DisconnectOptions<T extends Partial<Record<RelationTypeWithSubTypes, any>>> = Partial<
    Record<T["one_to_one"], string | true> &
    Record<T["one_to_many_master_fields"], string | true> &
    Record<T["one_to_many_slave_fields"], string[] | true | "all"> &
    Record<T["many_to_many"], string[] | true | "all">
> | boolean | 'all';


export type FrostObject = {
    id?:string
}


export type RelationField = {
	name: string;
	isArray?: boolean;
};
export type Relation = {
	relationType: RelationType;
	name: string;
	localModelName: string;
	foreignModelName: string;
	localField: RelationField;
	foreignField: RelationField;
};
export type Property = {
	name: string;
	optional?: boolean;
	isArray?: boolean;
	type: string;
};

export type Model = {
	path: string;
	name: string;
	properties: Property[];
	relations: Relation[];
};

export type FrostMetadata = {
	__frost__:{
		one_to_one?:Record<string,boolean|null|undefined>
		one_to_many?:Record<string,OneToManyMetadata|null|undefined>
		many_to_many?:Record<string,ManyToManyMetadata|null|undefined>
	}
}
type RelationsFieldsKeysByType = {
	one_to_many: string,
    one_to_many_master_fields: string,
    one_to_many_slave_fields: string,
    one_to_one: string
}

export interface Types{
    FullModel: FrostObject & Partial<Record<PropertyKey,any>>,
    Model: FrostObject & Partial<Record<PropertyKey,any>>,
    IncludeAll: Partial<Record<PropertyKey,any>>,
    RelationsFieldsKeys: string,
    RelationsFieldsKeysByType:RelationsFieldsKeysByType,
    PropertiesKeys: string,
    FrostMetadata: FrostMetadata,
    ConnectOptions:Partial<Record<string,boolean|string|string[]>>,
    DisconnectOptions:Partial<Record<string,boolean|string|string[]|'all'>> | boolean | 'all',
    IncludeOptions: Partial<Record<string,boolean>>,
}

export type FetchReturnType<T extends Types,I extends T["IncludeOptions"]> = With<T["Model"],T["IncludeAll"],I> & T['FrostMetadata']