import { beforeEach, describe, expect, it, vi } from "vitest";
import { Op, Transaction } from "sequelize";
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), setup: vi.fn(), list: vi.fn(), count: vi.fn() }));
vi.mock("../../../db.js", () => ({ default: { transaction: mocks.transaction } }));
vi.mock("../../../services/itemTrash/query.js", () => ({
    setItemTrashListReadOnly: mocks.setup,
    getMyItemTrashList: mocks.list,
    countMyItemTrashList: mocks.count,
}));
import { getItemTrashListUseCase as run } from "../getItemTrashList.js";
const t = {} as Transaction;
const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
        resolve = r;
    });
    return { promise, resolve };
};
beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (_options, callback) => await callback(t));
    mocks.setup.mockResolvedValue(undefined);
    mocks.list.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
});
describe("P0 一覧業務処理", () => {
    it("U01: 正規化と文字エスケープ・OR検索・page offset・切上げ", async () => {
        const row = { id: 123, name: null, price: null, first_image_url: null, title: null, createdAt: new Date(0) };
        mocks.list.mockResolvedValue([row]);
        mocks.count.mockResolvedValue(21);
        expect(await run({ userId: 7, page: 2, keyword: " Ａ カタ_%\\ " })).toEqual({
            itemTrashList: [{ itemTrash: row }],
            totalPages: 2,
        });
        const where = {
            [Op.or]: [{ name: { [Op.iLike]: "%aかた\\_\\%\\\\%" } }, { title: { [Op.iLike]: "%aかた\\_\\%\\\\%" } }],
        };
        expect(mocks.list).toHaveBeenCalledExactlyOnceWith({ userId: 7, where, limit: 20, offset: 20, transaction: t });
        expect(mocks.count).toHaveBeenCalledExactlyOnceWith({ userId: 7, where, transaction: t });
        expect(mocks.count.mock.calls[0][0].where).toBe(mocks.list.mock.calls[0][0].where);
        expect(mocks.transaction.mock.calls[0][0]).toEqual({ isolationLevel: "REPEATABLE READ", readOnly: true });
    });
    it.each([null, "", " 　"])("U01: keyword=%j、0件なら空配列・0ページ", async (keyword) => {
        expect(await run({ userId: 7, page: 10000, keyword })).toEqual({ itemTrashList: [], totalPages: 0 });
        expect(mocks.list.mock.calls[0][0]).toEqual({
            userId: 7,
            where: {},
            limit: 20,
            offset: 199980,
            transaction: t,
        });
    });
    it.each(["transaction", "setup", "list", "count"] as const)("U02: %s失敗の伝播・後続停止", async (stage) => {
        const error = new Error(stage);
        mocks[stage].mockRejectedValue(error);
        await expect(run({ userId: 7, page: 1, keyword: null })).rejects.toBe(error);
        if (stage === "transaction") expect(mocks.setup).not.toHaveBeenCalled();
        if (["transaction", "setup"].includes(stage)) expect(mocks.list).not.toHaveBeenCalled();
        if (stage !== "count") expect(mocks.count).not.toHaveBeenCalled();
    });
    it.each(["setup", "list", "count", "completion"] as const)("U03: %s保留中は後続・成功なし", async (stage) => {
        const gate = deferred<undefined>();
        const entered = deferred<undefined>();
        if (stage === "completion")
            mocks.transaction.mockImplementation(async (_options, callback) => {
                const result = await callback(t);
                entered.resolve(undefined);
                await gate.promise;
                return result;
            });
        else
            mocks[stage].mockImplementation(async () => {
                entered.resolve(undefined);
                await gate.promise;
                return stage === "list" ? [] : stage === "count" ? 0 : undefined;
            });
        let done = false;
        const pending = run({ userId: 7, page: 1, keyword: null }).finally(() => {
            done = true;
        });
        try {
            await entered.promise;
            expect(done).toBe(false);
            if (stage === "setup") expect(mocks.list).not.toHaveBeenCalled();
            if (stage === "list") expect(mocks.count).not.toHaveBeenCalled();
        } finally {
            gate.resolve(undefined);
            await pending;
        }
    });
    it("U02: callback後の完了失敗も伝播", async () => {
        const error = new Error("completion");
        mocks.transaction.mockImplementation(async (_options, callback) => {
            await callback(t);
            throw error;
        });
        await expect(run({ userId: 7, page: 1, keyword: null })).rejects.toBe(error);
        expect(mocks.count).toHaveBeenCalledOnce();
    });
});
