import "../../../../fixtures/items/updateItem/databaseSetup.js";
import { describe, expect, it, vi } from "vitest";
import {
    seed,
    run,
    snapshot,
    targetSnapshot,
    nonTargetSnapshot,
    notification,
    trackedIds,
    Item,
    Video,
    Sale,
    ItemShippingProfile,
} from "../../../../fixtures/items/updateItem/databaseFixtures.js";
import { expectedAttributes } from "../../../../fixtures/itemEditing/createItemEditingCopy/fixtures.js";
import * as videoCommand from "../../../../../src/services/video/video.js";
import * as saleCommand from "../../../../../src/services/sale/sale.js";
import * as shippingCommand from "../../../../../src/services/itemShippingProfile/itemShippingProfile.js";
import * as itemCommand from "../../../../../src/services/items/command/update.js";
import * as editingCommand from "../../../../../src/services/itemEditing/command.js";

describe("D01 実DBの保存値・保持列・元行消費", () => {
    it.each(["active", "soldout"] as const)("D01 N01 N02: 更新前%sを制限せず全列を同じIDへ保存", async (status) => {
        const f = await seed();
        await f.item.update({ status });
        await f.video.update({ play_count: 567 });
        const before = await targetSnapshot(f);
        const protectedBefore = await nonTargetSnapshot(f);
        const countBefore = [Item, Video, Sale, ItemShippingProfile].map((m) => trackedIds(m).length);
        expect(await run(f)).toBe(f.item.id);
        const [item, video, sale, shipping, editing] = await targetSnapshot(f);
        const { updatedAt: itemUpdated, save_at: saved, ...itemStored } = item!;
        const { updatedAt: _oldUpdate, save_at: _oldSave, ...itemBefore } = before[0]!;
        void _oldUpdate;
        void _oldSave;
        expect(itemStored).toEqual({
            ...itemBefore,
            name: "新商品Ａ",
            detail: "新しい説明",
            image_url: ["https://media.test/new-2", "https://media.test/new-1"],
            price: 12345,
            item_condition_id: f.condition.id,
            first_image_url: "https://media.test/new-first",
            gender_type: "unisex",
            age_type: "both",
            recommend: true,
            category_id: f.category.id,
            brand_id: f.brand.id,
            brand_aliases_id: f.alias.id,
            attributes: expectedAttributes(),
            search_text: "新商品a動画bかてごりb親かたかなasellera",
            status: "active",
        });
        const { updatedAt: videoUpdated, ...videoStored } = video!;
        const { updatedAt: _oldVideo, ...videoBefore } = before[1]!;
        void _oldVideo;
        expect(videoStored).toEqual({
            ...videoBefore,
            thumbnail_url: "https://media.test/new-thumb",
            title: "動画Ｂ",
            summary: "新しい動画説明",
            duration: 87,
            original_url: "https://media.test/new-original",
            converted_url: "https://media.test/new-converted",
            status: "processing",
        });
        const { updatedAt: saleUpdated, ...saleStored } = sale!;
        const { updatedAt: _oldSale, ...saleBefore } = before[2]!;
        void _oldSale;
        expect(saleStored).toEqual({
            ...saleBefore,
            before_price: 15432,
            discount_rate: null,
            discount_amount: null,
            sale_flag: false,
        });
        const { updatedAt: shippingUpdated, ...shippingStored } = shipping!;
        const { updatedAt: _oldShipping, ...shippingBefore } = before[3]!;
        void _oldShipping;
        expect(shippingStored).toEqual({
            ...shippingBefore,
            shipping_day_id: f.day.id,
            shipping_service_id: f.service.id,
            shipping_place_id: f.place.id,
            shipping_service_free_text: "新しい配送文",
        });
        expect(editing).toBeNull();
        for (const date of [itemUpdated, videoUpdated, saleUpdated, shippingUpdated, saved])
            expect(date).toBeInstanceOf(Date);
        expect((saved as Date).getTime()).toBeGreaterThan(new Date("2020-01-01").getTime());
        expect(await nonTargetSnapshot(f)).toEqual(protectedBefore);
        expect([Item, Video, Sale, ItemShippingProfile].map((m) => trackedIds(m).length)).toEqual(countBefore);
        expect(notification).toHaveBeenCalledExactlyOnceWith({
            data: {
                read_user_id: f.owner.id,
                url: `/item/${f.item.id}`,
                message_image: "https://media.test/new-first",
                message: "商品「新商品Ａ」が更新されました。商品の詳細はこちらの商品ページからご確認ください。",
                type: "ITEM",
            },
        });
        await expect(run(f)).rejects.toMatchObject({ code: "ITEM_EDITING_NOT_FOUND", statusCode: 404 });
        expect(notification).toHaveBeenCalledTimes(1);
    });
    it.each([0, 1])("D01 N02: 復元後の商品在庫initial=%sでstatusを判定", async (initial) => {
        const f = await seed();
        await f.editing.update({ attributes: { inventory: { initial, current: 999, low_stock_ratio: 0.25 } } });
        await run(f);
        expect((await snapshot("item", f.item.id))!.attributes).toEqual({
            inventory: { initial, current: initial, low_stock_ratio: 0.25 },
        });
        expect((await snapshot("item", f.item.id))!.status).toBe(initial === 0 ? "soldout" : "active");
    });
    it("D01 N01: nullable列を保持し変換未完了・URL形式を再検証しない", async () => {
        const f = await seed();
        await f.editing.update({
            detail: null,
            summary: null,
            duration: null,
            converted_url: null,
            video_status: null,
            recommend: null,
            brand_id: null,
            brand_aliases_id: null,
            before_price: null,
            shipping_service_free_text: null,
            original_url: "not-a-url",
            thumbnail_url: "not-a-thumbnail",
            first_image_url: "not-an-image",
        });
        await run(f);
        const [item, video, sale, shipping] = await targetSnapshot(f);
        expect(item).toMatchObject({
            detail: null,
            recommend: null,
            brand_id: null,
            brand_aliases_id: null,
            first_image_url: "not-an-image",
        });
        expect(video).toMatchObject({
            summary: null,
            duration: null,
            converted_url: null,
            status: null,
            original_url: "not-a-url",
            thumbnail_url: "not-a-thumbnail",
        });
        expect(sale).toMatchObject({
            before_price: null,
            discount_rate: null,
            discount_amount: null,
            sale_flag: false,
        });
        expect(shipping).toMatchObject({ shipping_service_free_text: null });
    });
});

describe("D02 各書込み後の障害と実rollback・再試行", () => {
    it.each(["video", "sale", "shipping", "item", "delete"] as const)(
        "D02: %s SQL完了後throwで全対象復元",
        async (stage) => {
            const f = await seed();
            const before = await targetSnapshot(f),
                protectedBefore = await nonTargetSnapshot(f);
            const failure = new Error("injected-after-" + stage);
            let sqlFinished = false;
            const fail = async (operation: () => Promise<unknown>) => {
                await operation();
                sqlFinished = true;
                throw failure;
            };
            if (stage === "video") {
                const real = videoCommand.updateVideo;
                vi.spyOn(videoCommand, "updateVideo").mockImplementationOnce((args) => fail(() => real(args)));
            }
            if (stage === "sale") {
                const real = saleCommand.updateSale;
                vi.spyOn(saleCommand, "updateSale").mockImplementationOnce((args) => fail(() => real(args)));
            }
            if (stage === "shipping") {
                const real = shippingCommand.updateShipping;
                vi.spyOn(shippingCommand, "updateShipping").mockImplementationOnce((args) => fail(() => real(args)));
            }
            if (stage === "item") {
                const real = itemCommand.updateItem;
                vi.spyOn(itemCommand, "updateItem").mockImplementationOnce((args) => fail(() => real(args)));
            }
            if (stage === "delete") {
                const real = editingCommand.deleteItemEditing;
                vi.spyOn(editingCommand, "deleteItemEditing").mockImplementationOnce((args) => fail(() => real(args)));
            }
            await expect(run(f)).rejects.toBe(failure);
            expect(sqlFinished).toBe(true);
            expect(await targetSnapshot(f)).toEqual(before);
            expect(await nonTargetSnapshot(f)).toEqual(protectedBefore);
            expect(notification).not.toHaveBeenCalled();
            expect(await run(f)).toBe(f.item.id);
            expect(await snapshot("item_editing", f.editing.id)).toBeNull();
            expect(notification).toHaveBeenCalledTimes(1);
        },
    );
});

describe("D01 E01 実所有者条件・状態・関連欠落", () => {
    it.each([
        "other-editing",
        "normal",
        "null-item",
        "other-item",
        "null-owner",
        "missing-session",
        "video",
        "sale",
        "shipping",
    ] as const)("D01 E01: %sを拒否し4行と元行を保持", async (mode) => {
        const f = await seed();
        if (mode === "normal") await f.editing.update({ status: "normal" });
        if (mode === "null-item") await f.editing.update({ item_id: null });
        if (mode === "other-item") await f.item.update({ seller_id: f.other.id });
        if (mode === "null-owner") await f.item.update({ seller_id: null });
        if (mode === "missing-session") await f.editing.destroy();
        if (mode === "video") await f.item.update({ video_id: null });
        if (mode === "sale") await f.item.update({ sale_id: null });
        if (mode === "shipping") await f.item.update({ shipping_id: null });
        const before = await targetSnapshot(f),
            protectedBefore = await nonTargetSnapshot(f);
        const code =
            mode === "normal" || mode === "null-item"
                ? "ITEM_EDITING_STATE_INVALID"
                : mode === "other-item" || mode === "null-owner"
                  ? "ITEM_NOT_FOUND"
                  : ["video", "sale", "shipping"].includes(mode)
                    ? "ITEM_RELATION_NOT_FOUND"
                    : "ITEM_EDITING_NOT_FOUND";
        await expect(run(f, mode === "other-editing" ? f.otherEditing.id : f.editing.id)).rejects.toMatchObject({
            code,
        });
        expect(await targetSnapshot(f)).toEqual(before);
        expect(await nonTargetSnapshot(f)).toEqual(protectedBefore);
        expect(notification).not.toHaveBeenCalled();
    });
});

const invalidValues: Array<[string, unknown, string]> = [
    ["name", "", "ITEM_PUBLISH_DATA_INVALID"],
    ["title", "", "ITEM_PUBLISH_DATA_INVALID"],
    ["name", null, "ITEM_PUBLISH_DATA_INVALID"],
    ["title", null, "ITEM_PUBLISH_DATA_INVALID"],
    ["price", 299, "ITEM_PUBLISH_DATA_INVALID"],
    ["price", 1000001, "ITEM_PUBLISH_DATA_INVALID"],
    ["first_image_url", "", "ITEM_PUBLISH_DATA_INVALID"],
    ["original_url", null, "VIDEO_URL_NULL"],
    ["thumbnail_url", null, "THUMBNAIL_URL_NULL"],
    ["image_url", [], "ITEM_IMAGE_NULL"],
    ["image_url", Array.from({ length: 11 }, (_, i) => "image" + i), "ITEM_IMAGE_LIMIT_EXCEEDED"],
    ...["category_id", "item_condition_id", "shipping_day_id", "shipping_service_id", "shipping_place_id"].map(
        (key): [string, unknown, string] => [key, null, "INVALID_NUMBER"],
    ),
    ["attributes", {}, "ITEM_ATTRIBUTES_INVALID"],
    ["attributes", { inventory: null }, "ITEM_ATTRIBUTES_INVALID"],
    ["attributes", { inventory: { initial: 2, current: "1", low_stock_ratio: 0.2 } }, "ITEM_ATTRIBUTES_INVALID"],
    [
        "attributes",
        { inventory: { initial: 2, current: 1, low_stock_ratio: 0.2 }, colorVariants: null },
        "ITEM_ATTRIBUTES_INVALID",
    ],
    ...[-1, 0.5].flatMap(
        (initial): Array<[string, unknown, string]> => [
            ["attributes", { inventory: { initial, current: 1, low_stock_ratio: 0.2 } }, "ITEM_PUBLISH_DATA_INVALID"],
            [
                "attributes",
                {
                    inventory: { initial: 2, current: 1, low_stock_ratio: 0.2 },
                    colorVariants: [{ inventory: { initial, current: 1, low_stock_ratio: 0.2 } }],
                },
                "ITEM_PUBLISH_DATA_INVALID",
            ],
            [
                "attributes",
                {
                    inventory: { initial: 2, current: 1, low_stock_ratio: 0.2 },
                    colorVariants: [{ sizes: [{ inventory: { initial, current: 1, low_stock_ratio: 0.2 } }] }],
                },
                "ITEM_PUBLISH_DATA_INVALID",
            ],
        ],
    ),
    [
        "attributes",
        { inventory: { initial: 2, current: 1, low_stock_ratio: 0.2 }, colorVariants: [{}, { sizes: [{}] }] },
        "ITEM_ATTRIBUTES_INVALID",
    ],
];
describe("D01 E02 E03 保存済み不正値の拒否・元行保持", () => {
    it.each(invalidValues)("D01 E02 E03: %s=%jは%s", async (key, value, code) => {
        const f = await seed();
        await f.editing.update({ [key]: value }, { validate: false });
        const before = await targetSnapshot(f),
            protectedBefore = await nonTargetSnapshot(f);
        await expect(run(f)).rejects.toMatchObject({
            code,
            statusCode: code === "ITEM_ATTRIBUTES_INVALID" ? 500 : 400,
        });
        expect(await targetSnapshot(f)).toEqual(before);
        expect(await nonTargetSnapshot(f)).toEqual(protectedBefore);
        expect(notification).not.toHaveBeenCalled();
    });
    it.each([300, 1000000])("D01 E02: price=%sは更新成功", async (price) => {
        const f = await seed();
        await f.editing.update({ price });
        await run(f);
        expect((await snapshot("item", f.item.id))!.price).toBe(price);
    });
});
