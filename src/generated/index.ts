import { Model, TranspilerRelationWithModels } from "../global-types";

export type DelegatesMap = {
}

export function getDelegatesMap():DelegatesMap {
	throw new Error("You have to Run `npx frost generate` command first");
}

const FrostModels: Record<string,Model>= {}

export function getFrostModels():typeof FrostModels {
	throw new Error("You have to Run `npx frost generate` command first");
}

const FrostRelations: Record<string,TranspilerRelationWithModels>= {}

export function getFrostRelations():typeof FrostRelations {
	throw new Error("You have to Run `npx frost generate` command first");
}
