import * as _ from "lodash";
import { slashToDotJoin } from "./helpers/slashToDotJoin";
import { RelationTypes, __frost__relations } from "./decorators/relation"

/**
 * 
 * @returns a JSON String for the indices to be added to the Firebase Realtime Database
 * 
 */
export const getIndices = ()=>{

  let output:any= {}
  Object.entries(__frost__relations).forEach(([name,relation]) => {
    switch (relation.relationType) {
      case RelationTypes.ONE_TO_MANY:
        let o = relation.foreignReference.split('/')
        let final = o.pop()
        let indexOn = _.get(output,slashToDotJoin(relation.foreignCollectionPath,...o,"indexOn"))?? []
        _.set(output,slashToDotJoin(relation.foreignCollectionPath,...o,"indexOn"),[...indexOn,final])

        break;
      case RelationTypes.MANY_TO_MANY:
        // output.push(relation.foreignReference,relation.localReference)
        break;
    }
  });

  return JSON.stringify(output,null,4).replace(/"indexOn"/g,'".indexOn"');

}
