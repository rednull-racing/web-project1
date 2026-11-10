import { beforeEach, describe, expect, it, vi } from "vitest";
import { Op, Transaction } from "sequelize";
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), setup: vi.fn(), list: vi.fn(), count: vi.fn() }));
vi.mock("../../../../db.js", () => ({ default: { transaction: mocks.transaction } }));
vi.mock("../../../../services/items/query/list/userItemList.js", () => ({
    setUploadedItemListReadOnly: mocks.setup,
    getMyUploadedItemList: mocks.list,
    countMyUploadedItemList: mocks.count,
}));
import { getUploadedItemListUseCase as run } from "../getUploadedItemList.js";
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
    it.each([
        { keyword: " Ａ ﾊﾟｰｶｰ ", pattern: "%aぱ゜か゜%" },
        { keyword: "＊.[x](a)^$+?{x}", pattern: "%*.[x](a)^$+?{x}%" },
        { keyword: "％＿", pattern: "%\\%\\_%" },
    ])("U01: $keywordを現在のnormalizeJapaneseで正規化し文字検索する", async ({ keyword, pattern }) => {
        await run({ userId: 7, page: 1, keyword });
        expect(mocks.list.mock.calls[0][0].where).toEqual({
            status: { [Op.in]: ["active", "soldout"] },
            search_text: { [Op.iLike]: pattern },
        });
    });
    it("U01: 正規化と文字エスケープ・search_text検索・page offset・切上げ", async () => {
        const row = {
            id: 123,
            name: null,
            price: null,
            status: "active",
            first_image_url: null,
            gender_type: "unisex",
            age_type: "both",
            uploaded_at: new Date(0),
            Video: null,
            Sale: null,
        };
        mocks.list.mockResolvedValue([row]);
        mocks.count.mockResolvedValue(21);
        expect(await run({ userId: 7, page: 2, keyword: " Ａ カタ_%\\ " })).toEqual({
            itemList: [{ item: row }],
            totalPages: 2,
        });
        const where = {
            status: { [Op.in]: ["active", "soldout"] },
            search_text: { [Op.iLike]: "%aかた\\_\\%\\\\%" },
        };
        expect(mocks.list).toHaveBeenCalledExactlyOnceWith({ userId: 7, where, limit: 20, offset: 20, transaction: t });
        expect(mocks.count).toHaveBeenCalledExactlyOnceWith({ userId: 7, where, transaction: t });
        expect(mocks.count.mock.calls[0][0].where).toBe(mocks.list.mock.calls[0][0].where);
        expect(mocks.transaction.mock.calls[0][0]).toEqual({ isolationLevel: "REPEATABLE READ", readOnly: true });
    });
    it.each([null, "", " 　"])("U01: keyword=%j、0件なら空配列・0ページ", async (keyword) => {
        expect(await run({ userId: 7, page: 10000, keyword })).toEqual({ itemList: [], totalPages: 0 });
        expect(mocks.list.mock.calls[0][0]).toEqual({
            userId: 7,
            where: { status: { [Op.in]: ["active", "soldout"] } },
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

describe("P0 公開項目・status", () => {
    it.each(["active", "soldout"] as const)("U01: status=%sは単独条件", async (status) => {
        await run({ userId: 7, page: 1, status, keyword: null });
        expect(mocks.list.mock.calls[0][0].where).toEqual({ status });
    });
    it.each([0, 20, 21])("U04: 件数%iの切上げと公開項目の選択", async (count) => {
        const row = {
            id: 123,
            name: "商品",
            price: 0,
            status: "soldout",
            first_image_url: null,
            gender_type: "unisex",
            age_type: "both",
            uploaded_at: new Date(0),
            Video: { title: null, id: 77, original_url: "private" },
            Sale: { before_price: null, sale_flag: false, discount_rate: 0, discount_amount: null, id: 88 },
            seller_id: 7,
            search_text: "private",
        };
        mocks.list.mockResolvedValue([row]);
        mocks.count.mockResolvedValue(count);
        expect(await run({ userId: 7, page: 1, keyword: null })).toEqual({
            itemList: [
                {
                    item: {
                        id: 123,
                        name: "商品",
                        price: 0,
                        status: "soldout",
                        first_image_url: null,
                        gender_type: "unisex",
                        age_type: "both",
                        uploaded_at: new Date(0),
                        Video: { title: null },
                        Sale: { before_price: null, sale_flag: false, discount_rate: 0, discount_amount: null },
                    },
                },
            ],
            totalPages: count === 0 ? 0 : count === 20 ? 1 : 2,
        });
        expect(row.Video.id).toBe(77);
        expect(row.Sale.id).toBe(88);
    });
});
