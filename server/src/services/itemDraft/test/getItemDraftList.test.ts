import { beforeEach, describe, expect, it, vi } from "vitest";
import { Op, QueryTypes } from "sequelize";
import type { Transaction } from "sequelize";
const mocks = vi.hoisted(() => ({ findAll: vi.fn(), count: vi.fn(), query: vi.fn() }));
vi.mock("../../../models/index.js", () => ({ ItemDraft: { findAll: mocks.findAll, count: mocks.count } }));
vi.mock("../../../db.js", () => ({ default: { query: mocks.query } }));
import { getMyItemDraftList, countMyItemDraftList, setItemDraftListReadOnly } from "../query.js";

beforeEach(() => vi.resetAllMocks());
describe("P0 本人限定検索のSQL引数", () => {
    it("S01: 6列・安定順・AND所有者・同一transactionを一覧と件数へ渡す", async () => {
        const transaction = {} as Transaction;
        const where = { seller_id: 99 };
        const rows = [{ id: 1 }];
        mocks.findAll.mockResolvedValue(rows);
        mocks.count.mockResolvedValue(21);
        expect(await getMyItemDraftList({ userId: 7, where, limit: 20, offset: 20, transaction })).toBe(rows);
        expect(await countMyItemDraftList({ userId: 7, where, transaction })).toBe(21);
        expect(mocks.findAll).toHaveBeenCalledExactlyOnceWith({
            attributes: ["id", "name", "price", "first_image_url", "title", "createdAt"],
            where: { [Op.and]: [{ seller_id: 7 }, where] },
            limit: 20,
            offset: 20,
            order: [
                ["createdAt", "DESC"],
                ["id", "DESC"],
            ],
            transaction,
        });
        expect(mocks.count).toHaveBeenCalledExactlyOnceWith({
            where: { [Op.and]: [{ seller_id: 7 }, where] },
            transaction,
        });
        await setItemDraftListReadOnly({ transaction });
        expect(mocks.query).toHaveBeenCalledExactlyOnceWith("SET TRANSACTION READ ONLY", {
            transaction,
            type: QueryTypes.RAW,
        });
    });
});
