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
	firstValueFrom,
	from,
	map,
	Observable,
	of,
	switchMap,
	throwError,
} from "rxjs";
import { Frost } from "../frost";
import { join } from "../helpers/join";
import { isNotNullNorUndefined, isNullOrUndefined, mapClear } from "../helpers/nullOrUndefined";
import { observable } from "../helpers/observable";
import { resolve } from "../helpers/resolve";
import { slashToDotJoin } from "../helpers/slashToDotJoin";
import { trueOrNull } from "../helpers/trueOrNull";
import { valueOrNull } from "../helpers/valueOrNull";
import { FetchReturnType, Model, Types, With } from "../global-types";
import { ALL_RELATIONS, Relation, RelationTypes, } from "./relation";
import { ArrayValuesType } from "../types-helpers/array";

export abstract class FrostDelegate<T extends Types = Types> {
	
	/**
	 *
	 * @internal
	 */
	db: Database;
	/**
	 *
	 * @internal
	 */

	 public collectionPath:string
	 protected entityName:string
	 protected relations:Record<PropertyKey,Relation>

	constructor(
		/**
		 *
		 * @internal
		 */

		protected model:Model,
		) {
		if (Frost.initialized) {
			this.db = Frost.firebaseDB;

			this.collectionPath = model.path
			this.entityName = model.name
			this.relations = Relation.fromModel(model,'map')
		} else {
			throw new Error("Frost is not initialized");
		}
	}

	/**
	 *
	 * @internal
	 */
	getAllRelations = (options?: { type?: RelationTypes[]; keys?: string[] }): Relation[] => {
		let type = options?.type || ALL_RELATIONS;
		let keys = options?.keys;
		return Object.values(this.relations)
			.filter(
				(relation: Relation) =>
					type.includes(relation.relationType) &&
					(!keys || keys.includes(relation.fields[0]) || keys.includes(relation.fields[1]))
			);
	};

	/**
	 *
	 * @internal
	 */
	getPropsWithRelation = (options?: { type?: RelationTypes[]; keys?: string[] }): Relation[] => {
		let type = options?.type || ALL_RELATIONS;
		let keys = options?.keys;

		return Object.values(this.relations)
			.filter((relation) => relation.isLocal(this.entityName))
			.filter(
				(relation: Relation) =>
					type.includes(relation.relationType) && (!keys || keys.includes(relation.fields[0]))
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
	 * @internal
	 */
	private getIncludeArray(include?:T["IncludeOptions"]):string[]{
		return include? Object.entries(include).filter(([_,value])=>value).map(([key,])=>key): undefined;
	}
	
	/**
	 * Just like the {@link https://firebase.google.com/docs/reference/js/database.md#query | query} function in the firebaseDB,
	 *  but the first parameter is options for relations then is spread parameter like {@link https://firebase.google.com/docs/reference/js/database.md#query | query}
	 *
	 * Just like {@link FrostDelegate.observeMany} but with promises instead of observables.
	 *
	 * @see {@link FrostDelegate.observeMany}
	 * @see {@link Include}.
	 * @see {@link https://firebase.google.com/docs/reference/js/database.queryconstraint | QueryConstraint}.
	 *
	 * @param options - options for the query
	 * @param {Include} options.include - see {@link Include}.
	 * @param {QueryConstraint[]} queryConstraints - see {@link https://firebase.google.com/docs/reference/js/database.queryconstraint | QueryConstraint}.
	 * @returns the query results with related objects that were given in the include parameter
	 */
	async findMany<I extends T["IncludeOptions"]>(options: { include?: I } | null, ...queryConstraints: QueryConstraint[]): Promise<FetchReturnType<T,I>[]> {
		try {
			const [snapshot, error] = await resolve(get(query(ref(this.db, this.collectionPath), ...queryConstraints)));
			if (error && !snapshot) {
				console.error(error);
				throw error;
			}
			let output: FetchReturnType<T,I>[] = [];
			if (snapshot!.exists()) {
				let values:any = snapshot!.val();
				for (let value of Object.values(values)) {
					output.push(await this.getRelated(value as any,options.include));
				}
				return output;
			}

			throw new Error("No data available");
		} catch (error) {
			console.log(error);
			throw error;
		}
	}	
	
	//FIXME fix doc
	/**
	 * Just like the {@link https://firebase.google.com/docs/reference/js/database.md#query | query} function in the firebaseDB,
	 *  but the first parameter is options for relations then is spread parameter like {@link https://firebase.google.com/docs/reference/js/database.md#query | query}
	 *
	 * Just like {@link FrostDelegate.observeMany} but with promises instead of observables.
	 *
	 * @see {@link FrostDelegate.observeMany}
	 * @see {@link Include}.
	 * @see {@link https://firebase.google.com/docs/reference/js/database.queryconstraint | QueryConstraint}.
	 *
	 * @param options - options for the query
	 * @param {Include} options.include - see {@link Include}.
	 * @param {QueryConstraint[]} queryConstraints - see {@link https://firebase.google.com/docs/reference/js/database.queryconstraint | QueryConstraint}.
	 * @returns the query results with related objects that were given in the include parameter
	 */
	async findMultiple<I extends T["IncludeOptions"],K extends string[]>(keys:K,options?: { include?: I } | null): Promise<Record<ArrayValuesType<K>,FetchReturnType<T,I>>> {
		try {
			let promiseMap: Record<ArrayValuesType<K>,Observable<FetchReturnType<T,I>>> = {} as any
			keys.forEach(
				(key:ArrayValuesType<K>)=>promiseMap[key] = from(this.findOne<I>(key,options?.include))
			)
			return firstValueFrom(
				combineLatest(
					promiseMap
				),
			)
	
		} catch (error) {
			console.log(error);
			throw error;
		}
	}

	/**
	 * Returns the object with the given id and containing the related instances with it (depending on the include parameter)
	 *
	 * Just like {@link FrostDelegate.observeOne} but with promises instead of observables
	 *
	 * @see {@link FrostDelegate.observeOne}
	 * @see {@link Include}.
	 *
	 * @param id - The object that you want to get the related objects from. (doesn't have to be an instantiated object could be the data map that was fetched manually )
	 * @param {Include} include - see {@link Include}.
	 * @returns the object instance of the given id with related objects that were given in the include parameter
	 */
	async findOne<I extends T["IncludeOptions"]>(id: string, include?: T["IncludeOptions"]): Promise<FetchReturnType<T,I>> {
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
	 * @defaultValue options.listenToNestedChanges false
	 * @returns an Observable of the query results with related objects that were given in the include parameter
	 */
	observeMany<I extends T["IncludeOptions"]>(
		options?: {
			include?: T["IncludeOptions"];
			listenToNestedChanges?: ListenToNestedChanges;
			debounceDuration?: number;
		} | null,
		...queryConstraints: QueryConstraint[]
	): Observable<FetchReturnType<T,I>[]> {
		// TODO improve like listen
		let listenToNestedChanges = isNotNullNorUndefined(options?.listenToNestedChanges)
			? options.listenToNestedChanges
			: false;
			// console.log({listenToNestedChanges})
		let debounceDuration = options?.debounceDuration ?? 500;
		try {
			return observable(query(ref(this.db, this.collectionPath), ...queryConstraints)).pipe(
				switchMap((snapshot) => {
					// console.log(snapshot);
					if (snapshot.exists()) {
						return combineLatest(
							Object.values(snapshot.val()).map((value:any) => {
								return listenToNestedChanges
									? this.getRelatedObservable(value, options?.include)
									: from(this.getRelated(value, options?.include));
							})
						);
					} else {
						// return throwError(() => new Error("Snapshot Doesn't exits"));
						console.error( new Error("Snapshot Doesn't exits"));
						return of([]);
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
	 * @defaultValue listenToNestedChanges false
	 * @returns an Observable of the object instance of the given id with related objects that were given in the include parameter
	 */
	observeOne<I extends T["IncludeOptions"]>(id: string, include?: T["IncludeOptions"], listenToNestedChanges: ListenToNestedChanges = false):Observable<FetchReturnType<T,I>> {
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
						// return throwError(() => new Error("Snapshot Doesn't exits"));
						console.error(new Error("Snapshot Doesn't exits"));
						return of(null)
					}
				})
			);
			return combineLatest({ object, relations }).pipe(
				map(({ object, relations }) => this.deserialize<I>({ ...relations, ...object }))
			);
		} catch (error) {
			console.log(error);
			throw error;
		}
	}

		
	//FIXME fix doc
	/**
	 * Just like the {@link https://firebase.google.com/docs/reference/js/database.md#query | query} function in the firebaseDB,
	 *  but the first parameter is options for relations then is spread parameter like {@link https://firebase.google.com/docs/reference/js/database.md#query | query}
	 *
	 * Just like {@link FrostDelegate.observeMany} but with promises instead of observables.
	 *
	 * @see {@link FrostDelegate.observeMany}
	 * @see {@link Include}.
	 * @see {@link https://firebase.google.com/docs/reference/js/database.queryconstraint | QueryConstraint}.
	 *
	 * @param options - options for the query
	 * @param {Include} options.include - see {@link Include}.
	 * @param {QueryConstraint[]} queryConstraints - see {@link https://firebase.google.com/docs/reference/js/database.queryconstraint | QueryConstraint}.
	 * @returns the query results with related objects that were given in the include parameter
	 */
	 observeMultiple<I extends T["IncludeOptions"],K extends string[]>(keys:K,options?: { include?: I, listenToNestedChanges:ListenToNestedChanges } | null): Observable<Record<ArrayValuesType<K>,FetchReturnType<T,I>>> {
		try {
			let promiseMap: Record<ArrayValuesType<K>,Observable<FetchReturnType<T,I>>> = {} as any
			keys.forEach(
				(key:ArrayValuesType<K>)=>promiseMap[key] = this.observeOne<I>(key,options?.include,options.listenToNestedChanges)
			)
			return combineLatest(promiseMap)
			
		} catch (error) {
			console.log(error);
			throw error;
		}
	}
	/**
	 * Returns the object with the related instances with it (depending on the include parameter)
	 * Use this if you have an object instance without the related instances you want.
	 *
	 * Same as {@link FrostDelegate.getRelatedObservable} but with promises instead of observables
	 *
	 * @see {@link FrostDelegate.getRelatedObservable}
	 * @see {@link Include}.
	 *
	 * @param object - The object that you want to get the related objects from. (doesn't have to be an instantiated object could be the data map that was fetched manually )
	 * @param {Include} include - see {@link Include}.
	 * @returns an object instance with related objects that were given in the include parameter
	 */


	async getRelated<I extends T["IncludeOptions"]>(object: T["Model"] & T["FrostMetadata"], include?: T["IncludeOptions"]):  Promise<FetchReturnType<T,I>> {
		let _include = this.getIncludeArray(include)

		let relations = this.getAllRelations({ keys: _include ?? [] });
		let value:any = object;
		let id = object.id;
		for (let _rel of relations) {
			let rel = _rel.withSide(this.entityName);
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
						value[rel.localField] = await FrostDelegate.getMany(
							this.db,
							rel.foreignCollectionPath,
							...(this.getConnectedKeysByRelation(rel, object) ?? [])
						);
					}
					break;
			}
		}

		return this.deserialize<I>(value);
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
	getRelatedObservable<I extends T["IncludeOptions"]>(
		object: T["Model"] & T["FrostMetadata"],
		include?: T["IncludeOptions"],
		listenToNestedChanges?: ListenToNestedChanges
	): Observable<FetchReturnType<T,I>> {
		let _include = this.getIncludeArray(include)

		let relations = this.getAllRelations({ keys: _include ?? [] });
		let value:any = object;
		let id = object.id;
		let observables: Record<string, Observable<any>> = {};
		for (let _rel of relations) {
			let rel = _rel.withSide(this.entityName);
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
						value[rel.localField] = FrostDelegate.observeMany(
							this.db,
							rel.foreignCollectionPath,

							{
								onlyOnce: !(
									listenToNestedChanges === true ||
									listenToNestedChanges?.[RelationTypes.MANY_TO_MANY]
								),
							},
							...(this.getConnectedKeysByRelation(rel, object) ?? [])
						);
					}
					break;
			}
		}
		// console.log({ value });
		return Object.keys(observables).length
			? combineLatest(observables).pipe<FetchReturnType<T,I>>(map((values) => this.deserialize<I>({ ...value, ...values })))
			: of(this.deserialize<I>({ ...value }));
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
	async add(object: T["FullModel"], connect?: T["ConnectOptions"]): Promise<{ id }> {
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
	async getAddMap(object: T["FullModel"], connect?: T["ConnectOptions"]): Promise<{ map: any; id: string }> {
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
	async getUpdateMap(
		object: T["FullModel"],
		connect?: T["ConnectOptions"],
		disconnect?: T["DisconnectOptions"]
	): Promise<{ map: any }> {
		// let data = JSON.parse(JSON.stringify(object));
		let data = this.serialize(object);
		if (!data.id) throw new Error("Can't add child to node: " + this.collectionPath);

		const updates: any = {};

		let _disconnect: Record<string, "all" | true | string | string[]> | undefined = undefined;
		if ((typeof disconnect === "string" && disconnect === 'all') || (typeof disconnect === "boolean" && disconnect === true)) {
			_disconnect = object.getAllConnectedKeys();
		} else if(disconnect) {
			_disconnect = mapClear(disconnect);
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
				// console.log(this.entityName, { operation, map, relations });
				for (const _rel of relations) {
					let rel = _rel.withSide(this.entityName);
					switch (rel.relationType) {
						case RelationTypes.ONE_TO_ONE:
							let connectedID = map[rel.localField];
							if (connectedID) {
								if (connectedID === true || connectedID === "all") {
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
											rel.sides[0].name +
											")"
									);
								}
							}
							break;
						case RelationTypes.ONE_TO_MANY:
							// todo add option disconnect all
							if (rel.isMaster) {
								let toBeUpdated = map[rel.localField];
								if (toBeUpdated) {
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
												this.entityName +
												")"
										);
									}
								}
							} else {
								let toBeUpdated = map[rel.localField];
								if (toBeUpdated) {
									if (toBeUpdated === true || toBeUpdated === "all") {
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
												rel.sides[0].name +
												")"
										);
									}
								}
							}

							break;
						case RelationTypes.MANY_TO_MANY:
							{
								// todo add option disconnect all
								let toBeUpdated = map[rel.localField];
								if (toBeUpdated) {
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
												this.entityName +
												")"
										);
									}
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
	async update(object: T, connect?: T["ConnectOptions"], disconnect?: T["DisconnectOptions"]): Promise<void> {
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
	async getDeleteMap(object: T["FullModel"], disconnect?: T["DisconnectOptions"]): Promise<{ map: any }> {
		let map = (await this.getUpdateMap(object, undefined, disconnect ?? "all")).map;
		map[join(this.collectionPath, object.id!)] = null;
		return { map };
	}

	/**
	 * Removes the Object from the database and disconnects related objects depending on the disconnect parameter
	 *
	 *
	 * @see {@link FrostDelegate.getDeleteMap | getDeleteMap}.
	 * @see {@link DisconnectOptions}
	 *
	 * @param object - The object instance to be deleted from the database (the object instance should be the one fetched from Frost or you can do it manually be constructing an instance)
	 * @param disconnect - see {@link DisconnectOptions}.
	 *
	 */
	async delete(object: T["FullModel"], disconnect?: T["DisconnectOptions"]): Promise<void> {
		const { map: updates } = await this.getDeleteMap(object, disconnect);
		await update(ref(this.db), updates);
	}

	/**
 * 
 * @param propertyName - the name of the property with the relation which keys' you require.
 * @param object - the object instance that you want to get the keys from
 * @returns an array containing the ids of the instances that are connected. if there are no connected keys or the property name is incorrect then there'll be no key-value pair for the specific property
 */
	getConnectedKeys(propertyName: string, object: T["FullModel"]): string[] | null{
		return getConnectedKeys(this.model,Object.values(this.relations),propertyName,object)
	}

	/**
	 * For local fields
	 * @param relation 
	 * @param object 
	 * @returns 
	 */
	private getConnectedKeysByRelation(relation:Relation, object: any): string[] | null {
		return getConnectedKeysByRelation(this.model,relation,object)
	}

	private serialize(object:T["FullModel"]): T["Model"] {
		let output: any = {}
		this.model.properties.forEach(({name,type,isArray,optional,defaultValue})=>{
			let value = object[name]
			if(isNullOrUndefined(value)){
				if(optional) output[name] = value ?? defaultValue;
				else throw new Error(`Property (${name}) in Model (${this.model.name}) cannot be null or undefined`);
			}
			else{
				if(isArray && !Array.isArray(value)){
					throw new Error(`Property (${name}) in Model (${this.model.name}) should be an array, instead given value was (${value})`);
				}
				output[name] = value;

			}
		})
		return output as T["Model"]
	}
	private deserialize<I extends T["IncludeOptions"] = T["IncludeOptions"]>(data:any): FetchReturnType<T,I> {
		let output: any = {...data}
		this.model.properties.forEach(({name,type,isArray,optional})=>{
			let value = data[name]
			if(isNullOrUndefined(value)){
				if(optional) output[name] = value;
				else throw new Error(`Property (${name}) in Model (${this.model.name}) cannot be null or undefined. Received \`${value}\` from database`);
			}
			else{
				if(isArray && !Array.isArray(value)){
					throw new Error(`Property (${name}) in Model (${this.model.name}) should be an array, instead given value was (${value})`);
				}
				switch (type) {
					case 'Date':
					case 'date':
						value = new Date(value)
						break;
				}
				output[name] = value;

			}
		})
		return output
	}
}



/**
 * This helps you determine which relation you want to listen to changes from.
 * if the value is:
 * - true then it will listen to all the changes
 * - false then it won't listen to any of the changes
 * - key-value pairs with the key being {@link RelationTypes} and value being a boolean to determine whether or not to listen to specified type of relations.
 */
export type ListenToNestedChanges = boolean | Record<RelationTypes, boolean>;

//FIXME Doc
/**
 * 
 * @param propertyName - the name of the property with the relation which keys' you require.
 * @param object - the object instance that you want to get the keys from
 * @returns an array containing the ids of the instances that are connected. if there are no connected keys or the property name is incorrect then there'll be no key-value pair for the specific property
 */
function getConnectedKeys(model:Model,relations:Relation[],propertyName: string, object: any): string[] | null {
	let relation = relations.find((rel)=>rel.fields.includes(propertyName))

	if (relation) {
		relation = relation.withSide(model.name);
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
//FIXME Doc
/**
 * 
 * @param propertyName - the name of the property with the relation which keys' you require.
 * @param object - the object instance that you want to get the keys from
 * @returns an array containing the ids of the instances that are connected. if there are no connected keys or the property name is incorrect then there'll be no key-value pair for the specific property
 */
function getConnectedKeysByRelation(model:Model,relation:Relation, object: any): string[] | null {
	if (relation) {
		relation = relation.withSide(model.name);
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
