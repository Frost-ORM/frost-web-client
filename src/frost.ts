import { FirebaseApp, FirebaseOptions, initializeApp } from "firebase/app";
import { Database, getDatabase } from "firebase/database";
import { FrostDelegate  } from "./delegates";
import * as _ from "lodash";
import { slashToDotJoin } from "./helpers/slashToDotJoin";
import { Relation, RelationTypes } from "./delegates/relation";
import { ClassOf } from "./types-helpers/constructor";
import { DelegatesMap, getDelegatesMap } from "./generated";

export class Frost {
	static firebaseApp: FirebaseApp;
	static firebaseDB: Database;
	static relations: Record<string,Relation>;

	private static _initialized: boolean = false;

	/**
	 * This method initializes the firebase app instance and the database instance
	 * @param {@link https://firebase.google.com/docs/reference/js/app.firebaseoptions.md#firebaseoptions_interface | FirebaseOptions} firebaseConfig
	 * @returns {@link https://firebase.google.com/docs/reference/js/app.firebaseapp.md#firebaseapp_interface | FirebaseApp}
	 */
	static initialize(
		firebaseConfig: FirebaseOptions,
	): FrostAppImpl<DelegatesMap> {
		let delegates = getDelegatesMap()
		if (this.initialized) throw new Error("Frost App is already initialized");

		Frost.firebaseApp = initializeApp(firebaseConfig);
		Frost.firebaseDB = getDatabase(Frost.firebaseApp);
		Frost._initialized = true;
		let tmp: any = { firebaseApp: Frost.firebaseApp,firebaseDB: Frost.firebaseDB };

		for (const key in delegates) {
			tmp[key] = new (delegates[key])(Frost.firebaseDB);
		}
		return { ...tmp } as FrostAppImpl<DelegatesMap>;
	}

	static get initialized() {
		return Frost._initialized;
	}

	/**
	 *
	 * @returns a JSON String for the indices to be added to the Firebase Realtime Database
	 *
	 */
	//FIXME Fix getIndices
	static getIndices() {
		if (!this.initialized) throw new Error("Frost App is not initialized");

		let output: any = {};
		Object.entries(this.relations).forEach(([name, relation]) => {
			switch (relation.relationType) {
				case RelationTypes.ONE_TO_MANY:
					let o = relation.foreignReference.split("/");
					let final = o.pop();
					let indexOn = _.get(output, slashToDotJoin(relation.foreignCollectionPath, ...o, "indexOn")) ?? [];
					_.set(output, slashToDotJoin(relation.foreignCollectionPath, ...o, "indexOn"), [...indexOn, final]);

					break;
			}
		});

		return JSON.stringify(output, null, 4).replace(/"indexOn"/g, '".indexOn"');
	}
}
/**
 * @internal
 */
export type FrostAppImpl<T extends { [key: string]: ClassOf<FrostDelegate> }> = { -readonly [Property in keyof T]: InstanceType<T[Property]> } & {
	 readonly firebaseApp: FirebaseApp 
	 readonly firebaseDB: Database
	};

