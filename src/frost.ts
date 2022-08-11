import { FirebaseApp, FirebaseOptions, initializeApp } from "firebase/app";
import { Database, getDatabase } from "firebase/database";
import { FrostApi, FrostObject, IFrostApi } from "./decorators";
import * as _ from "lodash";
import { slashToDotJoin } from "./helpers/slashToDotJoin";
import { RelationTypes, __frost__relations } from "./decorators/relation";

export class Frost {
	static firebaseApp: FirebaseApp;
	static firebaseDB: Database;

	private static _initialized: boolean = false;

	/**
	 * This method initializes the firebase app instance and the database instance
	 * @param {@link https://firebase.google.com/docs/reference/js/app.firebaseoptions.md#firebaseoptions_interface | FirebaseOptions} firebaseConfig
	 * @returns {@link https://firebase.google.com/docs/reference/js/app.firebaseapp.md#firebaseapp_interface | FirebaseApp}
	 */
	static initialize<T extends { [key: string]: IFrostApi }>(
		firebaseConfig: FirebaseOptions,
		APIs: T
	): FrostAppImpl<T> {
		if (this.initialized) throw new Error("Frost App is already initialized");

		Frost.firebaseApp = initializeApp(firebaseConfig);
		Frost.firebaseDB = getDatabase(Frost.firebaseApp);
		Frost._initialized = true;
		let tmp: any = { firebaseApp: Frost.firebaseApp };

		for (const key in APIs) {
			tmp[key] = new APIs[key]();
		}
		return { ...tmp } as FrostAppImpl<T>;
	}

	static get initialized() {
		return Frost._initialized;
	}

	/**
	 *
	 * @returns a JSON String for the indices to be added to the Firebase Realtime Database
	 *
	 */
	static getIndices() {
		if (!this.initialized) throw new Error("Frost App is not initialized");

		let output: any = {};
		Object.entries(__frost__relations).forEach(([name, relation]) => {
			switch (relation.relationType) {
				case RelationTypes.ONE_TO_MANY:
					let o = relation.foreignReference.split("/");
					let final = o.pop();
					let indexOn = _.get(output, slashToDotJoin(relation.foreignCollectionPath, ...o, "indexOn")) ?? [];
					_.set(output, slashToDotJoin(relation.foreignCollectionPath, ...o, "indexOn"), [...indexOn, final]);

					break;
				case RelationTypes.MANY_TO_MANY:
					// output.push(relation.foreignReference,relation.localReference)
					break;
			}
		});

		return JSON.stringify(output, null, 4).replace(/"indexOn"/g, '".indexOn"');
	}
}
/**
 * @internal
 */
export type FrostAppImpl<T extends { [key: string]: IFrostApi }> = { -readonly [Property in keyof T]: InstanceType<T[Property]> } & { readonly firebaseApp: FirebaseApp };

