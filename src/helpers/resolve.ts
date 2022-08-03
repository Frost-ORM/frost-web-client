
export async function resolve<T>(
    promise: Promise<T>
): Promise<[T | null, any | null]> {
    try {
        let response = await promise;
        return [response, null];
    } catch (error: any) {
        return [null, error];
    }
}
