import "./databaseSetup.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryTypes } from "sequelize";
import { seed, run, snapshot, newMedia, observer, sequelize, ItemEditing, BrandAliases } from "./databaseFixtures.js";
import type { DbFixture } from "./databaseFixtures.js";
import { deferred } from "./fixtures.js";
import * as query from "../../../../src/services/itemEditing/query.js";
import * as command from "../../../../src/services/itemEditing/command.js";
import * as aliases from "../../../../src/services/brandAliases.js";

let f: DbFixture;
beforeEach(async () => { f = await seed(); });

// 各呼出しの実SELECT完了を通知してから解放する。spyは実DB結果を変更しない。
const gateReads = () => {
    const entered = [deferred<void>(), deferred<void>()];
    const release = [deferred<void>(), deferred<void>()];
    const real = query.getMyItemEditing;
    let index = 0;
    vi.spyOn(query, "getMyItemEditing").mockImplementation(async (params) => {
        const i = index++;
        const row = await real(params);
        entered[i].resolve();
        await release[i].promise;
        return row;
    });
    return { entered, release };
};

describe("P2 実DB並行処理・観測", () => {
    it("P01 O05: 同じ旧行を取得後A→Bでcommitし後の変更が保存される", async () => {
        const gate = gateReads();
        const a = structuredClone(f.body);
        const b = structuredClone(f.body);
        a.itemMeta.name = "更新A"; a.price = 1000; newMedia(a);
        b.itemMeta.name = "更新B"; b.price = 2000; newMedia(b);
        const pa = run(f, a);
        const pb = run(f, b);
        const settled = Promise.allSettled([pa, pb]);
        try {
            await Promise.race([Promise.all(gate.entered.map((g) => g.promise)), ...[pa, pb].map((pending) => pending.then(() => { throw new Error("取得待合せ前に終了"); }))]);
            gate.release[0].resolve();
            await pa;
            expect(await snapshot(f.editing.id)).toMatchObject({ name: "更新A", price: 1000 });
            gate.release[1].resolve();
            const resultB = await pb;
            expect(await snapshot(f.editing.id)).toMatchObject({ name: "更新B", price: 2000,
                image_url: resultB.itemImageSignedUrls.map((image) => image.url.replace("signed.test", "media.test")) });
        } finally {
            gate.release.forEach((g) => g.resolve());
            await settled;
        }
    });

    it("P02 O05: staleインスタンスの変更検知でAの名称とBの価格が混在する観測", async () => {
        const sql: string[] = [];
        sequelize.addHook("beforeQuery", "captureSql", (_options, query) => {
            query.options.logging = (statement) => { sql.push(statement); };
        });
        const gate = gateReads();
        const a = structuredClone(f.body);
        const b = structuredClone(f.body);
        a.itemMeta.name = "Aだけ変更"; a.price = f.editing.price!;
        b.itemMeta.name = f.editing.name!; b.price = 2000;
        const pa = run(f, a);
        const pb = run(f, b);
        const settled = Promise.allSettled([pa, pb]);
        try {
            await Promise.race([Promise.all(gate.entered.map((g) => g.promise)), ...[pa, pb].map((pending) => pending.then(() => { throw new Error("取得待合せ前に終了"); }))]);
            gate.release[0].resolve(); await pa;
            gate.release[1].resolve(); await pb;
            expect(await snapshot(f.editing.id)).toMatchObject({ name: "Aだけ変更", price: 2000 });
            const writes = sql.filter((line) => line.includes('UPDATE "item_editing"'));
            expect(writes).toHaveLength(4);
            expect(writes[0]).toContain('"name"=');
            expect(writes[2]).not.toContain('"name"=');
            expect(writes[2]).toContain('"price"=');
        } finally {
            gate.release.forEach((g) => g.resolve());
            await settled;
            sequelize.removeHook("beforeQuery", "captureSql");
        }
    });

    it("P03: 別ユーザーの商品を別transactionで同時更新し値が混ざらない", async () => {
        await f.otherEditing.update({ original_url: "https://media.test/other-video", thumbnail_url: "https://media.test/other-thumbnail", image_url: ["https://media.test/other-image"] });
        const a = structuredClone(f.body);
        const b = structuredClone(f.body);
        a.itemMeta.name = "A商品"; newMedia(a);
        b.itemMeta.name = "B商品"; b.price = 2000; b.attributes.allInventory = 8; newMedia(b);
        const entered = deferred<void>();
        const release = deferred<void>();
        const real = command.updateItemEditingImage;
        const transactions = new Set<unknown>();
        vi.spyOn(command, "updateItemEditingImage").mockImplementation(async (params) => {
            transactions.add(params.transaction);
            if (transactions.size === 2) entered.resolve();
            await release.promise;
            return real(params);
        });
        const pending = Promise.all([run(f, a), run(f, b, f.otherEditing.id, f.other.id)]);
        try {
            await Promise.race([entered.promise, pending.then(() => { throw new Error("両transactionに到達せず終了"); })]);
            expect(transactions.size).toBe(2);
        } finally { release.resolve(); await pending; }
        const [ra, rb] = await pending;
        expect(await snapshot(f.editing.id)).toMatchObject({ seller_id: f.owner.id, name: "A商品", price: 300,
            image_url: ra.itemImageSignedUrls.map((image) => image.url.replace("signed.test", "media.test")) });
        expect(await snapshot(f.otherEditing.id)).toMatchObject({ seller_id: f.other.id, name: "B商品", price: 2000,
            attributes: { inventory: { initial: 8, current: 8, low_stock_ratio: 0.2 } },
            image_url: rb.itemImageSignedUrls.map((image) => image.url.replace("signed.test", "media.test")) });
    });

    it("P04: A commit後に同じ旧行のBが画像失敗してもAを取り消さない", async () => {
        const gate = gateReads();
        const a = structuredClone(f.body); a.itemMeta.name = "成功A"; newMedia(a);
        const b = structuredClone(f.body); b.itemMeta.name = "失敗B"; b.price = 2000; newMedia(b);
        const real = command.updateItemEditingImage;
        const error = new Error("Bの画像失敗");
        vi.spyOn(command, "updateItemEditingImage").mockImplementation(async (params) => {
            if (params.itemEditing.name === "失敗B") throw error;
            return real(params);
        });
        const pa = run(f, a);
        const pb = run(f, b);
        const failure = expect(pb).rejects.toBe(error);
        const settled = Promise.allSettled([pa, pb]);
        try {
            await Promise.race([Promise.all(gate.entered.map((g) => g.promise)), ...[pa, pb].map((pending) => pending.then(() => { throw new Error("取得待合せ前に終了"); }))]);
            gate.release[0].resolve(); await pa;
            const committed = await snapshot(f.editing.id);
            gate.release[1].resolve(); await failure;
            expect(await snapshot(f.editing.id)).toEqual(committed);
        } finally {
            gate.release.forEach((g) => g.resolve());
            await settled;
            await failure;
        }
    });

    it("P05 O02: 同名aliasの両検索が未登録なら別transactionで2行作成される観測", async () => {
        f.body.brand = { id: null, name: `${f.prefix}race` };
        const real = aliases.getAliasOne;
        const entered = deferred<void>();
        const release = deferred<void>();
        let calls = 0;
        vi.spyOn(aliases, "getAliasOne").mockImplementation(async (params) => {
            const result = await real(params);
            expect(result).toBeNull();
            if (++calls === 2) entered.resolve();
            await release.promise;
            return result;
        });
        const pending = Promise.all([run(f), run(f)]);
        try {
            await Promise.race([entered.promise, pending.then(() => { throw new Error("両検索に到達せず終了"); })]);
        } finally { release.resolve(); await pending; }
        const rows = await BrandAliases.findAll({ where: { name_normalized: f.body.brand.name } });
        expect(rows).toHaveLength(2);
        expect(rows.map((row) => row.id)).toContain((await ItemEditing.findByPk(f.editing.id))!.brand_aliases_id);
    });

    it.each(["削除", "所有者変更"])("P08 O05: 所有権確認後の%sで再認可せず更新する現状をSQLと最終行で観測", async (mode) => {
        const sql: string[] = [];
        sequelize.addHook("beforeQuery", "captureSql", (_options, query) => {
            query.options.logging = (statement) => { sql.push(statement); };
        });
        const real = query.getMyItemEditing;
        vi.spyOn(query, "getMyItemEditing").mockImplementationOnce(async (params) => {
            const row = await real(params);
            expect(row).not.toBeNull();
            if (mode === "削除") await observer.query('DELETE FROM item_editing WHERE id = :id', { replacements: { id: f.editing.id }, type: QueryTypes.DELETE });
            else await observer.query('UPDATE item_editing SET seller_id = :owner WHERE id = :id', { replacements: { id: f.editing.id, owner: f.other.id }, type: QueryTypes.UPDATE });
            return row;
        });
        try {
            await expect(run(f)).resolves.toEqual({ videoSignedUrl: null, thumbnailSignedUrl: null, itemImageSignedUrls: [], attributesImageSignedUrls: {} });
            if (mode === "削除") expect(await snapshot(f.editing.id)).toBeNull();
            else expect(await snapshot(f.editing.id)).toMatchObject({ seller_id: f.other.id, name: "商品名", price: 300 });
            const writes = sql.filter((line) => line.includes('UPDATE "item_editing"'));
            expect(writes).toHaveLength(2);
            for (const write of writes) {
                expect(write.split(" WHERE ")[1]).toMatch(/^"id" = /);
                expect(write.split(" WHERE ")[1]).not.toContain("seller_id");
            }
        } finally { sequelize.removeHook("beforeQuery", "captureSql"); }
    });
});
