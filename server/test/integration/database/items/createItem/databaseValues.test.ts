import { QueryTypes } from "sequelize";
import { makeAttributes, expectedAttributes } from "../../../../fixtures/items/createItem/fixtures.js";
import { describe, expect, it } from "vitest";
import { seed, run, snapshot, assertProtected, assertRolledBack, observer, Item, User, Follow, Brands, BrandAliases } from "../../../../fixtures/items/createItem/databaseFixtures.js";
import type { Fixture } from "../../../../fixtures/items/createItem/databaseFixtures.js";

const createdItem = async (f: Fixture) => {
    const row = await snapshot("item", await run(f));
    expect(row).not.toBeNull();
    await assertProtected(f);
    return row!;
};
const rejectSaved = async (f: Fixture, attributes: unknown, code = "ITEM_ATTRIBUTES_INVALID", statusCode = 500) => {
    // JSON nullとSQL NULLを区別し、Model validationを迂回してJSONB保存済み値を用意する。
    await observer.query("UPDATE item_editing SET attributes=CAST(:value AS jsonb) WHERE id=:id", {
        replacements: { id: f.editing.id, value: JSON.stringify(attributes) },
    });
    const before = await snapshot("item_editing", f.editing.id);
    await expect(run(f)).rejects.toMatchObject({ code, statusCode });
    await assertRolledBack(f, before);
};
const levels = ["product", "color", "size"] as const;
const atLevel = (level: typeof levels[number], inventory: unknown) => level === "product"
    ? { inventory }
    : level === "color" ? { colorVariants: [{ uiId: "color", inventory }] }
        : { colorVariants: [{ uiId: "color", sizes: [{ size: "M", inventory }] }] };

describe("D N/B 任意値・境界・公開前提の永続化", () => {
    it.each([
        { field: "detail", table: "item", saved: "detail", reduction: 4 },
        { field: "recommend", table: "item", saved: "recommend", reduction: 0 },
        { field: "summary", table: "video", saved: "summary", reduction: 3 },
        { field: "duration", table: "video", saved: "duration", reduction: 0 },
        { field: "converted_url", table: "video", saved: "converted_url", reduction: 0 },
        { field: "video_status", table: "video", saved: "status", reduction: 0 },
        { field: "shipping_service_free_text", table: "item_shipping_profile", saved: "shipping_service_free_text", reduction: 0 },
    ])("N04 D01: $field=nullを保存し計算上の長さだけ0にする", async ({ field, table, saved, reduction }) => {
        const f = await seed();
        await f.editing.update({ [field]: null });
        const item = await createdItem(f);
        const target = table === "item" ? item : await snapshot(table, Number(item[table === "video" ? "video_id" : "shipping_id"]));
        expect(target![saved]).toBeNull();
        expect(Number(item.sort_number)).toBe(6255 - reduction);
        expect(Number(item.sort_buzz_number)).toBe(6255 - reduction);
    });
    it.each([
        { field: "gender_type", value: "men" }, { field: "gender_type", value: "women" }, { field: "gender_type", value: "unisex" },
        { field: "age_type", value: "adult" }, { field: "age_type", value: "kids" }, { field: "age_type", value: "both" },
        { field: "recommend", value: true }, { field: "recommend", value: false },
    ])("N05 D01: $field=$valueを保存", async ({ field, value }) => {
        const f = await seed(); await f.editing.update({ [field]: value });
        expect((await createdItem(f))[field]).toBe(value);
    });
    it.each([null, 15000])("N03: before_price=%sを保持し割引解除", async value => {
        const f = await seed(); await f.editing.update({ before_price: value, sale_flag: false, discount_amount: null, discount_rate: null });
        const item = await createdItem(f);
        expect(await snapshot("sale", Number(item.sale_id))).toMatchObject({ before_price: value, sale_flag: false, discount_amount: null, discount_rate: null });
    });
    it.each([300, 1000000])("B05: price=%sは受理", async price => {
        const f = await seed(); await f.editing.update({ price }); expect((await createdItem(f)).price).toBe(price);
    });
    it.each([
        { patch: { original_url: "" }, code: "VIDEO_URL_NULL" }, { patch: { thumbnail_url: null }, code: "THUMBNAIL_URL_NULL" },
        { patch: { price: null }, code: "ITEM_PUBLISH_DATA_INVALID" }, { patch: { price: 1000001 }, code: "ITEM_PUBLISH_DATA_INVALID" },
        { patch: { name: null }, code: "ITEM_PUBLISH_DATA_INVALID" }, { patch: { first_image_url: "" }, code: "ITEM_PUBLISH_DATA_INVALID" },
    ])("B02 B03 B05 B06 B07: $patchで$code・rollback", async ({ patch, code }) => {
        const f = await seed(); await f.editing.update(patch); const before = await snapshot("item_editing", f.editing.id);
        await expect(run(f)).rejects.toMatchObject({ code, statusCode: 400 }); await assertRolledBack(f, before);
    });
    it.each([1, 10, 11])("B04: 保存済み画像%s枚の境界", async count => {
        const f = await seed(); const images = Array.from({ length: count }, (_, i) => `https://media.test/${i}`);
        // 11枚はModel配列validatorでは作れないため、自作行の保存値だけをSQLで変更する。
        await observer.query("UPDATE item_editing SET image_url=ARRAY[:images]::text[] WHERE id=:id", { replacements: { images, id: f.editing.id } });
        if (count <= 10) expect((await createdItem(f)).image_url).toEqual(images);
        else { const before = await snapshot("item_editing", f.editing.id); await expect(run(f)).rejects.toMatchObject({ code: "ITEM_IMAGE_LIMIT_EXCEEDED", statusCode: 400 }); await assertRolledBack(f, before); }
    });
    it("N09: 半角濁点・親なし・ユーザー名nullの検索文字列", async () => {
        const f = await seed(); await f.editing.update({ name: " ＴＥＳＴ ｶﾞ ", title: " Ａ カ " });
        await f.category.update({ name: " ｼｬﾂ \t\n　", parent_id: null }); await f.owner.update({ user_name: null });
        expect((await createdItem(f)).search_text).toBe("testがaかしゃつ");
    });
    it.each([0, 1, 3].flatMap(followers => [0, 1, 2].map(extraItems => ({ followers, extraItems }))))("N07 D05: follower=$followers 追加出品=$extraItemsで作成前集計", async ({ followers, extraItems }) => {
        const f = await seed();
        for (let index = 0; index < followers; index++) {
            const user = await User.create({ email: `ci-follower-${f.owner.id}-${index}@example.test`, password: "unused" });
            await Follow.create({ follow_user_id: user.id, follower_user_id: f.owner.id });
        }
        for (let index = 0; index < extraItems; index++) await Item.create({ seller_id: f.owner.id, status: index % 2 ? "soldout" : "active", uploaded_at: new Date() });
        const item = await createdItem(f); expect(Number(item.sort_number)).toBe(6255 + followers * 10 + extraItems * 10);
    });
});

describe("D I JSONB在庫構造・値域・非破壊", () => {
    it.each(levels.flatMap(level => [0, 1, 9].flatMap(initial => [0, 1, 12].map(current => ({ level, initial, current })))))("I02: $level initial=$initial current=$current", async ({ level, initial, current }) => {
        const f = await seed(); const input = atLevel(level, { initial, current, low_stock_ratio: 0.2 });
        await f.editing.update({ attributes: input }); const item = await createdItem(f);
        expect(item.attributes).toEqual(atLevel(level, { initial, current: initial, low_stock_ratio: 0.2 }));
    });
    it.each([
        { input: {}, expected: {} }, { input: { colorVariants: [] }, expected: { colorVariants: [] } },
        { input: { colorVariants: [{}] }, expected: { colorVariants: [{}] } }, { input: { colorVariants: [{ sizes: [] }] }, expected: { colorVariants: [{ sizes: [] }] } },
        { input: { colorVariants: [{ sizes: [{ inventory: { initial: 2, current: 0, low_stock_ratio: 0.2 } }] }] }, expected: { colorVariants: [{ sizes: [{ inventory: { initial: 2, current: 2, low_stock_ratio: 0.2 } }] }] } },
        { input: { colorVariants: [{ inventory: { initial: 3, current: 0, low_stock_ratio: 0.3 } }] }, expected: { colorVariants: [{ inventory: { initial: 3, current: 3, low_stock_ratio: 0.3 } }] } },
    ])("I03: 許容欠落$inputを補完しない", async ({ input, expected }) => { const f = await seed(); await f.editing.update({ attributes: input }); expect((await createdItem(f)).attributes).toEqual(expected); });
    it.each([null, [], 1, "bad", true])("I05: JSONBの根%jは500", async value => { await rejectSaved(await seed(), value); });
    it.each([null, "bad", {}, 1].flatMap(value => [{ colorVariants: value }, { colorVariants: [{ sizes: value }] }]))("I06: 階層%jは500", async value => { await rejectSaved(await seed(), value); });
    it.each([null, [], 1, "bad", true].flatMap(value => [{ colorVariants: [{}, value] }, { colorVariants: [{ sizes: [{ inventory: { initial: 1, current: 0, low_stock_ratio: 0.2 } }, value] }] }]))("I07: 後方要素%jは500", async value => { await rejectSaved(await seed(), value); });
    it.each(levels.flatMap(level => [null, [], 1, "bad", true].map(value => ({ level, value }))))("I08: $level inventory=$valueは500", async ({ level, value }) => { await rejectSaved(await seed(), atLevel(level, value)); });
    it.each(levels.flatMap(level => ["initial", "current", "low_stock_ratio"].flatMap(key => ["missing", null, "1", true].map(value => ({ level, key, value })))))("I09: $level.$key=$valueは500", async ({ level, key, value }) => {
        const inventory: Record<string, unknown> = { initial: 1, current: 0, low_stock_ratio: 0.2 };
        if (value === "missing") delete inventory[key]; else inventory[key] = value;
        await rejectSaved(await seed(), atLevel(level, inventory));
    });
    it.each(levels.flatMap(level => [-1, 0.5].map(initial => ({ level, initial }))))("I10: $level initial=$initialは400", async ({ level, initial }) => { await rejectSaved(await seed(), atLevel(level, { initial, current: 0, low_stock_ratio: 0.2 }), "ITEM_PUBLISH_DATA_INVALID", 400); });
    it("I11: 負数initialより後方サイズinventory欠落の構造不正が先", async () => { await rejectSaved(await seed(), { inventory: { initial: -1, current: 0, low_stock_ratio: 0.2 }, colorVariants: [{ sizes: [{}] }] }); });
});

describe("D O 観測した保存値・未確定の業務条件", () => {
    it.each(["name", "title"].flatMap(field => ["", "   "].map(value => ({ field, value }))))("O01: $field=$valueを受理する観測", async ({ field, value }) => {
        const f = await seed(); await f.editing.update({ [field]: value }); const item = await createdItem(f);
        const target = field === "name" ? item : await snapshot("video", Number(item.video_id)); expect(target![field]).toBe(value);
    });
    it.each([{ original_url: " ", thumbnail_url: " " }, { first_image_url: "https://media.test/different", image_url: ["", "duplicate", "duplicate"] }])("O01: URL・画像%jを補正しない観測", async patch => {
        const f = await seed(); await f.editing.update(patch); const item = await createdItem(f);
        if (patch.image_url) expect(item.image_url).toEqual(patch.image_url);
        else expect(await snapshot("video", Number(item.video_id))).toMatchObject({ original_url: " ", thumbnail_url: " " });
    });
    it.each(levels.flatMap(level => [-1, 0.5].flatMap(current => [-0.2, 1.2].map(ratio => ({ level, current, ratio })))))("O02: $level current=$current ratio=$ratioを初期化・保持する観測", async ({ level, current, ratio }) => {
        const f = await seed(); await f.editing.update({ attributes: atLevel(level, { initial: 1, current, low_stock_ratio: ratio }) });
        expect((await createdItem(f)).attributes).toEqual(atLevel(level, { initial: 1, current: 1, low_stock_ratio: ratio }));
    });
    it("O03: 変換未完了とbrand/aliasの対応不一致も既存FKとして受理する観測", async () => {
        const f = await seed(); const brand = await Brands.create({ name: `other-${f.owner.id}`, name_normalized: `other-${f.owner.id}` });
        const alias = await BrandAliases.create({ brand_id: brand.id, name: `alias-${f.owner.id}`, name_normalized: `alias-${f.owner.id}` });
        await f.editing.update({ brand_aliases_id: alias.id, converted_url: null, video_status: null }); const item = await createdItem(f);
        expect(item).toMatchObject({ brand_id: f.editing.brand_id, brand_aliases_id: alias.id });
        expect(await snapshot("video", Number(item.video_id))).toMatchObject({ converted_url: null, status: null });
    });
});

it("I12: JSONBの逆順・重複uiId・非在庫の追加値を維持", async () => {
    const f = await seed(); const input = makeAttributes(); const expected = expectedAttributes();
    input.colorVariants.reverse(); expected.colorVariants.reverse();
    input.colorVariants[0].uiId = "red"; expected.colorVariants[0].uiId = "red";
    await f.editing.update({ attributes: input }); expect((await createdItem(f)).attributes).toEqual(expected);
});
it("D01 D08: 実DBのJSONB・配列・整数・DECIMALと関連FK方向を照合", async () => {
    const columns = await observer.query<{ column_name: string; udt_name: string }>(
        "SELECT column_name, udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='item' AND column_name IN ('id','attributes','image_url','report_score','video_id','sale_id','shipping_id') ORDER BY column_name", { type: QueryTypes.SELECT },
    );
    expect(columns).toEqual([
        { column_name: "attributes", udt_name: "jsonb" }, { column_name: "id", udt_name: "int4" }, { column_name: "image_url", udt_name: "_text" },
        { column_name: "report_score", udt_name: "numeric" }, { column_name: "sale_id", udt_name: "int4" }, { column_name: "shipping_id", udt_name: "int4" }, { column_name: "video_id", udt_name: "int4" },
    ]);
    const foreignKeys = await observer.query<{ name: string; target: string; on_delete: string; on_update: string }>(
        "SELECT a.attname AS name, target.relname AS target, con.confdeltype AS on_delete, con.confupdtype AS on_update FROM pg_constraint con JOIN pg_class source ON source.oid=con.conrelid JOIN pg_namespace ns ON ns.oid=source.relnamespace JOIN pg_class target ON target.oid=con.confrelid JOIN pg_attribute a ON a.attrelid=source.oid AND a.attnum=ANY(con.conkey) WHERE ns.nspname='public' AND source.relname='item' AND con.contype='f' AND a.attname IN ('video_id','sale_id','shipping_id') ORDER BY a.attname", { type: QueryTypes.SELECT },
    );
    expect(foreignKeys).toEqual([
        { name: "sale_id", target: "sale", on_delete: "n", on_update: "a" },
        { name: "shipping_id", target: "item_shipping_profile", on_delete: "n", on_update: "a" },
        { name: "video_id", target: "video", on_delete: "n", on_update: "a" },
    ]);
});
