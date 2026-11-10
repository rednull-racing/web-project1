import { beforeEach, describe, expect, it, vi } from "vitest";
import { Op, QueryTypes } from "sequelize";
import type { Transaction } from "sequelize";

const mocks = vi.hoisted(() => ({
    findAll: vi.fn(),
    count: vi.fn(),
    query: vi.fn(),
    Video: {},
    Sale: {},
}));
vi.mock("../../../../../models/index.js", () => ({
    Item: { findAll: mocks.findAll, count: mocks.count },
    Video: mocks.Video,
    Sale: mocks.Sale,
}));
vi.mock("../../../../../db.js", () => ({ default: { query: mocks.query } }));
import { getMyStockItemList, countMyStockItemList, setStockItemListReadOnly } from "../userItemList.js";

beforeEach(() => vi.resetAllMocks());

describe("P0 在庫一覧serviceの取得条件と例外伝播", () => {
    it("S01: 公開9列・LEFT関連・安定順・AND所有者・同一transactionを一覧と件数へ渡す", async () => {
        const transaction = {} as Transaction;
        const where = { seller_id: 99, status: "soldout", search_text: { [Op.iLike]: "%しゃつ%" } };
        const rows = [{ id: 123 }];
        mocks.findAll.mockResolvedValue(rows);
        mocks.count.mockResolvedValue(21);

        expect(await getMyStockItemList({ userId: 7, where, limit: 20, offset: 20, transaction })).toBe(rows);
        expect(await countMyStockItemList({ userId: 7, where, transaction })).toBe(21);
        expect(mocks.findAll).toHaveBeenCalledExactlyOnceWith({
            attributes: ["id", "name", "price", "status", "first_image_url", "gender_type", "age_type", "attributes", "uploaded_at"],
            where: { [Op.and]: [{ seller_id: 7 }, where] },
            limit: 20,
            offset: 20,
            order: [
                ["uploaded_at", "DESC"],
                ["id", "DESC"],
            ],
            include: [
                { model: mocks.Video, attributes: ["title"], required: false },
                {
                    model: mocks.Sale,
                    attributes: ["before_price", "sale_flag", "discount_rate", "discount_amount"],
                    required: false,
                },
            ],
            transaction,
        });
        expect(mocks.count).toHaveBeenCalledExactlyOnceWith({
            where: { [Op.and]: [{ seller_id: 7 }, where] },
            transaction,
        });
        expect(mocks.findAll.mock.calls[0][0].transaction).toBe(transaction);
        expect(mocks.count.mock.calls[0][0].transaction).toBe(transaction);
        expect(mocks.findAll.mock.calls[0][0].where[Op.and][1]).toBe(where);
        expect(mocks.count.mock.calls[0][0].where[Op.and][1]).toBe(where);
        expect(mocks.query).not.toHaveBeenCalled();
    });

    it("S02: READ ONLY設定の固定SQLへ同一transactionを渡し、完了後undefinedを返す", async () => {
        const transaction = {} as Transaction;
        mocks.query.mockResolvedValue([[], {}]);
        expect(await setStockItemListReadOnly({ transaction })).toBeUndefined();
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
        expect(await getMyStockItemList({ ...params, limit: 20, offset: 199980 })).toBe(rows);
        expect(await countMyStockItemList(params)).toBe(0);
    });

    it.each(["query", "findAll", "count"] as const)("S04: %sの失敗は元例外を一度だけ伝播する", async (target) => {
        const error = new Error("依存DBの障害");
        mocks[target].mockRejectedValue(error);
        const params = { userId: 7, where: {}, transaction: {} as Transaction };
        const pending =
            target === "query"
                ? setStockItemListReadOnly(params)
                : target === "findAll"
                  ? getMyStockItemList({ ...params, limit: 20, offset: 0 })
                  : countMyStockItemList(params);
        await expect(pending).rejects.toBe(error);
        expect(mocks[target]).toHaveBeenCalledTimes(1);
        for (const other of ["query", "findAll", "count"] as const) {
            if (other !== target) expect(mocks[other]).not.toHaveBeenCalled();
        }
    });
});
