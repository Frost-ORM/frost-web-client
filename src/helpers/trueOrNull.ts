import { valueOrNull } from './valueOrNull';

export function trueOrNull(arg: any) {
    return valueOrNull(arg, true);
}
