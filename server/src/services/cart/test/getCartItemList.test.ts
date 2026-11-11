import { beforeEach, describe, expect, it, vi } from "vitest";
import { Op, QueryTypes } from "sequelize";
import type { Transaction } from "sequelize";

const mocks = vi.hoisted(() => ({
    findAll: vi.fn(),
    count: vi.fn(),
    query: vi.fn(),
    Item: {},
    Video: {},
    Sale: {},
}));
vi.mock("../../../models/index.js", () => ({
    Cart: { findAll: mocks.findAll, count: mocks.count },
    Item: mocks.Item,
    Video: mocks.Video,
    Sale: mocks.Sale,
}));
vi.mock("../../../db.js", () => ({ default: { query: mocks.query } }));
import { getMyCartItemList, countMyCartItemList, setCartItemListReadOnly } from "../query.js";

beforeEach(() => vi.resetAllMocks());

describe("P0 カート商品一覧serviceの取得条件と例外伝播", () => {
    it("S01: 本人のカート・ItemのINNER条件・公開7列・LEFT関連・カート日時とID降順", async () => {
        const transaction = {} as Transaction;
        const where = { status: "soldout", search_text: { [Op.iLike]: "%しゃつ%" } };
        const rows = [{ id: 901, item_id: 123, Item: { id: 123 } }];
        mocks.findAll.mockResolvedValue(rows);
        mocks.count.mockResolvedValue(21);

        expect(await getMyCartItemList({ userId: 7, where, limit: 20, offset: 20, transaction })).toBe(rows);
        expect(await countMyCartItemList({ userId: 7, where, transaction })).toBe(21);
        expect(mocks.findAll).toHaveBeenCalledExactlyOnceWith({
            attributes: ["id", "item_id"],
            where: { user_id: 7 },
            limit: 20,
            offset: 20,
            order: [
                ["createdAt", "DESC"],
                ["id", "DESC"],
            ],
            include: [
                {
                    model: mocks.Item,
                    attributes: ["id", "name", "price", "status", "first_image_url", "gender_type", "age_type"],
                    where,
                    required: true,
                    include: [
                        { model: mocks.Video, attributes: ["title"], required: false },
                        {
                            model: mocks.Sale,
                            attributes: ["before_price", "sale_flag", "discount_rate", "discount_amount"],
                            required: false,
                        },
                    ],
                },
            ],
            transaction,
        });
        expect(mocks.count).toHaveBeenCalledExactlyOnceWith({
            where: { user_id: 7 },
            include: [{ model: mocks.Item, attributes: [], where, required: true }],
            transaction,
        });
        expect(mocks.findAll.mock.calls[0][0].transaction).toBe(transaction);
        expect(mocks.count.mock.calls[0][0].transaction).toBe(transaction);
        expect(mocks.findAll.mock.calls[0][0].include[0].where).toBe(where);
        expect(mocks.count.mock.calls[0][0].include[0].where).toBe(where);
        expect(mocks.query).not.toHaveBeenCalled();
    });

    it("S02: READ ONLY設定の固定SQLへ同一transactionを渡し、完了後undefinedを返す", async () => {
        const transaction = {} as Transaction;
        mocks.query.mockResolvedValue([[], {}]);
        expect(await setCartItemListReadOnly({ transaction })).toBeUndefined();
        expect(mocks.query).toHaveBeenCalledExactlyOnceWith("SET TRANSACTION READ ONLY", {
            transaction,
            type: QueryTypes.RAW,
        });
        expect(mocks.query.mock.calls[0][1].transaction).toBe(transaction);
        expect(mocks.findAll).not.toHaveBeenCalled();
        expect(mocks.count).not.toHaveBeenCalled();
    });

    it("S03: 一覧の空配列とcountの0をそのまま返す", async () => {
        const params = { userId: 7, where: {}, transaction: {} as Transaction };
        const rows: [] = [];
        mocks.findAll.mockResolvedValue(rows);
        mocks.count.mockResolvedValue(0);
        expect(await getMyCartItemList({ ...params, limit: 20, offset: 199980 })).toBe(rows);
        expect(await countMyCartItemList(params)).toBe(0);
    });

    it("S02: READ ONLYのSQL完了を待ってからserviceが完了する", async () => {
        let resolve!: () => void;
        const queryPromise = new Promise<void>((done) => {
            resolve = done;
        });
        mocks.query.mockReturnValue(queryPromise);
        let completed = false;
        const pending = setCartItemListReadOnly({ transaction: {} as Transaction }).finally(() => {
            completed = true;
        });
        try {
            expect(mocks.query).toHaveBeenCalledOnce();
            await Promise.resolve();
            expect(completed).toBe(false);
        } finally {
            resolve();
            await pending;
        }
        expect(completed).toBe(true);
    });

    it.each(["query", "findAll", "count"] as const)("S04: %sの失敗は元例外を一度だけ伝播する", async (target) => {
        const error = new Error("依存DBの障害");
        mocks[target].mockRejectedValue(error);
        const params = { userId: 7, where: {}, transaction: {} as Transaction };
        const pending =
            target === "query"
                ? setCartItemListReadOnly(params)
                : target === "findAll"
                  ? getMyCartItemList({ ...params, limit: 20, offset: 0 })
                  : countMyCartItemList(params);
        await expect(pending).rejects.toBe(error);
        expect(mocks[target]).toHaveBeenCalledTimes(1);
        for (const other of ["query", "findAll", "count"] as const) {
            if (other !== target) expect(mocks[other]).not.toHaveBeenCalled();
        }
    });
});
