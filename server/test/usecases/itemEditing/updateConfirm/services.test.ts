import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred, makeItem } from "./fixtures.js";
const mocks = vi.hoisted(() => ({ findOne: vi.fn(), query: vi.fn(), findAlias: vi.fn(), createAlias: vi.fn() }));
vi.mock("../../../../src/models/index.js", () => ({
    ItemEditing: { findOne: mocks.findOne }, Item: {},
    BrandAliases: { findOne: mocks.findAlias, create: mocks.createAlias }, Brands: {},
}));
vi.mock("../../../../src/db.js", () => ({ default: { query: mocks.query } }));
import { Brands } from "../../../../src/models/index.js";
import { createAliases } from "../../../../src/services/brandAliases.js";
import { getMyItemEditing } from "../../../../src/services/itemEditing/query.js";
import { updateConfirm, updateItemEditingImage } from "../../../../src/services/itemEditing/command.js";

beforeEach(() => {
    vi.resetAllMocks();
});
describe("P1: DBへ接続しないservice契約", () => {
    it.each([7, 8])("D01: ユーザー%sと商品IDの両方をwhereへ渡す", async (userId) => {
        const item = userId === 7 ? makeItem() : null;
        mocks.findOne.mockResolvedValue(item);
        expect(await getMyItemEditing({ itemEditingId: 11, userId })).toBe(item);
        expect(mocks.findOne).toHaveBeenCalledExactlyOnceWith({ where: { id: 11, seller_id: userId } });
    });
    it("D02: updateへデータと同じtransactionオブジェクトを渡す", async () => {
        const update = vi.fn().mockResolvedValue(undefined);
        const item = { ...makeItem(), update } as unknown as Parameters<typeof updateConfirm>[0]["itemEditing"];
        const transaction = { id: "transaction" } as unknown as Transaction;
        const data: Parameters<typeof updateConfirm>[0]["data"] = {
            name: "商品",
            detail: "説明",
            price: 500,
            first_image_url: "image",
            category_id: 21,
            gender_type: "unisex",
            age_type: "both",
            brand_id: 61,
            brand_aliases_id: null,
            item_condition_id: 31,
            attributes: {},
            title: "動画",
            summary: "説明",
            thumbnail_url: "thumbnail",
            original_url: "video",
            before_price: 500,
            shipping_day_id: 41,
            shipping_service_id: 51,
            shipping_place_id: 13,
            shipping_service_free_text: null,
        };
        await updateConfirm({ itemEditing: item, data, transaction });
        expect(update).toHaveBeenCalledExactlyOnceWith(data, { transaction });
        expect(update.mock.calls[0][0]).toBe(data);
        expect(update.mock.calls[0][1].transaction).toBe(transaction);
    });
    it("D03: 配列設定・変更フラグ・saveを順に呼び同じtransactionを渡す", async () => {
        const setDataValue = vi.fn(),
            changed = vi.fn(),
            save = vi.fn().mockResolvedValue(undefined);
        const item = { ...makeItem(), setDataValue, changed, save } as unknown as Parameters<
            typeof updateItemEditingImage
        >[0]["itemEditing"];
        const transaction = { id: "transaction" } as unknown as Transaction;
        const urls = ["image-b", "image-a"];
        await updateItemEditingImage({ itemEditing: item, urls, transaction });
        expect(setDataValue).toHaveBeenCalledExactlyOnceWith("image_url", urls);
        expect(changed).toHaveBeenCalledExactlyOnceWith("image_url", true);
        expect(save).toHaveBeenCalledExactlyOnceWith({ transaction });
        expect(setDataValue.mock.invocationCallOrder[0]).toBeLessThan(changed.mock.invocationCallOrder[0]);
        expect(changed.mock.invocationCallOrder[0]).toBeLessThan(save.mock.invocationCallOrder[0]);
    });
});


it("P02/P08: 所有者条件と同じtransactionで更新ロックを指定する", async () => {
    const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
    const item = makeItem();
    mocks.findOne.mockResolvedValue(item);
    expect(await getMyItemEditing({ itemEditingId: 11, userId: 7, transaction })).toBe(item);
    expect(mocks.findOne).toHaveBeenCalledExactlyOnceWith({
        where: { id: 11, seller_id: 7 }, transaction, lock: "UPDATE",
    });
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
        } finally { locked.resolve(); await pending; }
        expect(await pending).toBe(alias);
        expect(mocks.findAlias).toHaveBeenCalledExactlyOnceWith({
            where: { name_normalized: "ぶらんど" }, include: [{ model: Brands, as: "brand" }], transaction,
        });
        if (exists) expect(mocks.createAlias).not.toHaveBeenCalled();
        else expect(mocks.createAlias).toHaveBeenCalledExactlyOnceWith(
            { brand_id: null, name: "ブランド", name_normalized: "ぶらんど" }, { transaction },
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
