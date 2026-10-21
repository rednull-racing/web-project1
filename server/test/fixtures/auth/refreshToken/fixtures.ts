export const makeStoredToken = () => ({
    token: "stored-refresh-token",
    user_id: 7,
    expires_at: new Date("2026-10-21T00:00:00Z"),
});
export const makeUser = () => ({ id: 7, email: "refresh-test@example.test" });
export const deferred = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};
