import { ALL_RELATIONS, NodeRelationsSymbol, Relations, RelationTypes, __frost__relations } from "./relation";
import {
	Database,
	get,
	child,
	ref,
	orderByChild,
	equalTo,
	query,
	push,
	update,
	QueryConstraint,
	ListenOptions,
} from "firebase/database";
import * as _ from "lodash";
import {
	throwError,
	Observable,
	switchMap,
	map,
	combineLatest,
	from,
	combineLatestAll,
	concatMap,
	concatAll,
	of,
	debounce,
	debounceTime,
	distinctUntilChanged,
} from "rxjs";
import { observable } from "../helpers/observable";
import { valueOrNull } from "../helpers/valueOrNull";
import { trueOrNull } from "../helpers/trueOrNull";
import { resolve } from "../helpers/resolve";
import { slashToDotJoin } from "../helpers/slashToDotJoin";
import { join } from "../helpers/join";
import { FrostObject, IFrostObject } from "./frost-object";
import { Frost } from "../init";

export abstract class FrostApi<T extends FrostObject> {
	/**
	 * 
	 * @internal
	 */
	collectionPath: string;
	// private many_to_many_val = {connected:true}
	/**
	 * 
	 * @internal
	 */
	entity: IFrostObject<T>;
	/**
	 * 
	 * @internal
	 */
	db: Database;
	/**
	 * 
	 * @internal
	 */
	constructor() {
		if (Frost.initialized) {
			this.db = Frost.firebaseDB;
		} else {
			throw new Error("Frost is not initialized");
		}
	}

	/**
	 * 
	 * @internal
	 */
	getMetadata = (symbol: string | symbol) => Reflect.getMetadata(symbol, this.entity.prototype);

	/**
	 * 
	 * @internal
	 */
	getNodeRelations = (): string[] => this.getMetadata(NodeRelationsSymbol) ?? [];

	/**
	 * 
	 * @internal
	 */
	getMetadataKeys = () => Reflect.getMetadataKeys(this.entity.prototype);

	/**
	 * 
	 * @internal
	 */
	getAllRelations = (options?: { type?: RelationTypes[]; keys?: string[] }): Relations[] => {
		let type = options?.type || ALL_RELATIONS;
		let keys = options?.keys;

		return this.getNodeRelations()
			.map((key) => __frost__relations[key])
			.filter(
				(relation: Relations) =>
					type.includes(relation.relationType) &&
					(!keys || keys.includes(relation.fields[0]) || keys.includes(relation.fields[1]))
			);
	};

	/**
	 * 
	 * @internal
	 */
	getPropsWithRelation = (options?: { type?: RelationTypes[]; keys?: string[] }): Relations[] => {
		let type = options?.type || ALL_RELATIONS;
		let keys = options?.keys;

		return this.getNodeRelations()
			.map((key) => __frost__relations[key])
			.filter((relation) => relation.isLocal(this.entity))
			.filter(
				(relation: Relations) =>
					type.includes(relation.relationType) && (!keys || keys.includes(relation.fields[0]))
			);
	};

	/**
	 * 
	 * @internal
	 */
	getRelatedProps = (options?: { type?: RelationTypes[]; keys?: string[] }): Relations[] => {
		let type = options?.type || ALL_RELATIONS;
		let keys = options?.keys;

		return this.getNodeRelations()
			.map((key) => __frost__relations[key])
			.filter((relation) => relation && relation.isForeign(this.entity))
			.filter(
				(relation: Relations) =>
					type.includes(relation.relationType) && (!keys || keys.includes(relation.fields[1]))
			);
	};

	static async getMany(db, collectionPath, ...ids) {
		let snapshots = (
			await Promise.all(ids.map((id) => resolve(get(child(ref(db), join(collectionPath, id))))))
		).map(([snapshot, error]) => (snapshot && snapshot.exists() ? snapshot.val() : null));

		return _.zipObject(ids, snapshots);
	}
	static observeMany(db, collectionPath, options?: ListenOptions, ...ids) {
		let observables: Record<string, Observable<any>> = _.zipObject(
			ids,
			ids.map((id) =>
				observable(child(ref(db), join(collectionPath, id)), options).pipe(
					map((snapshot) => (snapshot && snapshot.exists() ? snapshot.val() : null))
				)
			)
		);

		return combineLatest(observables);
	}

	async findMany(options: { include?: string[] } | null, ...queryConstraints: QueryConstraint[]): Promise<T[]> {
		try {
			const [snapshot, error] = await resolve(get(query(ref(this.db, this.collectionPath), ...queryConstraints)));
			if (error && !snapshot) {
				console.error(error);
				throw error;
			}
			let output: T[] = [];
			if (snapshot!.exists()) {
				let values = snapshot!.val();
				for (let value of Object.values(values)) {
					output.push(await this.getRelated(value, options?.include));
				}
				return output;
			}

			throw new Error("No data available");
		} catch (error) {
			console.log(error);
			throw error;
		}
	}

	async find(id: string, include?: string[]): Promise<T> {
		try {
			let [snapshot, error] = await resolve(get(child(ref(this.db), join(this.collectionPath, id))));
			if (error && !snapshot) {
				console.error(error);
				throw error;
			}
			if (snapshot!.exists()) {
				let value = snapshot!.val();
				return await this.getRelated(value, include);
			}
			throw new Error("No data available");
		} catch (error) {
			console.log(error);
			throw error;
		}
	}


	listenMany(
		options: {
			include?: string[];
			listenToNestedChanges?: boolean | Record<RelationTypes, boolean>;
			debounceDuration?: number;
		} | null,
		...queryConstraints: QueryConstraint[]
	): Observable<T[]> {
		// TODO improve like listen
		let listenToNestedChanges = Object.hasOwn(options ?? {}, "listenToNestedChanges")
			? options.listenToNestedChanges
			: true;
		let debounceDuration = options.debounceDuration ?? 500;
		try {
			return observable(query(ref(this.db, this.collectionPath), ...queryConstraints)).pipe(
				switchMap((snapshot) => {
					console.log(snapshot);
					if (snapshot.exists()) {
						return combineLatest(
							Object.values(snapshot.val()).map((value) => {
								return listenToNestedChanges
									? this.getRelatedObservable(value, options?.include)
									: from(this.getRelated(value, options?.include));
							})
						);
					} else {
						return throwError(() => new Error("Snapshot Doesn't exits"));
					}
				}),
				debounceTime(debounceDuration)
			);
		} catch (error) {
			console.log(error);
			throw error;
		}
	}
	listen(id: string, include?: string[], listenToNestedChanges: boolean | Record<RelationTypes, boolean> = true) {
		try {
			// console.log("FrostApi::listen", this.entity, this.collectionPath);
			let object = observable(child(ref(this.db), join(this.collectionPath, id)));
			let relations = object.pipe(
				distinctUntilChanged((prev, curr) => _.isEqual(prev.val()?.["__frost__"], curr.val()?.["__frost__"])), //TODO improve by including the include filter here also
				switchMap((snapshot) => {
					console.log(snapshot);
					if (snapshot.exists()) {
						let value = snapshot.val();
						if (listenToNestedChanges) {
							return this.getRelatedObservable(value, include, listenToNestedChanges);
						}
						return from(this.getRelated(value, include));
					} else {
						return throwError(() => new Error("Snapshot Doesn't exits"));
					}
				})
			);
			return combineLatest({ object, relations }).pipe(
				map(({ object, relations }) => new this.entity({ ...relations, ...object }))
			);
		} catch (error) {
			console.log(error);
			throw error;
		}
	}

	async getRelated(object: any, include?: string[]): Promise<T> {
		let relations = this.getAllRelations({ keys: include ?? [] });
		let value = object;
		let id = object.id;
		for (let _rel of relations) {
			let rel = _rel.withSide(this.entity);
			switch (rel.relationType) {
				case RelationTypes.ONE_TO_ONE:
					{
						value[rel.localField] = await (
							await get(
								child(
									ref(this.db),
									join(rel.foreignCollectionPath, _.get(value, slashToDotJoin(rel.localReference)))
								)
							)
						).val(); // todo check exist
					}
					break;
				case RelationTypes.ONE_TO_MANY:
					if (rel.isMaster) {
						value[rel.localField] = await (
							await get(
								query(
									ref(this.db, rel.foreignCollectionPath),
									orderByChild(rel.foreignReference),
									equalTo(id)
								)
							)
						).val();
					} else {
						value[rel.localField] = await (
							await get(
								child(
									ref(this.db),
									join(rel.foreignCollectionPath, _.get(value, slashToDotJoin(rel.localReference)))
								)
							)
						).val();
					}
					break;
				case RelationTypes.MANY_TO_MANY:
					{
						// value[rel.localField] = await (
						// 	await get(
						// 		query(
						// 			ref(this.db, rel.foreignCollectionPath),
						// 			orderByChild(join(rel.foreignReference, id, "connected")),
						// 			equalTo(true)
						// 		)
						// 	)
						// ).val();
						value[rel.localField] = await FrostApi.getMany(
							this.db,
							rel.foreignCollectionPath,
							...(this.entity.getConnectedKeys(rel.localField, object) ?? [])
						);
					}
					break;
			}
		}
		console.log("getRelated", { value });
		return new this.entity(value);
	}
	getRelatedObservable(
		object: any,
		include?: string[],
		listenToNestedChanges?: boolean | Record<RelationTypes, boolean>
	): Observable<T> {
		let relations = this.getAllRelations({ keys: include ?? [] });
		let value = object;
		let id = object.id;
		let observables: Record<string, Observable<any>> = {};
		for (let _rel of relations) {
			let rel = _rel.withSide(this.entity);
			switch (rel.relationType) {
				case RelationTypes.ONE_TO_ONE:
					{
						let _ref = child(
							ref(this.db),
							join(rel.foreignCollectionPath, _.get(value, slashToDotJoin(rel.localReference)))
						);
						observables[rel.localField] = observable(_ref, {
							onlyOnce: !(
								listenToNestedChanges === true || listenToNestedChanges?.[RelationTypes.ONE_TO_ONE]
							),
						}).pipe(map((value) => value.val()));
					}
					break;
				case RelationTypes.ONE_TO_MANY:
					{
						observables[rel.localField] = observable(
							rel.isMaster
								? query(
										ref(this.db, rel.foreignCollectionPath),
										orderByChild(rel.foreignReference),
										equalTo(id)
								  )
								: child(
										ref(this.db),
										join(
											rel.foreignCollectionPath,
											_.get(value, slashToDotJoin(rel.localReference))
										)
								  ),
							{
								onlyOnce: !(
									listenToNestedChanges === true || listenToNestedChanges?.[RelationTypes.ONE_TO_MANY]
								),
							}
						).pipe(map((value) => value.val()));
					}

					break;
				case RelationTypes.MANY_TO_MANY:
					{
						// observables[rel.localField] = observable(
						// 	query(
						// 		ref(this.db, join(rel.foreignCollectionPath)),
						// 		orderByChild(join(rel.foreignReference, id, "connected")),
						// 		equalTo(true)
						// 	)
						// ).pipe(map((value) => value.val()));
						value[rel.localField] = FrostApi.observeMany(
							this.db,
							rel.foreignCollectionPath,

							{
								onlyOnce: !(
									listenToNestedChanges === true ||
									listenToNestedChanges?.[RelationTypes.MANY_TO_MANY]
								),
							},
							...(this.entity.getConnectedKeys(rel.localField, object) ?? [])
						);
					}
					break;
			}
		}
		console.log({ value });
		return Object.keys(observables).length
			? combineLatest(observables).pipe<T>(map((values) => new this.entity({ ...value, ...values })))
			: of(new this.entity({ ...value }));
	}

	async add(object: T, connect?: ConnectOptions): Promise<{id}> {
		const { map: updates, id } = await this.getAddMap(object, connect);
		await update(ref(this.db), updates);
		return { id };
	}

	async getAddMap(object: T, connect?: ConnectOptions): Promise<{ map: any; id: string }> {
		const newKey = push(child(ref(this.db), this.collectionPath)).key;
		if (!newKey) throw new Error("Can't add child to node: " + this.collectionPath);
		let data = JSON.parse(JSON.stringify(object));
		data.id = newKey;
		const updates = {};
		//
		//@ts-ignore
		object.id = newKey;
		return {
			id: newKey,
			map: (await this.getUpdateMap(object, connect)).map,
		};
	}

	/**
	 * Writes multiple values to the Database at once.
	 * 
	 *  ***Warning:*** Changes to nested instances won't be applied
	 * 
	 * @param object - The object instance containing the new changes
	 * @param connect - See {@link ConnectOptions}.
	 * @param disconnect - See {@link DisconnectOptions}.
	 * @returns an object containing the update map
	 */
	async getUpdateMap(
		object: T,
		connect?: ConnectOptions,
		disconnect?: DisconnectOptions
	): Promise<{ map: any }> {
		let data = JSON.parse(JSON.stringify(object));
		if (!data.id) throw new Error("Can't add child to node: " + this.collectionPath);

		const updates: any = {};

		let _disconnect: Record<string, "all" | true | string | string[]> | undefined = undefined;
		if (typeof disconnect === "string") {
			_disconnect = object.getAllConnectedKeys();
			console.log({ _disconnect });
		} else {
			_disconnect = disconnect;
		}
		if (connect || _disconnect) {
			for (let { operation, map } of [
				{
					operation: "connect",
					map: connect,
				},
				{
					operation: "disconnect",
					map: _disconnect,
				},
			]) {
				let relations = this.getAllRelations({
					keys: Object.keys(map ?? []),
				});
				if (!map) continue;
				console.log(this.entity.name, { operation, map, relations });
				for (const _rel of relations) {
					let rel = _rel.withSide(this.entity);
					switch (rel.relationType) {
						case RelationTypes.ONE_TO_ONE:
							let connectedID = map[rel.localField];
							if (connectedID === true) {
								let temp = object.getConnectedKeys(rel.localField)?.[0];
								if (!temp) continue;
								connectedID = temp;
							}
							if (typeof connectedID === "string") {
								_.set(
									data,
									slashToDotJoin(rel.localReference),
									valueOrNull(operation === "connect", connectedID)
								);
								updates[join(rel.foreignCollectionPath, connectedID, rel.foreignReference)] =
									valueOrNull(operation === "connect", data.id);
							} else {
								throw new Error(
									"connect[" +
										rel.localField +
										"] should be a string or `true` in entity (" +
										rel.sides[0]().name +
										")"
								);
							}
							break;
						case RelationTypes.ONE_TO_MANY:
							// todo add option disconnect all
							if (rel.isMaster) {
								let toBeUpdated = map[rel.localField];
								if (toBeUpdated === "all" || toBeUpdated === true) {
									toBeUpdated = object.getConnectedKeys(rel.localField) ?? [];
								}
								if (Array.isArray(toBeUpdated)) {
									toBeUpdated.forEach((element) => {
										_.set(
											data,
											slashToDotJoin(rel.localReference, element),
											trueOrNull(operation === "connect")
										);
										updates[join(rel.foreignCollectionPath, element, rel.foreignReference)] =
											valueOrNull(operation === "connect", data.id);
									});
								} else {
									throw new Error(
										"connect[" +
											rel.localField +
											"] should be an array in entity (" +
											this.entity.name +
											")"
									);
								}
							} else {
								let toBeUpdated = map[rel.localField];
								if (toBeUpdated === true) {
									let temp = object.getConnectedKeys(rel.localField)?.[0];
									if (!temp) continue;
									toBeUpdated = temp;
								}
								if (typeof toBeUpdated === "string") {
									_.set(
										data,
										slashToDotJoin(rel.localReference),
										valueOrNull(operation === "connect", toBeUpdated)
									);
									updates[
										join(rel.foreignCollectionPath, toBeUpdated, rel.foreignReference, data.id)
									] = trueOrNull(operation === "connect");
								} else {
									throw new Error(
										"connect[" +
											rel.localField +
											"] should be a string or `true` in entity (" +
											rel.sides[0]().name +
											")"
									);
								}
							}

							break;
						case RelationTypes.MANY_TO_MANY:
							{
								// todo add option disconnect all
								let toBeUpdated = map[rel.localField];
								if (toBeUpdated === "all" || toBeUpdated === true) {
									toBeUpdated = object.getConnectedKeys(rel.localField) ?? [];
								}
								if (Array.isArray(toBeUpdated)) {
									toBeUpdated.forEach((element: string) => {
										_.set(
											data,
											slashToDotJoin(rel.localReference, element),
											valueOrNull(operation === "connect", { connected: true })
										);
										updates[
											join(rel.foreignCollectionPath, element, rel.foreignReference, data.id)
										] = valueOrNull(operation === "connect", { connected: true });
									});
								} else {
									throw new Error(
										"connect[" +
											rel.localField +
											"] should be an array in entity (" +
											this.entity.name +
											")"
									);
								}
							}
							break;
					}
				}
			}
		}
		updates[join(this.collectionPath, data.id)] = data;
		console.log({ updates });
		return { map: updates };
	}

	/**
	 * Writes multiple values to the Database at once.
	 * 
	 *  ***Warning:*** Changes to nested instances won't be applied
	 * 
	 * @param object - The object instance containing the new changes
	 * @param connect -  See {@link ConnectOptions}.
	 * @param disconnect - See {@link DisconnectOptions}.
	 */
	async update(
		object: T,
		connect?: ConnectOptions,
		disconnect?: DisconnectOptions
	): Promise<void> {
		const { map: updates } = await this.getUpdateMap(object, connect, disconnect);
		await update(ref(this.db), updates);
	}

	/**
	 * Returns a map of the updates that could be passed to the updated function from firebaseDB
	 * if the map is applied it removes the Object from the database and disconnects related objects depending on the disconnect parameter
	 *
	 * @param object - The object instance to be deleted from the database (the object instance should be the one fetched from Frost or you can do it manually be constructing an instance)
	 * @param disconnect - See { @link DisconnectOptions }
	 * @returns an object containing the update map
	 */
	async getDeleteMap(object: T, disconnect?:DisconnectOptions): Promise<{ map: any }> {
		let map = (await this.getUpdateMap(object, undefined, disconnect)).map;
		map[join(this.collectionPath, object.id!)] = null;
		return { map };
	}

	/**
	 * Removes the Object from the database and disconnects related objects depending on the disconnect parameter
	 *
	 * See
	 * {@link FrostApi.getDeleteMap | getDeleteMap}.
	 *
	 * @param object - The object instance to be deleted from the database (the object instance should be the one fetched from Frost or you can do it manually be constructing an instance)
	 * @param disconnect - See {@link DisconnectOptions}.
	 * 
	 */
	async delete(object: T, disconnect?:DisconnectOptions): Promise<void> {
		const { map: updates } = await this.getDeleteMap(object, disconnect);
		await update(ref(this.db), updates);
	}
}

// TODO Examples
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
 * @example all
 * ```json
 * "all"
 *```

 * @example all specific relations
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
 * @example  disconnect specific nodes
 * ```json
 * {
 * 	"posts": [],
 *  "comments": [],
 * }
 *```

 */
export type DisconnectOptions = undefined| "all" | Record<string, "all" | true | string | string[]>

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
 * @example one-to-one and many-to-many
 * ```json
 * {
 * 	"studentProfileData":"", // One-to-One
 * 	"courses": [],// Many-to-Many
 * }
 *```
 *
 * @example One-to-Many (One Side)
 * ```json
 * {
 * 	"posts":[],
 * }
 * ```
 * @example  One-to-Many (Many Side)
 * ```json
 * {
 * 	"author":"",
 * }
 * ```
 */
export type ConnectOptions = Record<string, string | string[]> | undefined