import { FirebaseApp, FirebaseOptions, initializeApp } from "firebase/app";
import { Database, getDatabase } from "firebase/database";
import { FrostDelegate  } from "./delegates";
import * as _ from "lodash";
import { slashToDotJoin } from "./helpers/slashToDotJoin";
import { Relation, RelationTypes } from "./delegates/relation";
import { ClassOf } from "./types-helpers/constructor";
import { DelegatesMap, getDelegatesMap, getFrostRelations } from "./generated";

export class Frost {
	private static firebaseApp: FirebaseApp;
	private static firebaseDB: Database;
	private static relations: Record<string,Relation>;

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
	static getIndices() {
		if (!this.initialized) throw new Error("Frost App is not initialized");
		let relations = _.mapValues(getFrostRelations(),(x)=>Relation.fromTranspilerRelation(x).emancipated())
		let output: any = {};
		Object.entries(relations).forEach(([name, relation]) => {
			switch (relation.relationType) {
				case RelationTypes.ONE_TO_MANY:
					let indexOn = _.get(output, slashToDotJoin(relation.foreignCollectionPath,"indexOn")) ?? [];

					_.set(output, slashToDotJoin(relation.foreignCollectionPath, "indexOn"), [...indexOn, relation.foreignReference]);

					break;
			}
		});

		return JSON.stringify(output, null, 4).replace(/"indexOn"/g, '".indexOn"');
	}
}
/**
 * This the type of the FrostApp instance
 * It contains the FirebaseApp instance and the default Firebase database instance
 * It also contains all the instance of the FrostDelegate for each model after running the `npx frost generate` command
 */
export type FrostAppImpl<T extends { [key: string]: ClassOf<FrostDelegate> }> = { -readonly [Property in keyof T]: InstanceType<T[Property]> } & {
	 readonly firebaseApp: FirebaseApp 
	 readonly firebaseDB: Database
	};

