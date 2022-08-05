
import { FirebaseApp, FirebaseOptions, initializeApp } from 'firebase/app'
import { Database, getDatabase } from 'firebase/database';

export class Frost{
    static firebaseApp:FirebaseApp;
    static firebaseDB:Database;
    private static _initialized:boolean = false

    /**
     * This method initializes the firebase app instance and the database instance
     */
    static initialize(firebaseConfig:FirebaseOptions){
        if(this.initialized) throw new Error("Already initialized");
        
        Frost.firebaseApp = initializeApp(firebaseConfig)
        Frost.firebaseDB = getDatabase(Frost.firebaseApp)
        Frost._initialized = true
    }

    static get initialized(){
        return Frost._initialized;
    }
}