import {
	child,
	Database,
	equalTo,
	get,
	ListenOptions,
	orderByChild,
	push,
	query,
	QueryConstraint,
	ref,
	update,
} from "firebase/database";
import * as _ from "lodash";
import {
	combineLatest,
	debounceTime,
	distinctUntilChanged,
	from,
	map,
	Observable,
	of,
	switchMap,
	throwError,
} from "rxjs";
import { join } from "../helpers/join";
import { observable } from "../helpers/observable";
import { resolve } from "../helpers/resolve";
import { slashToDotJoin } from "../helpers/slashToDotJoin";
import { trueOrNull } from "../helpers/trueOrNull";
import { valueOrNull } from "../helpers/valueOrNull";
import { Frost } from "../frost";
import { FrostObject, IFrostObject } from "./frost-object";
import { ALL_RELATIONS, NodeRelationsSymbol, Relations, RelationTypes, __frost__relations } from "./relation";
import { ClassOf } from "../types/constructor"

export type IFrostApi = ClassOf<FrostApi<FrostObject>>
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

	/**
	 *
	 * @internal
	 */
	static async getMany(db, collectionPath, ...ids) {
		let snapshots = (
			await Promise.all(ids.map((id) => resolve(get(child(ref(db), join(collectionPath, id))))))
		).map(([snapshot, error]) => (snapshot && snapshot.exists() ? snapshot.val() : null));

		return _.zipObject(ids, snapshots);
	}
	/**
	 *
	 * @internal
	 */
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

	/**
	 * Just like the {@link https://firebase.google.com/docs/reference/js/database.md#query | query} function in the firebaseDB,
	 *  but the first parameter is options for relations then is spread parameter like {@link https://firebase.google.com/docs/reference/js/database.md#query | query}
	 *
	 * Just like{@link FrostApi.listenMany} but with promises instead of observables.
	 *
	 * @see {@link FrostApi.listenMany}
	 * @see {@link Include}.
	 * @see {@link https://firebase.google.com/docs/reference/js/database.queryconstraint | QueryConstraint}.
	 *
	 * @param options - options for the observable
	 * @param {Include} options.include - see {@link Include}.
	 * @param {QueryConstraint[]} queryConstraints - see {@link https://firebase.google.com/docs/reference/js/database.queryconstraint | QueryConstraint}.
	 * @returns the query results with related objects that were given in the include parameter
	 */
	async findMany(options: { include?: Include } | null, ...queryConstraints: QueryConstraint[]): Promise<T[]> {
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

	/**
	 * Returns the object with the given id and containing the related instances with it (depending on the include parameter)
	 *
	 * Just like {@link FrostApi.listen} but with promises instead of observables
	 *
	 * @see {@link FrostApi.listen}
	 * @see {@link Include}.
	 *
	 * @param id - The object that you want to get the related objects from. (doesn't have to be an instantiated object could be the data map that was fetched manually )
	 * @param {Include} include - see {@link Include}.
	 * @returns the object instance of the given id with related objects that were given in the include parameter
	 */
	async find(id: string, include?: Include): Promise<T> {
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

	/**
	 * Just like the {@link https://firebase.google.com/docs/reference/js/database.md#query | query} function in the firebaseDB,
	 * but with observables, also the first parameter is options for the observable then is spread parameter like {@link https://firebase.google.com/docs/reference/js/database.md#query | query}
	 *
	 * @see {@link Include}.
	 * @see {@link ListenToNestedChanges}.
	 * @see {@link https://firebase.google.com/docs/reference/js/database.queryconstraint | QueryConstraint}.
	 *
	 * @param options - options for the observable
	 * @param {Include} options.include - see {@link Include}.
	 * @param {ListenToNestedChanges} options.listenToNestedChanges - see {@link ListenToNestedChanges}.
	 * @param {number} options.debounceDuration in Milliseconds. incase multiple changes happen to the query in short time, this will prevent the observable to emit too many times
	 * @param {QueryConstraint[]} queryConstraints - see {@link https://firebase.google.com/docs/reference/js/database.queryconstraint | QueryConstraint}.
	 * @defaultValue options.debounceDuration 500
	 * @defaultValue options.listenToNestedChanges true
	 * @returns an Observable of the query results with related objects that were given in the include parameter
	 */
	listenMany(
		options: {
			include?: string[];
			listenToNestedChanges?: ListenToNestedChanges;
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
					// console.log(snapshot);
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
	/**
	 * Returns an observable of the object with the given id and containing the related instances with it (depending on the include parameter)
	 *
	 *
	 * @see {@link Include}.
	 * @see {@link ListenToNestedChanges}.
	 *
	 * @param id - The object that you want to get the related objects from. (doesn't have to be an instantiated object could be the data map that was fetched manually )
	 * @param {Include} include - see {@link Include}.
	 * @param {ListenToNestedChanges} listenToNestedChanges - see {@link ListenToNestedChanges}.
	 * @defaultValue listenToNestedChanges true
	 * @returns an Observable of the object instance of the given id with related objects that were given in the include parameter
	 */
	listen(id: string, include?: Include, listenToNestedChanges: ListenToNestedChanges = true) {
		try {
			// console.log("FrostApi::listen", this.entity, this.collectionPath);
			let object = observable(child(ref(this.db), join(this.collectionPath, id)));
			let relations = object.pipe(
				distinctUntilChanged((prev, curr) => _.isEqual(prev.val()?.["__frost__"], curr.val()?.["__frost__"])), //TODO improve by including the include filter here also
				switchMap((snapshot) => {
					// console.log(snapshot);
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

	/**
	 * Returns the object with the related instances with it (depending on the include parameter)
	 * Use this if you have an object instance without the related instances you want.
	 *
	 * Same as {@link FrostApi.getRelatedObservable} but with promises instead of observables
	 *
	 * @see {@link FrostApi.getRelatedObservable}
	 * @see {@link Include}.
	 *
	 * @param object - The object that you want to get the related objects from. (doesn't have to be an instantiated object could be the data map that was fetched manually )
	 * @param {Include} include - see {@link Include}.
	 * @returns an object instance with related objects that were given in the include parameter
	 */
	async getRelated(object: any, include?: Include): Promise<T> {
		let relations = this.getAllRelations({ keys: include ?? [] });
		let value = object instanceof FrostObject ? object.flatten() : object;
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
		// console.log("getRelated", { value });
		return new this.entity(value);
	}

	/**
	 * Returns an observable of the object with the related instances with it (depending on the include parameter)
	 * Use this if you have an object instance without the related instances you want.
	 *
	 * @see {@link Include}.
	 * @see {@link ListenToNestedChanges}.
	 *
	 * @param object - The object that you want to get the related objects from. (doesn't have to be an instantiated object could be the data map that was fetched manually )
	 * @param {Include} include - see {@link Include}.
	 * @param {ListenToNestedChanges} listenToNestedChanges - see {@link ListenToNestedChanges}.
	 * @returns an Observable of the object instance with related objects that were given in the include parameter
	 */
	getRelatedObservable(object: any, include?: Include, listenToNestedChanges?: ListenToNestedChanges): Observable<T> {
		let relations = this.getAllRelations({ keys: include ?? [] });
		let value = object instanceof FrostObject ? object.flatten() : object;
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
		// console.log({ value });
		return Object.keys(observables).length
			? combineLatest(observables).pipe<T>(map((values) => new this.entity({ ...value, ...values })))
			: of(new this.entity({ ...value }));
	}

	/**
	 * inserts the new object with the new key from the push function or the key that was passed down with the object instance.
	 * also connects the instance depending on the connect parameter
	 *
	 * :::caution
	 * ***Warning:*** Changes to nested instances won't be applied
	 * :::
	 *
	 * @see {@link ConnectOptions}.
	 *
	 * @param object - The object instance containing the new changes
	 * @param {ConnectOptions} connect - see {@link ConnectOptions}.
	 * @returns an object containing the update map and the new node id
	 */
	async add(object: T, connect?: ConnectOptions): Promise<{ id }> {
		const { map: updates, id } = await this.getAddMap(object, connect);
		await update(ref(this.db), updates);
		return { id };
	}

	/**
	 * Returns a map containing the updates to the database that could be passed to firebaseDB update function.
	 * Also the map contains the new object with the new key from the push function or the key that was passed down with the object instance.
	 * also connects the instance depending on the connect parameter.
	 * :::caution
	 * ***Warning:*** Changes to nested instances won't be applied
	 * :::
	 *
	 * @see {@link ConnectOptions}.
	 *
	 * @param object - The object instance containing the new changes
	 * @param {ConnectOptions} connect - see {@link ConnectOptions}.
	 * @returns an object containing the update map and the new node id
	 */
	async getAddMap(object: T, connect?: ConnectOptions): Promise<{ map: any; id: string }> {
		let data = JSON.parse(JSON.stringify(object));

		const newKey = data.id ?? push(child(ref(this.db), this.collectionPath)).key;
		if (!newKey) throw new Error("Can't add child to node: " + this.collectionPath);

		data.id = newKey;
		const updates = {};

		object.id = newKey;
		return {
			id: newKey,
			map: (await this.getUpdateMap(object, connect)).map,
		};
	}

	/**
	 * Returns a map containing the updates that could be passed to firebaseDB update function
	 * :::caution
	 * ***Warning:*** Changes to nested instances won't be applied
	 * :::
	 *
	 * @see {@link ConnectOptions}.
	 * @see {@link DisconnectOptions}
	 *
	 * @param object - The object instance containing the new changes
	 * @param {ConnectOptions} connect - see {@link ConnectOptions}.
	 * @param disconnect - see {@link DisconnectOptions}.
	 * @returns an object containing the update map
	 */
	async getUpdateMap(object: T, connect?: ConnectOptions, disconnect?: DisconnectOptions): Promise<{ map: any }> {
		let data = JSON.parse(JSON.stringify(object));
		if (!data.id) throw new Error("Can't add child to node: " + this.collectionPath);

		const updates: any = {};

		let _disconnect: Record<string, "all" | true | string | string[]> | undefined = undefined;
		if (typeof disconnect === "string") {
			_disconnect = object.getAllConnectedKeys();
			// console.log({ _disconnect });
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
				// console.log(this.entity.name, { operation, map, relations });
				for (const _rel of relations) {
					let rel = _rel.withSide(this.entity);
					switch (rel.relationType) {
						case RelationTypes.ONE_TO_ONE:
							let connectedID = map[rel.localField];
							if (connectedID === true || connectedID === 'all') {
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
								if (toBeUpdated === true || connectedID === 'all') {
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
		// console.log({ updates });
		return { map: updates };
	}

	/**
	 * preforms the updates on the object instance and dis/connects relations depending on the options
	 * :::caution
	 * ***Warning:*** Changes to nested instances won't be applied
	 * :::
	 *
	 * @see {@link ConnectOptions}.
	 * @see {@link DisconnectOptions}
	 *
	 * @param object - The object instance containing the new changes
	 * @param {ConnectOptions} connect -  see {@link ConnectOptions}.
	 * @param disconnect - see {@link DisconnectOptions}.
	 */
	async update(object: T, connect?: ConnectOptions, disconnect?: DisconnectOptions): Promise<void> {
		const { map: updates } = await this.getUpdateMap(object, connect, disconnect);
		await update(ref(this.db), updates);
	}

	/**
	 * Returns a map of the updates that could be passed to the updated function from firebaseDB
	 * if the map is applied it removes the Object from the database and disconnects related objects depending on the disconnect parameter
	 *
	 * @see {@link DisconnectOptions}
	 *
	 * @param object - The object instance to be deleted from the database (the object instance should be the one fetched from Frost or you can do it manually be constructing an instance)
	 * @param disconnect - see {@link DisconnectOptions}
	 * @returns an object containing the update map
	 */
	async getDeleteMap(object: T, disconnect?: DisconnectOptions): Promise<{ map: any }> {
		let map = (await this.getUpdateMap(object, undefined, disconnect ?? "all")).map;
		map[join(this.collectionPath, object.id!)] = null;
		return { map };
	}

	/**
	 * Removes the Object from the database and disconnects related objects depending on the disconnect parameter
	 *
	 *
	 * @see {@link FrostApi.getDeleteMap | getDeleteMap}.
	 * @see {@link DisconnectOptions}
	 *
	 * @param object - The object instance to be deleted from the database (the object instance should be the one fetched from Frost or you can do it manually be constructing an instance)
	 * @param disconnect - see {@link DisconnectOptions}.
	 *
	 */
	async delete(object: T, disconnect?: DisconnectOptions): Promise<void> {
		const { map: updates } = await this.getDeleteMap(object, disconnect);
		await update(ref(this.db), updates);
	}
}

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
export type DisconnectOptions = undefined | "all" | Record<string, "all" | true | string | string[]>;

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
export type ConnectOptions = Record<string, string | string[]> | undefined;

/**
 * an array of the property names with relations that you want to be included in the fetch request.
 *
 * if the array is empty or undefined no relations will be included
 *
 */
export type Include = string[] | undefined;
/**
 * This helps you determine which relation you want to listen to changes from.
 * if the value is:
 * - true then it will listen to all the changes
 * - false then it won't listen to any of the changes
 * - key-value pairs with the key being {@link RelationTypes} and value being a boolean to determine whether or not to listen to specified type of relations.
 */
export type ListenToNestedChanges = boolean | Record<RelationTypes, boolean>;
