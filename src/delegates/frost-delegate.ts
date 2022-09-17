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
	BehaviorSubject,
	combineLatest,
	debounceTime,
	distinctUntilChanged,
	filter,
	firstValueFrom,
	from,
	map,
	Observable,
	of,
	Subscription,
	switchMap,
} from "rxjs";
import { join } from "../helpers/join";
import { isNotNullNorUndefined, isNullOrUndefined, mapClear } from "../helpers/nullOrUndefined";
import { observable } from "../helpers/observable";
import { resolve } from "../helpers/resolve";
import { slashToDotJoin } from "../helpers/slashToDotJoin";
import { trueOrNull } from "../helpers/trueOrNull";
import { valueOrNull } from "../helpers/valueOrNull";
import { FetchReturnType, FrostObject, Model, ModelTypes, With } from "../global-types";
import { ALL_RELATIONS, Relation, RelationTypes } from "./relation";
import { ArrayValuesType } from "../types-helpers/array";
import { mapByKey } from "../helpers/array-methods";
import { flatten } from "lodash";
import { flattenObject } from "../helpers/object-methods";

//TODO Improve listening to changes in many-to-many
//TODO Check serializing and __frost__
export abstract class FrostDelegate<T extends ModelTypes = ModelTypes> {
	/**
	 *
	 * @internal
	 */
	db: Database;
	/**
	 *
	 * @internal
	 */

	public collectionPath: string;
	protected entityName: string;
	protected relations: Record<PropertyKey, Relation>;
	protected _refreshMetadata: boolean = false;
	constructor(
		/**
		 *
		 * @internal
		 */

		protected model: Model,
		firebaseDB: Database
	) {
		this.db = firebaseDB;

		this.collectionPath = model.path;
		this.entityName = model.name;
		this.relations = Relation.fromModel(model, "map");

		//TODO If there are at least one many-to-many relation refreshMetadata = true
	}

	/**
	 *
	 * @internal
	 */
	getAllRelations = (options?: { type?: RelationTypes[]; keys?: string[] }): Relation[] => {
		let type = options?.type || ALL_RELATIONS;
		let keys = options?.keys;
		return Object.values(this.relations).filter(
			(relation: Relation) =>
				type.includes(relation.relationType) &&
				(!keys || keys.includes(relation.fields[0]) || keys.includes(relation.fields[1]))
		);
	};

	/**
	 *
	 * @internal
	 */
	static async getMany(db: Database, collectionPath: string, ...ids: string[]) {
		let snapshots = (
			await Promise.all(ids.map((id) => resolve(get(child(ref(db), join(collectionPath, id))))))
		).map(([snapshot, error]) => (snapshot && snapshot.exists() ? snapshot.val() : null));

		return _.zipObject(ids, snapshots);
	}
	/**
	 *
	 * @internal
	 */
	static observeMany(db: Database, collectionPath: string, options?: ListenOptions, ...ids: string[]) {
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
	private getIncludeArray(include?: T["IncludeOptions"]): string[]|undefined {
		return include
			? Object.entries(include)
					.filter(([_, value]) => value)
					.map(([key]) => key)
			: undefined;
	}

	/**
	 * Just like the {@link https://firebase.google.com/docs/reference/js/database.md#query | query} function in the firebaseDB,
	 *  but the first parameter is options for relations then is spread parameter like {@link https://firebase.google.com/docs/reference/js/database.md#query | query}
	 *
	 * Just like {@link FrostDelegate.observeMany} but with promises instead of observables.
	 *
	 * @see {@link FrostDelegate.observeMany}
	 * @see {@link IncludeOptions}.
	 * @see {@link https://firebase.google.com/docs/reference/js/database.queryconstraint | QueryConstraint}.
	 *
	 * @param options - options for the query
	 * @param {IncludeOptions} options.include - see {@link IncludeOptions}.
	 * @param {QueryConstraint[]} queryConstraints - see {@link https://firebase.google.com/docs/reference/js/database.queryconstraint | QueryConstraint}.
	 * @returns the query results with related objects that were given in the include parameter
	 */
	async findMany<I extends T["IncludeOptions"]>(
		options: { include?: I } | null,
		...queryConstraints: QueryConstraint[]
	): Promise<FetchReturnType<T, I>[]> {
		try {
			const [snapshot, error] = await resolve(get(query(ref(this.db, this.collectionPath), ...queryConstraints)));
			if (error && !snapshot) {
				console.error(error);
				throw error;
			}
			let output: FetchReturnType<T, I>[] = [];
			if (snapshot!.exists()) {
				let values: any = snapshot!.val();
				for (let value of Object.values(values)) {
					output.push(await this.getRelated(value as any, options.include));
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
	 * Fetch Multiple Nodes in the Database.
	 *
	 * Just like {@link FrostDelegate.findOne} but with an array of ids instead of one
	 * Just like {@link FrostDelegate.observeMultiple} but asynchronous(promise) instead of reactive.
	 *
	 * @see {@link FrostDelegate.findOne}
	 * @see {@link FrostDelegate.observeMultiple}
	 * @see {@link IncludeOptions}.
	 *
	 * @param keys - an array of the instances' IDs that you want to observe
	 * @param options - options for the query
	 * @param {IncludeOptions} options.include - see {@link IncludeOptions}.
	 * @returns a Map of the requested nodes instances
	 */
	async findMultiple<I extends T["IncludeOptions"], K extends string[]>(
		keys: K,
		options?: { include?: I } | null
	): Promise<Record<ArrayValuesType<K>, FetchReturnType<T, I>>> {
		try {
			let promiseMap: Record<ArrayValuesType<K>, Observable<FetchReturnType<T, I>>> = {} as any;
			keys.forEach(
				(key: string) => (promiseMap[key as ArrayValuesType<K>] = from(this.findOne<I>(key, options?.include)))
			);
			return firstValueFrom(combineLatest(promiseMap));
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
	 * @see {@link IncludeOptions}.
	 *
	 * @param id - The object that you want to get the related objects from. (doesn't have to be an instantiated object could be the data map that was fetched manually )
	 * @param {IncludeOptions} include - see {@link IncludeOptions}.
	 * @returns the object instance of the given id with related objects that were given in the include parameter
	 */
	async findOne<I extends T["IncludeOptions"]>(
		id: string,
		include?: T["IncludeOptions"]
	): Promise<FetchReturnType<T, I>> {
		try {
			let [snapshot, error] = await resolve(get(child(ref(this.db), join(this.collectionPath, id))));
			if (error && !snapshot) {
				console.error(error);
				throw error;
			}
			if (snapshot?.exists()) {
				let value = snapshot.val();
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
	 * @see {@link IncludeOptions}.
	 * @see {@link ListenToNestedChanges}.
	 * @see {@link https://firebase.google.com/docs/reference/js/database.queryconstraint | QueryConstraint}.
	 *
	 * @param options - options for the observable
	 * @param {IncludeOptions} options.include - see {@link IncludeOptions}.
	 * @param {ListenToNestedChanges} options.listenToNestedChanges - see {@link ListenToNestedChanges}.
	 * @param {number} options.debounceDuration in Milliseconds. incase multiple changes happen to the query in short time, this will prevent the observable to emit too many times
	 * @param {QueryConstraint[]} queryConstraints - see {@link https://firebase.google.com/docs/reference/js/database.queryconstraint | QueryConstraint}.
	 * @defaultValue options.debounceDuration 500
	 * @defaultValue options.listenToNestedChanges false
	 * @returns an Observable of the query results with related objects that were given in the include parameter
	 */
	private observeManyOld<I extends T["IncludeOptions"]>(
		options?: {
			include?: T["IncludeOptions"];
			listenToNestedChanges?: ListenToNestedChanges;
			debounceDuration?: number;
		} | null,
		...queryConstraints: QueryConstraint[]
	): Observable<FetchReturnType<T, I>[]> {
		let listenToNestedChanges = isNotNullNorUndefined(options?.listenToNestedChanges)
			? options?.listenToNestedChanges
			: false;
		// console.log({listenToNestedChanges})
		let debounceDuration = options?.debounceDuration ?? 500;
		try {
			return observable(query(ref(this.db, this.collectionPath), ...queryConstraints)).pipe(
				switchMap((snapshot) => {
					// console.log(snapshot);
					if (snapshot.exists()) {
						return combineLatest(
							Object.values(snapshot.val()).map((value: any) => {
								return listenToNestedChanges
									? this.getRelatedObservable(value, options?.include)
									: from(this.getRelated(value, options?.include));
							})
						);
					} else {
						// return throwError(() => new Error("Snapshot Doesn't exits"));
						console.error(new Error("Snapshot Doesn't exits"));
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

	//TODO Improve using Custom operators
	/**
	 * Just like the {@link https://firebase.google.com/docs/reference/js/database.md#query | query} function in the firebaseDB,
	 * but with observables, also the first parameter is options for the observable then is spread parameter like {@link https://firebase.google.com/docs/reference/js/database.md#query | query}
	 *
	 * @see {@link IncludeOptions}.
	 * @see {@link ListenToNestedChanges}.
	 * @see {@link https://firebase.google.com/docs/reference/js/database.queryconstraint | QueryConstraint}.
	 *
	 * @param options - options for the observable
	 * @param {IncludeOptions} options.include - see {@link IncludeOptions}.
	 * @param {ListenToNestedChanges} options.listenToNestedChanges - see {@link ListenToNestedChanges}.
	 * @param {number} options.debounceDuration in Milliseconds. incase multiple changes happen to the query in short time, this will prevent the observable to emit too many times
	 * @param {QueryConstraint[]} queryConstraints - see {@link https://firebase.google.com/docs/reference/js/database.queryconstraint | QueryConstraint}.
	 * @defaultValue options.debounceDuration 500
	 * @defaultValue options.listenToNestedChanges false
	 * @returns an Observable of the query results with related objects that were given in the include parameter
	 */
	observeMany<I extends T["IncludeOptions"]>(
		options?: {
			include?: I;
			listenToNestedChanges?: ListenToNestedChanges;
			debounceDuration?: number;
		} | null,
		...queryConstraints: QueryConstraint[]
	): Observable<Record<string, FetchReturnType<T, I>>> {
		let listenToNestedChanges = isNotNullNorUndefined(options?.listenToNestedChanges)
			? options?.listenToNestedChanges
			: false;
		// console.log({listenToNestedChanges})
		let debounceDuration = options?.debounceDuration ?? 500;
		try {
			let snapshotsSubjectsMap: Record<string, BehaviorSubject<any>> = {};

			let snapshotsRelationsSubscribersMap: Record<string, Subscription> = {};
			let snapshotsRelationsSubjectsMap: Record<string, BehaviorSubject<any>> = {};

			let outputObservablesMap: Record<string, Observable<FetchReturnType<T, I>>> = {};
			let outputObservablesMapSubject: BehaviorSubject<Record<string, Observable<FetchReturnType<T, I>>> | undefined> = new BehaviorSubject(undefined);

			// let outputSubject: Subject<FetchReturnType<T,I>[]>= new Subject()

			observable(query(ref(this.db, this.collectionPath), ...queryConstraints))
				.pipe(debounceTime(debounceDuration))
				.subscribe((snapshot) => {
					if (snapshot.exists()) {
						const snapshots = snapshot.val();
						const snapshotEntries = Object.entries(snapshots);
						// console.log({snapshots});
						snapshotEntries.forEach(([key]: [string, any]) => {
							if (!snapshotsSubjectsMap[key]) {
								console.log(`created Subject["${key}"]`);
								snapshotsSubjectsMap[key] = new BehaviorSubject<any>(undefined);
								snapshotsRelationsSubjectsMap[key] = new BehaviorSubject<any>(undefined);

								snapshotsRelationsSubscribersMap[key] = snapshotsSubjectsMap[key]
									.pipe(
										// tap(val => console.log(`Relation Subject :: before distinctUntilChanged :: `,val)),
										distinctUntilChanged((prev, curr) => {
											let result = this.metadataChanged<I>(options?.include)(prev, curr);
											console.log(new Date().getTime(), { result, prev, curr });
											return result;
										}),
										// tap(val => console.log(`Relation Subject :: After distinctUntilChanged :: `,val)),
										switchMap((value) => {
											if (value) {
												if (listenToNestedChanges) {
													return this.getRelatedObservable(value, options?.include);
												} else {
													return from(this.getRelated(value, options?.include));
												}
											} else {
												return of({});
											}
										})
									)
									.subscribe((value) => {
										snapshotsRelationsSubjectsMap[key].next(value);
									});

								outputObservablesMap[key] = combineLatest({
									object: snapshotsSubjectsMap[key].pipe(
										// tap(val => console.log(`Main Subject :: before distinctUntilChanged :: `,val)),
										distinctUntilChanged((prev, curr) =>
											_.isEqual(_.omit(prev, "__frost__"), _.omit(curr, "__frost__"))
										)
										// tap(val => console.log(`Main Subject :: After distinctUntilChanged :: `,val)),
									),
									relations: snapshotsRelationsSubjectsMap[key].asObservable(),
								}).pipe(
									filter(({ object, relations }) => {
										// console.log('filter',{ object, relations })
										return Boolean(Object.keys(object ?? {}).length);
									}),
									map(({ object, relations }) => {
										return this.deserialize<I>({ ...object, ..._.pick(relations,this.getFieldNamesWithRelations()) });
									})
									// tap(val => console.log(`Subject :: After map :: `,val)),
								);
							}
							// subjectsMap[key].next(value);
						});
						const prevKeys = Object.keys(snapshotsSubjectsMap);
						const currKeys = Object.keys(snapshots);
						const keysToBeDeleted = _.difference(prevKeys, currKeys);

						// snapshotsSubjectsMap = _.pick(snapshotsSubjectsMap,currKeys)
						// outputObservablesMap = _.pick(outputObservablesMap,currKeys)
						// snapshotsRelationsSubscribersMap = _.pick(snapshotsRelationsSubscribersMap,currKeys)
						// snapshotsRelationsSubjectsMap = _.pick(snapshotsRelationsSubjectsMap,currKeys)
						keysToBeDeleted.forEach((key) => {
							snapshotsSubjectsMap[key].unsubscribe();
							delete snapshotsSubjectsMap[key];

							delete outputObservablesMap[key];

							snapshotsRelationsSubscribersMap[key].unsubscribe();
							delete snapshotsRelationsSubscribersMap[key];

							snapshotsRelationsSubjectsMap[key].unsubscribe();
							delete snapshotsRelationsSubjectsMap[key];
						});

						outputObservablesMapSubject.next({ ...outputObservablesMap });

						snapshotEntries.forEach(([key, value]: [string, any]) => {
							snapshotsSubjectsMap[key]?.next(value);
						});
					} else {
						// return throwError(() => new Error("Snapshot Doesn't exits"));
						console.error(new Error("Snapshot Doesn't exits"));
						return outputObservablesMapSubject.next({});
					}
				});
			return outputObservablesMapSubject.pipe(
				filter(Boolean),
				distinctUntilChanged((prev, curr) => {
					const prevKeys = Object.keys(prev);
					const currKeys = Object.keys(curr);
					if (prevKeys.length !== currKeys.length) return false;

					const result = _.xor(prevKeys, currKeys);
					// console.log("difference",result,{prev,curr})
					return result.length === 0;
				}),
				switchMap((_observablesMap) => {
					if (_observablesMap && Object.keys(_observablesMap).length) {
						return combineLatest(_observablesMap);
					}
					return of({});
				})
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
	 * @see {@link IncludeOptions}.
	 * @see {@link ListenToNestedChanges}.
	 *
	 * @param id - The object that you want to get the related objects from. (doesn't have to be an instantiated object could be the data map that was fetched manually )
	 * @param {IncludeOptions} include - see {@link IncludeOptions}.
	 * @param {ListenToNestedChanges} listenToNestedChanges - see {@link ListenToNestedChanges}.
	 * @defaultValue listenToNestedChanges false
	 * @returns an Observable of the object instance of the given id with related objects that were given in the include parameter
	 */
	observeOne<I extends T["IncludeOptions"]>(
		id: string,
		include?: I,
		listenToNestedChanges: ListenToNestedChanges = false
	): Observable<FetchReturnType<T, I>> {
		try {
			let object = observable(child(ref(this.db), join(this.collectionPath, id)));
			let relations = object.pipe(
				distinctUntilChanged(this.metadataChanged<I>(include)),
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
						return of(null);
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

	/**
	 * Observe Multiple Nodes in the Database.
	 *
	 * Just like {@link FrostDelegate.observeOne} but with an array of ids instead of one
	 * Just like {@link FrostDelegate.findMultiple} but reactive.
	 *
	 * @see {@link FrostDelegate.observeOne}
	 * @see {@link FrostDelegate.findMultiple}
	 * @see {@link IncludeOptions}.
	 *
	 * @param keys - an array of the instances' IDs that you want to observe
	 * @param options - options for the query
	 * @param {IncludeOptions} options.include - see {@link IncludeOptions}.
	 * @param {ListenToNestedChanges} options.listenToNestedChanges - see {@link ListenToNestedChanges}.
	 * @defaultValue listenToNestedChanges false
	 * @returns a Map of the requested nodes instances
	 */
	observeMultiple<I extends T["IncludeOptions"], K extends string[]>(
		keys: K,
		options?: { include?: I; listenToNestedChanges: ListenToNestedChanges } | null
	): Observable<Record<ArrayValuesType<K>, FetchReturnType<T, I>>> {
		try {
			let promiseMap: Record<ArrayValuesType<K>, Observable<FetchReturnType<T, I>>> = {} as any;
			keys.forEach(
				(key: ArrayValuesType<K>) =>
					(promiseMap[key] = this.observeOne<I>(key, options?.include, options.listenToNestedChanges))
			);
			return combineLatest(promiseMap);
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
	 * :::caution
	 * 	This function will fetch the connected instances depending on the metadata inside the `object` param. if the metadata is not updated to the latest version then it won't (not)fetch any new (dis)connected instances
	 * if you want to the latest connected instances then you should refetch the data
	 * :::
	 *
	 *
	 * @see {@link FrostDelegate.getRelatedObservable}
	 * @see {@link IncludeOptions}.
	 *
	 * @param object - The object that you want to get the related objects from. (doesn't have to be an instantiated object could be the data map that was fetched manually )
	 * @param {IncludeOptions} include - see {@link IncludeOptions}.
	 * @returns an object instance with related objects that were given in the include parameter
	 */
	async getRelated<I extends T["IncludeOptions"]>(
		object: T["ModelWithMetadata"],
		include?: T["IncludeOptions"]
	): Promise<FetchReturnType<T, I>> {
		console.log(new Date().getTime(), this.model.name, "getRelated", object.id);
		let _include = this.getIncludeArray(include);

		let relations = this.getAllRelations({ keys: _include ?? [] });
		let value: any = object;
		let id = object.id;
		if(!id) throw new Error(`FrostError: ${this.model.name}Delegate : getRelated :Missing Object ID`);
		
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
	 * @see {@link IncludeOptions}.
	 * @see {@link ListenToNestedChanges}.
	 *
	 * :::caution
	 * 	This function will fetch the connected instances depending on the metadata inside the `object` param. if the metadata is not updated to the latest version then it won't (not)fetch any new (dis)connected instances
	 * if you want to the latest connected instances then you should refetch the data
	 * :::
	 *
	 * @param object - The object that you want to get the related objects from. (doesn't have to be an instantiated object could be the data map that was fetched manually )
	 * @param {IncludeOptions} include - see {@link IncludeOptions}.
	 * @param {ListenToNestedChanges} listenToNestedChanges - see {@link ListenToNestedChanges}.
	 * @returns an Observable of the object instance with related objects that were given in the include parameter
	 */
	getRelatedObservable<I extends T["IncludeOptions"]>(
		object: T["ModelWithMetadata"],
		include?: T["IncludeOptions"],
		listenToNestedChanges?: ListenToNestedChanges
	): Observable<FetchReturnType<T, I>> {
		let _include = this.getIncludeArray(include);

		let relations = this.getAllRelations({ keys: _include ?? [] });
		let value: any = object;
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
			? combineLatest(observables).pipe<FetchReturnType<T, I>>(
					map((values) => this.deserialize<I>({ ...value, ...values }))
			  )
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
	async add(object: T["Model"], connect?: T["ConnectOptions"]): Promise<{ id: string }> {
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
	async getAddMap(object: T["Model"], connect?: T["ConnectOptions"]): Promise<{ map: any; id: string }> {
		let data = JSON.parse(JSON.stringify(object));

		const newKey = data.id ?? push(child(ref(this.db), this.collectionPath)).key;
		if (!newKey) throw new Error("Can't add child to node: " + this.collectionPath);

		data.id = newKey;
		const updates = {};

		object.id = newKey;
		return {
			id: newKey,
			map: (await this._getUpdateMap(object, connect, undefined, undefined, false)).map,
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
		object: Partial<T["Model"]>,
		connect?: T["ConnectOptions"],
		disconnect?: T["DisconnectOptions"]
	): Promise<{ map: any }> {
		return this._getUpdateMap(object, connect, disconnect, undefined, true);
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
	protected async _getUpdateMap(
		object: Partial<T["Model"]>,
		connect?: T["ConnectOptions"],
		disconnect?: T["DisconnectOptions"],
		refreshMetadata: boolean = this._refreshMetadata,
		partialSerialize: boolean = false,
		ignoreObjectUpdates: boolean = false
	): Promise<{ map: any }> {
		if (refreshMetadata) {
			object = (await this.renewMetadata(object)) ?? object;
		}
		// let data = JSON.parse(JSON.stringify(object));
		let data = partialSerialize ? this.partialSerialize(object) : this.serialize(object);
		if (!data.id) throw new Error("Missing ID on data object" + JSON.stringify(data));

		const updates: any = {};

		let _disconnect: Record<string, "all" | true | string | string[]> | undefined = undefined;
		if (
			(typeof disconnect === "string" && disconnect === "all") ||
			(typeof disconnect === "boolean" && disconnect === true)
		) {
			_disconnect = this._getAllConnectedKeys(object);
		} else if (disconnect) {
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
									let temp = this.getConnectedKeys(rel.localField, object)?.[0];
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
										`${operation}[` +
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
										toBeUpdated = this.getConnectedKeys(rel.localField, object) ?? [];
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
											`${operation}[` +
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
										let temp = this.getConnectedKeys(rel.localField, object)?.[0];
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
											`${operation}[` +
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
		let finalData = {};
		if (!ignoreObjectUpdates) {
			let metadata = data["__frost__"];
			delete data["__frost__"];

			finalData = {
				...flattenObject(data, "/", join(this.collectionPath, data.id)),
				...flattenObject(metadata ?? {}, "/", join(this.collectionPath, data.id, "__frost__"), 4),
			};
		}
		// updates[join(this.collectionPath, data.id)] = data;

		// console.log({ ...updates, ...finalData });
		return { map: { ...updates, ...finalData } };
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
	async update(
		object: Partial<T["Model"]> & Required<FrostObject>,
		connect?: T["ConnectOptions"],
		disconnect?: T["DisconnectOptions"]
	): Promise<void> {
		const { map: updates } = await this.getUpdateMap(object, connect, disconnect);
		await update(ref(this.db), updates);
	}

	/**
	 * Returns a map of the updates that could be passed to the updated function from firebaseDB
	 * if the map is applied it removes the Object from the database and disconnects related objects depending on the disconnect parameter
	 *
	 * @see {@link DisconnectOptions}
	 *
	 * @param object - either the whole model or just a map with the id (ie; \{id: "..."\})
	 * @param disconnect - see {@link DisconnectOptions}
	 * @returns an object containing the update map
	 */
	async getDeleteMap(object: FrostObject, disconnect?: T["DisconnectOptions"]): Promise<{ map: any }> {
		if(!object.id) throw new Error("Delete Operation :: Missing Object ID");
		
		let map = (await this._getUpdateMap(object, undefined, disconnect ?? "all", true, true, true)).map;
		map[join(this.collectionPath, object.id)] = null;
		return { map };
	}

	/**
	 * Removes the Object from the database and disconnects related objects depending on the disconnect parameter
	 *
	 *
	 * @see {@link FrostDelegate.getDeleteMap | getDeleteMap}.
	 * @see {@link DisconnectOptions}
	 *
	 * @param object - either the whole model or just a map with the id (ie; \{id: "..."\})
	 * @param disconnect - see {@link DisconnectOptions}.
	 *
	 */
	async delete(object: FrostObject, disconnect?: T["DisconnectOptions"]): Promise<void> {
		const { map: updates } = await this.getDeleteMap(object, disconnect);
		await update(ref(this.db), updates);
	}

	/**
	 * It fetches the connected instances keys by property name
	 *
	 * :::caution
	 * This function will return the keys depending on the metadata inside the `object` param.
	 * if the metadata is not updated to the latest version then it won't return the updated keys
	 * if you want to the latest connected instances then you should refetch the data
	 * :::
	 *
	 * @param propertyName - the name of the property with the relation which keys' you require.
	 * @param object - the object instance that you want to get the keys from
	 * @returns an array containing the ids of the instances that are connected. if there are no connected keys or the property name is incorrect then there'll be no key-value pair for the specific property
	 */
	getConnectedKeys(propertyName: T["RelationsFieldsKeys"], object: T["FullModel"]): string[] | null {
		return getConnectedKeys(this.model, Object.values(this.relations), propertyName, object);
	}
	/**
	 * It fetches the connected instances keys of all relations
	 *
	 * :::caution
	 * This function will return the keys depending on the metadata inside the `object` param.
	 * if the metadata is not updated to the latest version then it won't return the updated keys
	 * if you want to the latest connected instances then you should refetch the data
	 * :::
	 *
	 * @param object - the object instance that you want to get the keys from
	 * @returns a map of property keys and corresponding array containing the ids of the instances that are connected. if there are no connected keys or the property name is incorrect then there'll be no key-value pair for the specific property
	 */
	getAllConnectedKeys(object: T["FullModel"]): Record<string, string[]> {
		return getAllConnectedKeys(this.model, Object.values(this.relations), object);
	}
	private _getAllConnectedKeys(object: T["FullModel"]): Record<string, string[] | string> {
		return _getAllConnectedKeys(this.model, Object.values(this.relations), object);
	}

	/**
	 * For local fields
	 * @param relation
	 * @param object
	 * @returns
	 */
	private getConnectedKeysByRelation(relation: Relation, object: any): string[] | null {
		return getConnectedKeysByRelation(this.model, relation, object);
	}

	private serialize(object: T["FullModel"]): T["Model"] {
		let output: any = {};
		this.getBaseProperties().forEach(({ name, type, isArray, optional, defaultValue = null }) => {
			let value = object[name];
			if (isNullOrUndefined(value)) {
				if (optional) output[name] = value ?? defaultValue;
				else throw new Error(`Property (${name}) in Model (${this.model.name}) cannot be null or undefined`);
			} else {
				if (isArray && !Array.isArray(value)) {
					throw new Error(
						`Property (${name}) in Model (${this.model.name}) should be an array, instead given value was (${value})`
					);
				}
				output[name] = value;
			}
		});
		output.id = object.id;
		return output as T["Model"];
	}
	private partialSerialize(object: Partial<T["Model"]>): Partial<T["Model"]> {
		let output: any = {};
		const propMap = this.getBasePropertiesMap();
		console.log({ propMap });
		Object.entries(object).forEach(([key, value]) => {
			if (!propMap[key]) return;
			let { name, type, isArray, optional, defaultValue = null } = propMap[key];
			if (value === undefined) {
				throw new Error(
					`Property ${name} cannot be undefined, if you want to unset the value then it should be set to \`null\``
				);
			} else {
				if (isArray && !Array.isArray(value) && value !== null) {
					throw new Error(
						`Property (${name}) in Model (${this.model.name}) should be an array, instead given value was (${value})`
					);
				}
				output[name] = value;
			}
		});
		output.id = object.id;
		return output;
	}
	private getBaseProperties() {
		return this.model.properties.filter(
			({ name }) =>
				this.model.relations.findIndex(
					({ localField, foreignField }) => name === localField.name || name === foreignField.name
				) === -1
		);
	}
	private getBasePropertiesMap() {
		return mapByKey(this.getBaseProperties(), "name");
	}

	private getFieldNamesWithRelations() {
		return Object.values(this.relations).map((rel)=>rel.localField)
	}


	private deserialize<I extends T["IncludeOptions"] = T["IncludeOptions"]>(data: any): FetchReturnType<T, I> {
		let output: any = { ...data };
		this.model.properties
			.filter(
				({ name }) =>
					this.model.relations.findIndex(
						({ localField, foreignField }) => name === localField.name || name === foreignField.name
					) === -1
			)
			.forEach(({ name, type, isArray, optional }) => {
				let value = data[name];
				if (isNullOrUndefined(value)) {
					if (optional) output[name] = value;
					else
						throw new Error(
							`Frost Deserializing Error: Property (${name}) in Model (${this.model.name}) cannot be null or undefined. Received \`${value}\` from database`
						);
				} else {
					if (isArray && !Array.isArray(value)) {
						throw new Error(
							`Frost Deserializing Error: Property (${name}) in Model (${this.model.name}) should be an array, instead given value was (${value})`
						);
					}
					switch (type) {
						case "Date":
						case "date":
							value = new Date(value);
							break;
					}
					output[name] = value;
				}
			});
		return output;
	}

	protected metadataFilterInclude<I extends T["IncludeOptions"] = T["IncludeOptions"]>(
		include: I | undefined,
		value: T["FullModel"]
	): I {
		if (Object.keys(include ?? {}).length === 0) return {} as any;
		return _.mapValues(value?.__frost__, (_value) => _.pick(_value, Object.keys(include ?? {}))) as any;
	}
	protected metadataChanged<I extends T["IncludeOptions"] = T["IncludeOptions"]>(
		include: I | undefined,
		defaultIncaseIncludeEmpty = false
	): (previous: any, current: any) => boolean {
		return (prev, curr) => {
			if (Object.keys(include ?? {}).length === 0) return defaultIncaseIncludeEmpty;
			return _.isEqual(this.metadataFilterInclude(include, prev), this.metadataFilterInclude(include, curr));
		};
	}

	protected async getMetadata(id: string, fallback = {}): Promise<T["FrostMetadata"]> {
		let [snapshot, error] = await resolve(get(child(ref(this.db), join(this.collectionPath, id, "__frost__"))));
		if (error && !snapshot) {
			console.error(error);
			throw error;
		}

		return snapshot?.val() ?? fallback;
	}
	protected async renewMetadata(object: T["Model"]): Promise<T["Model"] | undefined> {
		if (!object?.id) throw new Error(this.model.name + ":: Renew metadata: Missing Node ID");

		let [data, error] = await resolve(this.getMetadata(object.id));
		if (error) {
			console.error(error);
			throw error;
		}
		if (data) {
			return _.set(object, "__frost__", data);
		}
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

/**
 * @param model - The transpiler object describing the Model
 * @param relation - The relations defined on the provided model
 * @param propertyName - the name of the property with the relation which keys' you require.
 * @param object - the object instance that you want to get the keys from
 * @returns an array containing the ids of the instances that are connected. if there are no connected keys or the property name is incorrect then there'll be no key-value pair for the specific property
 */
function getConnectedKeys(model: Model, relations: Relation[], propertyName: string, object: any): string[] | null {
	let relation = relations.find((rel) => rel.fields.includes(propertyName));

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
/**
 * @param model - The transpiler object describing the Model
 * @param relation - The relations defined on the provided model
 * @param object - the object instance that you want to get the keys from
 * @returns an array containing the ids of the instances that are connected. if there are no connected keys or the property name is incorrect then there'll be no key-value pair for the specific property
 */
function getAllConnectedKeys(model: Model, relations: Relation[], object: any): Record<string, string[]> {
	let keys = relations
		.map((relation) => {
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
			return [relation.localField, keys as string[]];
		})
		.filter(Boolean) as [string, string[]][];
	return Object.fromEntries(keys);
}
function _getAllConnectedKeys(model: Model, relations: Relation[], object: any): Record<string, string[] | string> {
	let keys = relations
		.map((relation) => {
			relation = relation.withSide(model.name);
			let keys = _.get(object, slashToDotJoin(relation.localReference));
			if (!keys) return null;
			if (
				relation.relationType === RelationTypes.ONE_TO_ONE ||
				(relation.relationType === RelationTypes.ONE_TO_MANY && relation.isSlave)
			) {
				keys = keys;
			} else {
				keys = Object.keys(keys ?? {});
			}
			return [relation.localField, keys as string[] | string];
		})
		.filter(Boolean) as [string, string[]][];
	return Object.fromEntries(keys);
}

/**
 *
 * @param model - The transpiler object describing the Model
 * @param relation - The relation which keys you want.
 * @param object - the object instance that you want to get the keys from
 * @returns an array containing the ids of the instances that are connected. if there are no connected keys or the property name is incorrect then there'll be no key-value pair for the specific property
 */
function getConnectedKeysByRelation(model: Model, relation: Relation, object: any): string[] | null {
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
