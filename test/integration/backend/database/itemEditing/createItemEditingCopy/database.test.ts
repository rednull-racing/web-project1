import "../../../../../fixtures/backend/itemEditing/createItemEditingCopy/databaseSetup.js";
import { DatabaseError, ForeignKeyConstraintError, QueryTypes, ValidationError } from "sequelize";
import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it } from "vitest";
import type { CreateItemEditingCopyParams } from "../../../../../../server/src/types/serviceType/itemEditing.js";
import type { ItemAttributes } from "../../../../../../server/src/types/itemAttributes.js";
import { createItemEditingCopy } from "../../../../../../server/src/services/itemEditing/command.js";
import {
    seed, run, snapshot, protectedSnapshot, editingIds, expectedCopy, expectCopy, createdCounts,
    observer, sequelize, Item, ItemEditing,
} from "../../../../../fixtures/backend/itemEditing/createItemEditingCopy/databaseFixtures.js";
import type { DbFixture } from "../../../../../fixtures/backend/itemEditing/createItemEditingCopy/databaseFixtures.js";
import { expectedAttributes, expectAppError, nullableItemKeys, videoKeys, shippingKeys } from "../../../../../fixtures/backend/itemEditing/createItemEditingCopy/fixtures.js";
import { createItemEditingCopyBodySchema } from "../../../../../../server/src/validators/body/itemEditing.js";
import { AppError } from "../../../../../../server/src/errors.js";

let f: DbFixture;
beforeEach(async () => { f = await seed(); });

const verifyRun = async (overrides: Partial<CreateItemEditingCopyParams["data"]> = {}) => {
    const before = await protectedSnapshot(f), ids = await editingIds(f), counts = createdCounts();
    const id = await run(f);
    const row = await expectCopy(id, { ...expectedCopy(f), ...overrides });
    expect(await protectedSnapshot(f)).toEqual(before);
    expect(await editingIds(f)).toEqual([...ids, id].sort((a, b) => a - b));
    expect(createdCounts()).toEqual(counts.map(([table, count]) => [table, count + (table === "item_editing" ? 1 : 0)]));
    return { id, row };
};
const rejectedWrite = async (write: (transaction: Transaction) => Promise<unknown>) => {
    const transaction = await observer.transaction();
    try {
        try {
            await write(transaction);
            return undefined;
        } catch (error: unknown) {
            return error;
        }
    } finally {
        // 制約が欠けてUPDATEが成功した場合も、テスト行を元へ戻す。
        await transaction.rollback();
    }
};

describe("P0/P1 実DBの永続化・非対象行不変", () => {
    it("D01 N01 N02 N03 N10 T01: 全項目をcommitして元/関連/既存行は変更しない", async () => {
        await verifyRun();
    });
    it.each(["video", "sale", "shipping", "all"] as const)(
        "D02 N04: %sの任意関連がなくてもNULLへ展開して作成する", async (relation) => {
            const overrides: Partial<CreateItemEditingCopyParams["data"]> = {};
            if (relation === "video" || relation === "all") {
                await f.item.update({ video_id: null });
                for (const key of videoKeys) overrides[key === "status" ? "video_status" : key] = null;
            }
            if (relation === "sale" || relation === "all") {
                await f.item.update({ sale_id: null }); overrides.before_price = null; overrides.price = null;
            }
            if (relation === "shipping" || relation === "all") {
                await f.item.update({ shipping_id: null });
                for (const key of shippingKeys) overrides[key] = null;
            }
            await verifyRun(overrides);
        },
    );
    it.each(nullableItemKeys)("D02 N05 B03: Item.%s=nullを保存する", async (key) => {
        await f.item.update({ [key]: null }); await verifyRun({ [key]: null });
    });
    it.each(videoKeys)("D02 N05: Video.%s=nullを保存する", async (key) => {
        await f.video.update({ [key]: null }); await verifyRun({ [key === "status" ? "video_status" : key]: null });
    });
    it.each(shippingKeys)("D02 N05 B03: 配送.%s=nullを保存する", async (key) => {
        await f.shipping.update({ [key]: null }); await verifyRun({ [key]: null });
    });
    it("D02 N06: 空文字・0・falseをDBでも保持する", async () => {
        await f.item.update({ detail: "", recommend: false });
        await f.video.update({ title: "", summary: "", duration: 0 });
        await f.sale.update({ before_price: 0 });
        await f.shipping.update({ shipping_service_free_text: "" });
        await verifyRun({
            detail: "", recommend: false, title: "", summary: "", duration: 0,
            before_price: 0, price: 0, shipping_service_free_text: "",
        });
    });
    it("D02 N07: Sale.before_price=nullでもItem.priceへfallbackしない", async () => {
        await f.sale.update({ before_price: null }); await verifyRun({ before_price: null, price: null });
    });
    it.each([true, false, null])("N08: recommend=%sをDBで保持する", async (recommend) => {
        await f.item.update({ recommend }); await verifyRun({ recommend });
    });
    it.each(["men", "women", "unisex"] as const)("N08: gender=%sをDBで保持する", async (gender_type) => {
        await f.item.update({ gender_type }); await verifyRun({ gender_type });
    });
    it.each(["adult", "kids", "both"] as const)("N08: age=%sをDBで保持する", async (age_type) => {
        await f.item.update({ age_type }); await verifyRun({ age_type });
    });
    it.each([null, [], ["one"], Array.from({ length: 10 }, (_, i) => "image-" + i)].map((image_url) => ({ image_url })))(
        "D02 N09: image_url=$image_urlの保存表現と順序を保持する", async ({ image_url }) => {
            await f.item.update({ image_url }); await verifyRun({ image_url });
        },
    );
    it.each([null, "", "processing", "ready"])("N11: Video.status=%sを保存する", async (video_status) => {
        await f.video.update({ status: video_status, converted_url: null });
        await verifyRun({ video_status, converted_url: null });
    });
    it.each([0, 254, 255])("D02 B01: VARCHAR項目の%s文字をコピーする", async (length) => {
        const value = "あ".repeat(length);
        await f.item.update({ name: value }); await f.video.update({ title: value, status: value });
        await f.shipping.update({ shipping_service_free_text: value });
        await verifyRun({ name: value, title: value, video_status: value, shipping_service_free_text: value });
    });
    it("B02: 長いTEXT・日本語・改行をそのまま永続化する", async () => {
        const text = "日本語\n".repeat(1000);
        await f.item.update({ detail: text });
        await f.video.update({ summary: text, original_url: text });
        await verifyRun({ detail: text, summary: text, original_url: text });
    });
    it("D03 I01 I08: 商品・色・サイズのcurrentのみ復元しJSONBの順序と値を保持する", async () => {
        const { row } = await verifyRun();
        expect(row.attributes).toEqual(expectedAttributes());
        expect((await snapshot("item", f.item.id))!.attributes).toEqual(f.item.attributes);
    });
    it("D03 I02: 全階層initial=0を欠落と扱わずcurrent=0へ戻す", async () => {
        const attributes: ItemAttributes = {
            inventory: { initial: 0, current: 6, low_stock_ratio: 0.15 },
            colorVariants: [{
                uiId: "zero", inventory: { initial: 0, current: 2, low_stock_ratio: 0.3 },
                sizes: [{ size: "M", inventory: { initial: 0, current: 1, low_stock_ratio: 0.8 } }],
            }],
        };
        await f.item.update({ attributes });
        await verifyRun({ attributes: {
            inventory: { initial: 0, current: 0, low_stock_ratio: 0.15 },
            colorVariants: [{
                uiId: "zero", inventory: { initial: 0, current: 0, low_stock_ratio: 0.3 },
                sizes: [{ size: "M", inventory: { initial: 0, current: 0, low_stock_ratio: 0.8 } }],
            }],
        } });
    });
    it.each([
        ["空", {}, {}],
        ["色空", { colorVariants: [] }, { colorVariants: [] }],
        ["sizes欠落", { colorVariants: [{ uiId: "x" }] }, { colorVariants: [{ uiId: "x" }] }],
        ["sizes空", { colorVariants: [{ sizes: [] }] }, { colorVariants: [{ sizes: [] }] }],
        ["サイズのみ", { colorVariants: [{ sizes: [
            { size: "M", inventory: { initial: 7, current: 1, low_stock_ratio: 0.4 } },
        ] }] }, { colorVariants: [{ sizes: [
            { size: "M", inventory: { initial: 7, current: 7, low_stock_ratio: 0.4 } },
        ] }] }],
        ["色のみ", { colorVariants: [{ inventory: { initial: 5, current: 1, low_stock_ratio: 0.6 } }] },
            { colorVariants: [{ inventory: { initial: 5, current: 5, low_stock_ratio: 0.6 } }] }],
    ] satisfies Array<[string, ItemAttributes, ItemAttributes]>)(
        "D03 I04 I05 I06: %sの欠落キーと空配列を保持する", async (_label, attributes, expected) => {
            await f.item.update({ attributes }); await verifyRun({ attributes: expected });
        },
    );
    it("D03 I10: JSONB追加キーを落とさず在庫だけ復元する", async () => {
        const attributes = { ...f.item.attributes, extra: { label: "将来属性" },
            inventory: { initial: 20, current: 6, low_stock_ratio: 0.15, reserved: 2 } };
        await f.item.update({ attributes });
        await verifyRun({ attributes: {
            ...expectedAttributes(), extra: { label: "将来属性" },
            inventory: { initial: 20, current: 20, low_stock_ratio: 0.15, reserved: 2 },
        } as ItemAttributes });
    });
    it("D08: コピー後の編集行変更が元・他編集行へ波及しない", async () => {
        const id = await run(f), before = await protectedSnapshot(f);
        await ItemEditing.update({ name: "コピーのみ変更", attributes: { inventory: { initial: 2, current: 1, low_stock_ratio: 0.9 } } },
            { where: { id } });
        expect((await snapshot("item_editing", id))!.name).toBe("コピーのみ変更");
        expect(await protectedSnapshot(f)).toEqual(before);
    });
});

describe("P0 所有権・状態による拒否", () => {
    it.each(["不在", "他人", "他人かつsoldout", "所有者null", "soldout"] as const)(
        "D04 E01 E02 E09: %sは404で全データ不変", async (mode) => {
            if (mode === "所有者null") await f.item.update({ seller_id: null });
            if (mode === "soldout") await f.item.update({ status: "soldout" });
            if (mode === "他人かつsoldout") await f.otherItem.update({ status: "soldout" });
            let id = f.item.id;
            if (mode.startsWith("他人")) id = f.otherItem.id;
            if (mode === "不在") {
                const missing = await Item.create({ seller_id: f.owner.id, uploaded_at: new Date() });
                id = missing.id; await missing.destroy();
            }
            const before = await protectedSnapshot(f), ids = await editingIds(f);
            await expectAppError(run(f, id));
            expect(await protectedSnapshot(f)).toEqual(before);
            expect(await editingIds(f)).toEqual(ids);
        },
    );
});

describe("P1 保存先のモデル検証と実DB制約を分ける", () => {
    it("D05: 実スキーマのNULL・FK・VARCHAR・ENUM定義を確認する", async () => {
        const columns = await sequelize.getQueryInterface().describeTable("item_editing");
        expect(columns.item_id.allowNull).toBe(true);
        for (const key of ["gender_type", "age_type", "attributes", "sale_flag"]) expect(columns[key].allowNull).toBe(false);
        for (const key of ["name", "title", "shipping_service_free_text", "video_status"]) expect(columns[key].type).toContain("255");
        const rows = await observer.query<{ definition: string }>(
            "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'item_editing'::regclass",
            { type: QueryTypes.SELECT },
        );
        for (const key of ["seller_id", "item_id", "category_id", "brand_id", "brand_aliases_id",
            "item_condition_id", "shipping_day_id", "shipping_service_id", "shipping_place_id"]) {
            expect(rows.some((row) => row.definition.includes("FOREIGN KEY (" + key + ")"))).toBe(true);
        }
        expect(await observer.query(
            "SELECT id FROM item_editing WHERE id = :id AND item_id = :itemId",
            { replacements: { id: f.existing.id, itemId: f.item.id }, type: QueryTypes.SELECT },
        )).toHaveLength(1);
    });
    it.each([
        ["gender_type", null, "23502"], ["age_type", null, "23502"], ["attributes", null, "23502"],
        ["gender_type", "invalid", "22P02"], ["age_type", "invalid", "22P02"],
        ["name", "あ".repeat(256), "22001"], ["title", "あ".repeat(256), "22001"],
        ["shipping_service_free_text", "あ".repeat(256), "22001"], ["video_status", "あ".repeat(256), "22001"],
    ] as const)("D05: 直接SQLで%s=%jの制約を検証してrollbackする（SQLSTATE=%s）", async (column, value, state) => {
        const before = await snapshot("item_editing", f.existing.id);
        const error = await rejectedWrite(async (transaction) => {
            await observer.query('UPDATE item_editing SET "' + column + '" = :value WHERE id = :id', {
                replacements: { value, id: f.existing.id }, transaction,
            });
        });
        expect(error).toBeInstanceOf(DatabaseError);
        expect(error).toHaveProperty("parent.code", state);
        expect(await snapshot("item_editing", f.existing.id)).toEqual(before);
    });
    it.each(["item_id", "seller_id", "category_id", "brand_id", "brand_aliases_id", "item_condition_id",
        "shipping_day_id", "shipping_service_id", "shipping_place_id"] as const)(
        "D05: %sの存在しないFKはDBで拒否され元行を保つ", async (column) => {
            // 親のPKは正の自動採番。-1がないことを各親テーブルで先に確認する。
            const parentTables = {
                item_id: "item", seller_id: "user", category_id: "categories", brand_id: "brands", brand_aliases_id: "brand_aliases",
                item_condition_id: "item_condition_option", shipping_day_id: "shipping_day_option",
                shipping_service_id: "shipping_service_option", shipping_place_id: "todouhuken_option",
            };
            const rows = await observer.query('SELECT id FROM "' + parentTables[column] + '" WHERE id = :id',
                { replacements: { id: -1 }, type: QueryTypes.SELECT });
            expect(rows).toHaveLength(0);
            const before = await snapshot("item_editing", f.existing.id);
            const error = await rejectedWrite(async (transaction) => {
                await observer.query('UPDATE item_editing SET "' + column + '" = :value WHERE id = :id',
                    { replacements: { value: -1, id: f.existing.id }, transaction });
            });
            expect(error).toBeInstanceOf(ForeignKeyConstraintError);
            expect(error).toHaveProperty("parent.code", "23503");
            expect(await snapshot("item_editing", f.existing.id)).toEqual(before);
        },
    );
    it.each([10, 11])("D06: create serviceの画像%s枚はモデル側の上限で判定する", async (length) => {
        const ids = await editingIds(f), before = await protectedSnapshot(f);
        const data = { ...expectedCopy(f), image_url: Array.from({ length }, (_, i) => "image-" + i) };
        const pending = sequelize.transaction((transaction) => createItemEditingCopy({ data, transaction }));
        if (length === 11) {
            await expect(pending).rejects.toBeInstanceOf(ValidationError);
            expect(await editingIds(f)).toEqual(ids);
        } else {
            const result = await pending;
            await expectCopy(result.id, data);
        }
        expect(await protectedSnapshot(f)).toEqual(before);
    });
});

describe("P2 逐次再実行と観測", () => {
    it("Q01 Q02: 既存編集行があっても2回とも新規生成する", async () => {
        const before = await protectedSnapshot(f), ids = await editingIds(f);
        const first = await run(f), second = await run(f);
        expect(first).not.toBe(second);
        await expectCopy(first, expectedCopy(f)); await expectCopy(second, expectedCopy(f));
        expect(await editingIds(f)).toEqual([...ids, first, second].sort((a, b) => a - b));
        expect(await protectedSnapshot(f)).toEqual(before);
    });
    it("Q03: 再実行は更新後の元データを使い初回コピーを変えない", async () => {
        const first = await run(f), initial = await snapshot("item_editing", first);
        await f.item.update({ name: "更新後", attributes: { inventory: { initial: 99, current: 1, low_stock_ratio: 0.7 } } });
        await f.video.update({ title: "更新動画" }); await f.sale.update({ before_price: 12345 });
        const second = await run(f);
        await expectCopy(second, { ...expectedCopy(f), name: "更新後", title: "更新動画", price: 12345, before_price: 12345,
            attributes: { inventory: { initial: 99, current: 99, low_stock_ratio: 0.7 } } });
        expect(await snapshot("item_editing", first)).toEqual(initial);
    });
    it.each(["soldout", "所有者変更", "削除"])("Q04: 初回成功後の%sでは追加生成せず初回コピーを保持する", async (mode) => {
        const first = await run(f), copy = await snapshot("item_editing", first);
        if (mode === "soldout") await f.item.update({ status: "soldout" });
        if (mode === "所有者変更") await f.item.update({ seller_id: f.other.id });
        if (mode === "削除") await f.item.destroy();
        const ids = await editingIds(f), before = await protectedSnapshot(f);
        await expectAppError(run(f));
        expect(await editingIds(f)).toEqual(ids); expect(await protectedSnapshot(f)).toEqual(before);
        expect(await snapshot("item_editing", first)).toEqual(copy);
    });
    it.each([null, undefined])("O01: size.inventory=%sの破損JSONBで作成を打ち切る観測", async (inventory) => {
        await f.item.update({ attributes: { colorVariants: [{ sizes: [{ size: "M", inventory }] }] } as unknown as ItemAttributes });
        const before = await protectedSnapshot(f), ids = await editingIds(f);
        await expect(run(f)).rejects.toBeInstanceOf(TypeError);
        expect(await protectedSnapshot(f)).toEqual(before); expect(await editingIds(f)).toEqual(ids);
    });
    it.each([2147483648, Number.MAX_SAFE_INTEGER])("O02: 範囲外の安全整数%sのDB結果を分類する観測", async (itemId) => {
        expect(createItemEditingCopyBodySchema.parse({ itemId })).toEqual({ itemId });
        const before = await protectedSnapshot(f), ids = await editingIds(f);
        const error: unknown = await run(f, itemId).catch((caught: unknown) => caught);
        if (error instanceof AppError) expect(error).toMatchObject({ code: "ITEM_NOT_FOUND", statusCode: 404 });
        else {
            expect(error).toBeInstanceOf(DatabaseError);
            expect(error).toHaveProperty("parent.code", "22003");
        }
        expect(await protectedSnapshot(f)).toEqual(before); expect(await editingIds(f)).toEqual(ids);
    });
    it("O05: activeとdeleted_at併存時の現行コピー挙動を観測する", async () => {
        await f.item.update({ deleted_at: new Date("2020-01-01T00:00:00Z") });
        await verifyRun();
    });
});
