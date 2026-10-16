import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred } from "../../../test/fixtures/itemEditing/updateConfirm/fixtures.js";
const mocks = vi.hoisted(() => ({ findOne: vi.fn(), query: vi.fn(), findAlias: vi.fn(), createAlias: vi.fn() }));
vi.mock("../../models/index.js", () => ({
    ItemEditing: { findOne: mocks.findOne },
    Item: {},
    BrandAliases: { findOne: mocks.findAlias, create: mocks.createAlias },
    Brands: {},
}));
vi.mock("../../db.js", () => ({ default: { query: mocks.query } }));
import { Brands } from "../../models/index.js";
import { createAliases } from "../brandAliases.js";

beforeEach(() => {
    vi.resetAllMocks();
});
describe("P05: 別名作成のロックと再検索", () => {
    it.each([false, true])("ロック完了後の既存alias有無=%sで再利用または作成する", async (exists) => {
        const transaction = { id: "alias-transaction" } as unknown as Transaction;
        const alias = { id: 71, brand_id: null };
        const locked = deferred<void>();
        mocks.query.mockReturnValue(locked.promise);
        mocks.findAlias.mockResolvedValue(exists ? alias : null);
        mocks.createAlias.mockResolvedValue(alias);
        const pending = createAliases({ inputName: "ブランド", normalized: "ぶらんど", transaction });
        try {
            expect(mocks.query).toHaveBeenCalledExactlyOnceWith(
                "SELECT pg_advisory_xact_lock(hashtext('brand_aliases'), hashtext($normalized))",
                { bind: { normalized: "ぶらんど" }, transaction },
            );
            expect(mocks.findAlias).not.toHaveBeenCalled();
            expect(mocks.createAlias).not.toHaveBeenCalled();
        } finally {
            locked.resolve();
            await pending;
        }
        expect(await pending).toBe(alias);
        expect(mocks.findAlias).toHaveBeenCalledExactlyOnceWith({
            where: { name_normalized: "ぶらんど" },
            include: [{ model: Brands, as: "brand" }],
            transaction,
        });
        if (exists) expect(mocks.createAlias).not.toHaveBeenCalled();
        else
            expect(mocks.createAlias).toHaveBeenCalledExactlyOnceWith(
                { brand_id: null, name: "ブランド", name_normalized: "ぶらんど" },
                { transaction },
            );
    });

    it.each(["query", "findAlias", "createAlias"] as const)("%sの例外をそのまま伝播する", async (step) => {
        const transaction = { id: "alias-transaction" } as unknown as Transaction;
        const error = new Error(step);
        mocks.query.mockResolvedValue([]);
        mocks.findAlias.mockResolvedValue(null);
        mocks[step].mockRejectedValue(error);
        await expect(createAliases({ inputName: "ブランド", normalized: "ぶらんど", transaction })).rejects.toBe(error);
        if (step === "query") expect(mocks.findAlias).not.toHaveBeenCalled();
        if (step !== "createAlias") expect(mocks.createAlias).not.toHaveBeenCalled();
    });
});
