import { describe, expect, it } from "vitest";
import {
    seed,
    run,
    snapshotAll,
    absentId,
    ItemDraft,
    snapshot,
} from "../../../../fixtures/itemDraft/getItemDraftPage/databaseFixtures.js";
import { AppError } from "../../../../../src/errors.js";

const assertNotFound = async (pending: Promise<unknown>) => {
    await expect(pending).rejects.toBeInstanceOf(AppError);
    await expect(pending).rejects.toMatchObject({ code: "ITEM_DRAFT_NOT_FOUND", statusCode: 404 });
};

describe("getItemDraftPage 実DB取得・所有権・副作用なし", () => {
    it("D01 全取得列・数値ID・親・複数children・関連の公開列と非対象不変", async () => {
        const f = await seed();
        const before = await snapshotAll(f);
        const result = (await run(f)).get({ plain: true });
        // 順序指定のないchildrenは集合として比較する。件数・各要素の完全一致は保持する。
        const { Category, ...rest } = result;
        expect(rest).toEqual({
            id: f.draft.id,
            seller_id: f.owner.id,
            name: "下書きの商品名",
            detail: "下書きの説明",
            price: 800,
            image_url: ["https://media.test/image-a", "https://media.test/image-b", "https://media.test/image-c"],
            first_image_url: "https://media.test/first-independent",
            gender_type: "women",
            age_type: "kids",
            recommend: true,
            attributes: f.values.attributes,
            thumbnail_url: "https://media.test/thumbnail",
            title: "下書きの動画タイトル",
            summary: "下書きの動画概要",
            duration: 30,
            original_url: "https://media.test/original",
            converted_url: "https://media.test/converted",
            before_price: 1200,
            discount_rate: 25,
            discount_amount: 400,
            sale_flag: true,
            shipping_service_free_text: "下書きの配送備考",
            updatedAt: new Date("2020-01-02T00:00:00Z"),
            Brand: { id: f.brand.id, name: f.prefix },
            ItemConditionOption: { id: f.condition.id, name: `${f.prefix}状態` },
            ShippingDayOption: { id: f.day.id, name: `${f.prefix}翌日` },
            ShippingServiceOption: { id: f.service.id, name: `${f.prefix}配送` },
            TodouhukenOption: { id: f.place.id, name: f.prefix.slice(0, 20) },
        });
        expect(Category).toEqual({
            id: f.category.id,
            name: f.prefix,
            parent: { id: f.parent.id, name: `${f.prefix}親` },
            children: expect.arrayContaining([
                {
                    id: f.childA.id,
                    name: `${f.prefix}子A`,
                },
                {
                    id: f.childB.id,
                    name: `${f.prefix}子B`,
                },
            ]),
        });
        expect(Category.children).toHaveLength(2);
        expect(JSON.parse(JSON.stringify(result)).updatedAt).toBe("2020-01-02T00:00:00.000Z");
        expect(await snapshotAll(f)).toEqual(before);
    });

    it("D02 未設定の関連はnull、JSONBと画像の空配列を保持する", async () => {
        const f = await seed();
        await f.sameOwnerDraft.update({ image_url: [], attributes: { colorVariants: [], materials: [] } });
        const before = await snapshotAll(f);
        const result = (await run(f, f.sameOwnerDraft.id)).get({ plain: true });
        expect(result).toMatchObject({
            id: f.sameOwnerDraft.id,
            seller_id: f.owner.id,
            image_url: [],
            attributes: { colorVariants: [], materials: [] },
            Category: null,
            Brand: null,
            ItemConditionOption: null,
            ShippingDayOption: null,
            ShippingServiceOption: null,
            TodouhukenOption: null,
            price: null,
            title: null,
            original_url: null,
            converted_url: null,
        });
        expect(await snapshotAll(f)).toEqual(before);
    });

    it("D03 Categoryの親なしはnull、子なしは空配列", async () => {
        const f = await seed();
        await f.sameOwnerDraft.update({ category_id: f.childA.id });
        await f.childA.update({ parent_id: null });
        const before = await snapshotAll(f);
        const result = (await run(f, f.sameOwnerDraft.id)).get({ plain: true });
        expect(result.Category).toEqual({
            id: f.childA.id,
            name: `${f.prefix}子A`,
            parent: null,
            children: [],
        });
        expect(await snapshotAll(f)).toEqual(before);
    });

    it.each(["他人", "不存在", "所有者null"] as const)("D04 %sは同じ404とDB不変", async (kind) => {
        const f = await seed();
        const id = kind === "他人" ? f.otherDraft.id : kind === "所有者null" ? f.orphan.id : await absentId();
        const before = await snapshotAll(f);
        await assertNotFound(run(f, id));
        expect(await snapshotAll(f)).toEqual(before);
    });

    it("D05 逐次再送は同じ保存値を返してDBを変更しない", async () => {
        const f = await seed();
        const before = await snapshotAll(f);
        const first = (await run(f)).get({ plain: true });
        const second = (await run(f)).get({ plain: true });
        expect(second).toEqual(first);
        expect(await snapshotAll(f)).toEqual(before);
    });

    it("D06 別所有者・別対象を並行取得して結果を混同しない", async () => {
        const f = await seed();
        const before = await snapshotAll(f);
        // 参照の同時実行のみ。ロック待機・更新との直列化を保証するケースではない。
        const results = await Promise.allSettled([run(f), run(f, f.otherDraft.id, f.other.id)]);
        expect(results.every((result) => result.status === "fulfilled")).toBe(true);
        if (results[0].status !== "fulfilled" || results[1].status !== "fulfilled") throw new Error("DB read failed");
        const values = [results[0].value, results[1].value];
        expect(values.map((result) => result.get("id"))).toEqual([f.draft.id, f.otherDraft.id]);
        expect(values.map((result) => result.get("seller_id"))).toEqual([f.owner.id, f.other.id]);
        expect(values.map((result) => result.get("name"))).toEqual(["下書きの商品名", "他人の商品"]);
        expect(await snapshotAll(f)).toEqual(before);
    });

    it("D07 取得後に自作下書きを削除すると次回取得は404", async () => {
        const f = await seed();
        await run(f);
        await ItemDraft.destroy({ where: { id: f.draft.id } });
        const before = await snapshotAll(f);
        await assertNotFound(run(f));
        expect(await snapshot("item_draft", f.draft.id)).toBeNull();
        expect(await snapshotAll(f)).toEqual(before);
    });
});
