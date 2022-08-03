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
	debounce,debounceTime

} from "rxjs";
import { observable } from "../helpers/observable";
import { valueOrNull } from "../helpers/valueOrNull";
import { trueOrNull } from "../helpers/trueOrNull";
import { resolve } from "../helpers/resolve";
import { slashToDotJoin } from "../helpers/slashToDotJoin";
import { join } from "../helpers/join";
import { FrostObject, IFrostObject } from "./frost-object";

export abstract class FrostApi<T extends FrostObject> {
	collectionPath: string;
	// private many_to_many_val = {connected:true}
	entity: IFrostObject<T>;

	constructor(public db: Database) {}
	static async getMany(db,collectionPath,...ids){
		let snapshots = (await Promise.all(
			ids.map((id)=>resolve(get(child(ref(db), join(collectionPath, id)))))
		)).map(([snapshot,error])=>(snapshot && snapshot.exists())?snapshot.val():null)

		return _.zipObject(ids,snapshots)
	}
	getMetadata = (symbol: string | symbol) => Reflect.getMetadata(symbol, this.entity.prototype);
	getNodeRelations = (): string[] => this.getMetadata(NodeRelationsSymbol) ?? [];
	getMetadataKeys = () => Reflect.getMetadataKeys(this.entity.prototype);

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
		options: { include?: string[]; listenToNestedChanges?: boolean,debounceDuration?:number } | null,
		...queryConstraints: QueryConstraint[]
	): Observable<T[]> {
		let listenToNestedChanges = Object.hasOwn(options ?? {}, "listenToNestedChanges")
			? Boolean(options.listenToNestedChanges)
			: true;
		let debounceDuration = options.debounceDuration ?? 500
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
	listen(id: string, include?: string[], listenToNestedChanges = true) {
		try {
			console.log("FrostApi::listen", this.entity, this.collectionPath);

			return observable(child(ref(this.db), join(this.collectionPath, id))).pipe(
				switchMap((snapshot) => {
					console.log(snapshot);
					if (snapshot.exists()) {
						let value = snapshot.val();
						if (listenToNestedChanges) {
							return this.getRelatedObservable(value, include);
						}
						return from(this.getRelated(value, include));
					} else {
						return throwError(() => new Error("Snapshot Doesn't exits"));
					}
				})
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
						value[rel.localField] = await (
							await get(
								query(
									ref(this.db, rel.foreignCollectionPath),
									orderByChild(join(rel.foreignReference, id,'connected')),
									equalTo(true)
								)
							)
						).val();
					}
					break;
			}
		}
		console.log("getRelated", { value });
		return new this.entity(value);
	}
	getRelatedObservable(object: any, include?: string[]): Observable<T> {
		let relations = this.getAllRelations({ keys: include ?? [] });
		let value = object;
		let id = object.id;
		let observables: Record<string, Observable<any>> = {};
		for (let _rel of relations) {
			let rel = _rel.withSide(this.entity);
			switch (rel.relationType) {
				case RelationTypes.ONE_TO_ONE:
					{
						observables[rel.localField] = observable(
							child(
								ref(this.db),
								join(rel.foreignCollectionPath, _.get(value, slashToDotJoin(rel.localReference)))
							)
						).pipe(map((value) => value.val()));
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
								  )
						).pipe(map((value) => value.val()));
					}

					break;
				case RelationTypes.MANY_TO_MANY:
					{
						observables[rel.localField] = observable(
							query(
								ref(this.db, join(rel.foreignCollectionPath)),
								orderByChild(join(rel.foreignReference, id,'connected')),
								equalTo(true)
							)
						).pipe(map((value) => value.val()));
					}
					break;
			}
		}
		console.log({ value });
		return Object.keys(observables).length
			? combineLatest(observables).pipe<T>(map((values) => new this.entity({ ...value, ...values })))
			: of(new this.entity({ ...value }));
	}

	async add(object: T, connect?: Record<string, string | string[]>): Promise<any> {
		const { map: updates, id } = await this.getAddMap(object, connect);
		await update(ref(this.db), updates);
		return { id };
	}
	async getAddMap(object: T, connect?: Record<string, string | string[]>): Promise<{ map: any; id: string }> {
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
		//
		// if (connect) {
		//   let relations = this.getAllRelations({ keys: Object.keys(connect) });
		//   console.log(this.entity.name, { relations });
		//   for (const _rel of relations) {
		//     let rel = _rel.withSide(this.entity);
		//     switch (rel.relationType) {
		//       case RelationTypes.ONE_TO_ONE:
		//         _.set(data, dotJoin(rel.localReference), connect[rel.localField]);
		//         updates[
		//           join(
		//             rel.foreignCollectionPath,
		//             connect[rel.localField],
		//             rel.foreignReference
		//           )
		//         ] = data.id;
		//         break;
		//       case RelationTypes.ONE_TO_MANY:
		//         if (rel.isMaster) {
		//           const toBeUpdated = connect[rel.localField];
		//           console.log({ toBeUpdated });
		//           if (Array.isArray(toBeUpdated)) {
		//             toBeUpdated.forEach((element) => {
		//               _.set(data, dotJoin(rel.localReference, element), true);
		//               updates[
		//                 join(
		//                   rel.foreignCollectionPath,
		//                   element,
		//                   rel.foreignReference
		//                 )
		//               ] = data.id;
		//             });
		//           } else {
		//             throw new Error(
		//               'connect[' +
		//                 rel.localField +
		//                 '] should be an array in entity (' +
		//                 this.entity.name +
		//                 ')'
		//             );
		//           }
		//         } else {
		//           console.log(rel.localField, connect);
		//           const toBeUpdated = connect[rel.localField];
		//           if (typeof toBeUpdated === 'string') {
		//             _.set(data, dotJoin(rel.localReference), toBeUpdated);
		//             updates[
		//               join(
		//                 rel.foreignCollectionPath,
		//                 toBeUpdated,
		//                 rel.foreignReference,
		//                 data.id
		//               )
		//             ] = true;
		//           } else {
		//             throw new Error(
		//               'connect[' +
		//                 rel.localField +
		//                 '] should be a string in entity (' +
		//                 rel.sides[0]().name +
		//                 ')'
		//             );
		//           }
		//         }
		//         break;
		//       case RelationTypes.MANY_TO_MANY:
		//         {
		//           const toBeUpdated = connect[rel.localField];
		//           if (Array.isArray(toBeUpdated)) {
		//             toBeUpdated.forEach((element: string) => {
		//               _.set(data, dotJoin(rel.localReference, element), true);
		//               updates[join(rel.foreignReference, data.id)] = true;
		//             });
		//           } else {
		//             throw new Error(
		//               'connect[' +
		//                 rel.localField +
		//                 '] should be an array in entity (' +
		//                 this.entity.name +
		//                 ')'
		//             );
		//           }
		//         }
		//         break;
		//     }
		//   }
		// }
		// updates[join(this.collectionPath, newKey)] = data;
		// console.log({ updates });
		// return { map: updates, id: newKey };
	}

	async getUpdateMap(
		object: T,
		connect?: Record<string, string | string[]>,
		disconnect?: "all" | Record<string, "all" | true | string | string[]>
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
								if (toBeUpdated === "all") {
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
								if (toBeUpdated === "all") {
									toBeUpdated = object.getConnectedKeys(rel.localField) ?? [];
								}
								if (Array.isArray(toBeUpdated)) {
									toBeUpdated.forEach((element: string) => {
										_.set(
											data,
											slashToDotJoin(rel.localReference, element),
											valueOrNull(operation === "connect",{connected:true})
										);
										updates[
											join(rel.foreignCollectionPath, element, rel.foreignReference, data.id)
										] = valueOrNull(operation === "connect",{connected:true});
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
	 * The `values` argument contains multiple property-value pairs that will be
	 * written to the Database together. Each child property can either be a simple
	 * property (for example, "name") or a relative path (for example,
	 * "name/first") from the current location to the data to update.
	 *
	 * As opposed to the `set()` method, `update()` can be use to selectively update
	 * only the referenced properties at the current location (instead of replacing
	 * all the child properties at the current location).
	 *
	 * The effect of the write will be visible immediately, and the corresponding
	 * events ('value', 'child_added', etc.) will be triggered. Synchronization of
	 * the data to the Firebase servers will also be started, and the returned
	 * Promise will resolve when complete. If provided, the `onComplete` callback
	 * will be called asynchronously after synchronization has finished.
	 *
	 * A single `update()` will generate a single "value" event at the location
	 * where the `update()` was performed, regardless of how many children were
	 * modified.
	 *
	 * Note that modifying data with `update()` will cancel any pending
	 * transactions at that location, so extreme care should be taken if mixing
	 * `update()` and `transaction()` to modify the same data.
	 *
	 * Passing `null` to `update()` will remove the data at this location.
	 *
	 * See
	 * {@link https://firebase.googleblog.com/2015/09/introducing-multi-location-updates-and_86.html | Introducing multi-location updates and more}.
	 *
	 * @param ref - The location to write to.
	 * @param values - Object containing multiple values.
	 * @returns Resolves when update on server is complete.
	 */
	async update(
		object: T,
		connect?: Record<string, string | string[]>,
		disconnect?: "all" | Record<string, string | string[]>
	): Promise<void> {
		const { map: updates } = await this.getUpdateMap(object, connect, disconnect);
		await update(ref(this.db), updates);
	}

	async getDeleteMap(object: T, disconnect: "all" | Record<string, string | string[]>): Promise<{ map: any }> {
		let map = (await this.getUpdateMap(object, undefined, disconnect)).map;
		map[join(this.collectionPath, object.id!)] = null;
		return { map };
	}
	async delete(object: T, disconnect: "all" | Record<string, string | string[]>): Promise<void> {
		const { map: updates } = await this.getDeleteMap(object, disconnect);
		await update(ref(this.db), updates);
	}
}
