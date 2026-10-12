import "./databaseSetup.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForeignKeyConstraintError, QueryTypes } from "sequelize";
import type { Transaction } from "sequelize";
import {
    seed, run, draftRows, onlyDraft, editingSnapshot, aliasRows, newMedia,
    observer, sequelize, Item, BrandAliases,
} from "./databaseFixtures.js";
import type { DbFixture } from "./databaseFixtures.js";
import type { CreateItemDraftBody } from "../../../../src/validators/body/itemDraft.js";
import { deferred } from "./fixtures.js";
import * as query from "../../../../src/services/itemEditing/query.js";
import * as command from "../../../../src/services/itemDraft/command.js";
import * as aliases from "../../../../src/services/brandAliases.js";
import * as brandResolver from "../../../../src/usecases/shared/resolveBrand.js";

let f: DbFixture;
beforeEach(async () => { f = await seed(); });

// 異常終了も待合せへ伝え、通知されないgateを永遠に待たない。
const reach = (signal: Promise<void>, operations: readonly Promise<unknown>[]) => Promise.race([
    signal,
    ...operations.map(operation => operation.then(() => { throw new Error("待合せへ到達する前に処理が終了しました"); })),
]);
const gateReads = () => {
    const entered = [deferred<void>(), deferred<void>()];
    const release = [deferred<void>(), deferred<void>()];
    const real = query.getMyItemEditing;
    let index = 0;
    vi.spyOn(query, "getMyItemEditing").mockImplementation(async params => {
        const i = index++;
        const row = await real(params);
        if (i > 1) throw new Error("想定外の再取得です");
        expect(params.transaction).toBeUndefined();
        entered[i].resolve();
        await release[i].promise;
        return row;
    });
    return { entered, release };
};
const inputs = () => {
    const a = structuredClone(f.body), b = structuredClone(f.body);
    a.itemMeta.name = "下書きA"; a.price = 1000; a.attributes.allInventory = 4;
    b.itemMeta.name = "下書きB"; b.price = 2000; b.attributes.allInventory = 8;
    newMedia(a); newMedia(b);
    return { a, b };
};
const prepareOther = () => f.otherEditing.update({
    original_url: "https://media.test/other-video", thumbnail_url: "https://media.test/other-thumbnail",
    image_url: ["https://media.test/other-image"], attributes: f.editing.attributes,
});
const assertSaved = (
    row: Record<string, unknown>, body: CreateItemDraftBody,
    result: Awaited<ReturnType<typeof run>>, userId: number, editingId: number,
) => {
    expect(row).toMatchObject({
        name: body.itemMeta.name, price: body.price, before_price: body.price, seller_id: null, item_id: null,
        attributes: { inventory: { initial: body.attributes.allInventory, current: body.attributes.allInventory, low_stock_ratio: 0.2 } },
        original_url: `https://media.test/${result.videoSignedUrl!.fields.key}`,
        thumbnail_url: result.thumbnailSignedUrl!.replace("signed.test", "media.test"),
        image_url: result.itemImageSignedUrls.map(image => image.url.replace("signed.test", "media.test")),
    });
    expect(result.videoSignedUrl!.fields.key).toContain(`video/original/${userId}/${editingId}_`);
    expect(row.first_image_url).toBe((row.image_url as string[])[0]);
};

// Bの接続PIDを指定して実ロック待ちを観測する。sleepによる推測はしない。
const waitForAliasLock = async (pid: number) => {
    for (let attempt = 0; attempt < 100; attempt++) {
        const [state] = await observer.query<{ waiting: boolean }>(
            `SELECT EXISTS (
                SELECT 1 FROM pg_stat_activity
                WHERE datname = current_database() AND wait_event_type = 'Lock'
                  AND wait_event = 'advisory'
                  AND query LIKE '%pg_advisory_xact_lock%'
                  AND pid = :pid
            ) AS waiting`,
            { replacements: { pid }, type: QueryTypes.SELECT },
        );
        if (state.waiting) return;
    }
    throw new Error("Bのブランド別名ロック待ちを確認できませんでした");
};
const transactionPid = async (t: Transaction) => {
    const [row] = await sequelize.query<{ pid: number; isolation: string }>(
        "SELECT pg_backend_pid() AS pid, current_setting('transaction_isolation') AS isolation",
        { transaction: t, type: QueryTypes.SELECT },
    );
    expect(row.isolation, "ロック後の再検索はREAD COMMITTEDを前提にする").toBe("read committed");
    return row.pid;
};

describe("P2: 下書き作成の並行処理", () => {
    it.each(["A→B", "B→A"])("P01: 同じ取得行から%sでcommitしても別下書き2行", async order => {
        const before = await editingSnapshot(f.editing.id), gate = gateReads(), { a, b } = inputs();
        const pa = run(f, a), pb = run(f, b), settled = Promise.allSettled([pa, pb]);
        const first = order === "A→B" ? 0 : 1, operations = [pa, pb];
        try {
            await reach(Promise.all(gate.entered.map(g => g.promise)).then(() => {}), operations);
            expect(await draftRows()).toEqual([]);
            gate.release[first].resolve(); await operations[first];
            expect(await draftRows()).toHaveLength(1);
            gate.release[1 - first].resolve(); await operations[1 - first];
            const rows = await draftRows(); expect(rows).toHaveLength(2);
            expect(rows[0].id).not.toBe(rows[1].id);
            assertSaved(rows.find(row => row.name === a.itemMeta.name)!, a, await pa, f.owner.id, f.editing.id);
            assertSaved(rows.find(row => row.name === b.itemMeta.name)!, b, await pb, f.owner.id, f.editing.id);
            expect(await editingSnapshot(f.editing.id)).toEqual(before);
        } finally { gate.release.forEach(g => g.resolve()); await settled; }
    });

    it("P02 O02: 別ユーザー・別商品を交差させても入力と署名が混ざらない", async () => {
        await prepareOther(); const before = await editingSnapshot(f.editing.id), other = await editingSnapshot(f.otherEditing.id);
        const { a, b } = inputs(), real = command.updateItemDraftImage;
        const both = deferred<void>(), release = deferred<void>(), transactions = new Set<Transaction | undefined>();
        vi.spyOn(command, "updateItemDraftImage").mockImplementation(async params => {
            transactions.add(params.transaction);
            if (transactions.size === 2) both.resolve();
            await release.promise; return real(params);
        });
        const pa = run(f, a), pb = run(f, b, f.otherEditing.id, f.other.id), settled = Promise.allSettled([pa, pb]);
        try {
            await reach(both.promise, [pa, pb]); expect(transactions.size).toBe(2);
            expect(transactions.has(undefined)).toBe(false); expect(await draftRows()).toEqual([]);
            release.resolve(); const [ra, rb] = await Promise.all([pa, pb]); const rows = await draftRows();
            expect(rows).toHaveLength(2);
            assertSaved(rows.find(row => row.name === a.itemMeta.name)!, a, ra, f.owner.id, f.editing.id);
            assertSaved(rows.find(row => row.name === b.itemMeta.name)!, b, rb, f.other.id, f.otherEditing.id);
            expect(await editingSnapshot(f.editing.id)).toEqual(before); expect(await editingSnapshot(f.otherEditing.id)).toEqual(other);
        } finally { release.resolve(); await settled; }
    });

    it("P03: Aの本体INSERT後rollbackとBのcommitを独立して扱う", async () => {
        const { a, b } = inputs(), real = command.updateItemDraftImage;
        const entered = deferred<void>(), release = deferred<void>(), error = new Error("Aの画像保存失敗");
        vi.spyOn(command, "updateItemDraftImage").mockImplementation(async params => {
            if (params.itemDraft.name === a.itemMeta.name) { entered.resolve(); await release.promise; throw error; }
            return real(params);
        });
        const pa = run(f, a), failure = expect(pa).rejects.toBe(error);
        let pb: ReturnType<typeof run> | undefined;
        try {
            await reach(entered.promise, [pa]); pb = run(f, b); const resultB = await pb;
            const committed = await onlyDraft(); assertSaved(committed, b, resultB, f.owner.id, f.editing.id);
            release.resolve(); await failure; expect(await onlyDraft()).toEqual(committed);
        } finally { release.resolve(); await Promise.allSettled(pb ? [pa, pb] : [pa]); await failure; }
    });

    it.each([false, true])("P04 P05: Aのrollback=%s、Bは実ロック待ち後に再検索", async rollback => {
        await prepareOther(); const { a, b } = inputs(), name = `${f.prefix}shared`;
        a.brand = { id: null, name }; b.brand = { id: null, name };
        const reads = [deferred<void>(), deferred<void>()], releases = [deferred<void>(), deferred<void>()];
        const realRead = aliases.getAliasOne, realCreate = aliases.createAliases, realImage = command.updateItemDraftImage;
        let readCount = 0, createCount = 0, bCompleted = false;
        const holding = deferred<void>(), finishA = deferred<void>(), bLockRequested = deferred<void>();
        let bPid = 0;
        const error = new Error("Aだけrollback");
        vi.spyOn(aliases, "getAliasOne").mockImplementation(async params => {
            const i = readCount++, alias = await realRead(params);
            expect(alias).toBeNull(); reads[i].resolve(); await releases[i].promise; return alias;
        });
        vi.spyOn(aliases, "createAliases").mockImplementation(async params => {
            const i = createCount++;
            if (!params.transaction) throw new Error("transactionがありません");
            const pid = await transactionPid(params.transaction);
            const pending = realCreate(params);
            if (i === 1) { bPid = pid; bLockRequested.resolve(); }
            const result = await pending;
            if (i === 1) bCompleted = true;
            return result;
        });
        vi.spyOn(command, "updateItemDraftImage").mockImplementation(async params => {
            if (params.itemDraft.name === a.itemMeta.name) {
                holding.resolve(); await finishA.promise; if (rollback) throw error;
            }
            return realImage(params);
        });
        const pa = run(f, a);
        const settledA = Promise.allSettled([pa]);
        let pb: ReturnType<typeof run> | undefined;
        let settledB: ReturnType<typeof Promise.allSettled> | undefined;
        const failure = rollback ? expect(pa).rejects.toBe(error) : undefined;
        try {
            await reach(reads[0].promise, [pa]);
            pb = run(f, b, f.otherEditing.id, f.other.id);
            settledB = Promise.allSettled([pb]);
            await reach(reads[1].promise, [pa, pb]);
            releases[0].resolve(); await reach(holding.promise, [pa, pb]);
            releases[1].resolve(); await reach(bLockRequested.promise, [pa, pb]);
            await waitForAliasLock(bPid);
            expect(bCompleted).toBe(false); expect(await aliasRows(name)).toEqual([]); expect(await draftRows()).toEqual([]);
            finishA.resolve(); if (failure) await failure; else await pa; await pb;
            const aliasesAfter = await aliasRows(name), rows = await draftRows(); expect(aliasesAfter).toHaveLength(1);
            expect(rows).toHaveLength(rollback ? 1 : 2);
            for (const row of rows) expect(row.brand_aliases_id).toBe(aliasesAfter[0].id);
            if (rollback) expect(rows[0].name).toBe(b.itemMeta.name);
            else expect(rows.map(row => row.name).sort()).toEqual([a.itemMeta.name, b.itemMeta.name].sort());
        } finally {
            releases.forEach(g => g.resolve()); finishA.resolve(); await settledA; await settledB; if (failure) await failure;
        }
    });

    it("P06: 異なる正規化名ならAがロック保持中でもBをcommitできる", async () => {
        const { a, b } = inputs(), nameA = `${f.prefix}one`, nameB = `${f.prefix}two`;
        a.brand = { id: null, name: nameA }; b.brand = { id: null, name: nameB };
        const [hashes] = await observer.query<{ a: number; b: number }>("SELECT hashtext(:a) AS a, hashtext(:b) AS b", {
            replacements: { a: nameA, b: nameB }, type: QueryTypes.SELECT,
        });
        expect(hashes.a).not.toBe(hashes.b);
        const realAliasCreate = aliases.createAliases;
        vi.spyOn(aliases, "createAliases").mockImplementation(async params => {
            if (params.normalized === nameB && params.transaction) {
                // 不具合でBが同じロックを待つ場合も、Aを解放するfinallyへ戻す。
                await sequelize.query("SET LOCAL lock_timeout = '2000ms'", { transaction: params.transaction });
            }
            return realAliasCreate(params);
        });
        const real = command.updateItemDraftImage, holding = deferred<void>(), release = deferred<void>();
        vi.spyOn(command, "updateItemDraftImage").mockImplementation(async params => {
            if (params.itemDraft.name === a.itemMeta.name) { holding.resolve(); await release.promise; }
            return real(params);
        });
        const pa = run(f, a); let pb: ReturnType<typeof run> | undefined;
        try {
            await reach(holding.promise, [pa]); pb = run(f, b); await pb;
            expect(await aliasRows(nameA)).toEqual([]); expect(await aliasRows(nameB)).toHaveLength(1);
            expect((await onlyDraft()).name).toBe(b.itemMeta.name);
            release.resolve(); await pa; expect(await draftRows()).toHaveLength(2); expect(await aliasRows(nameA)).toHaveLength(1);
        } finally { release.resolve(); await Promise.allSettled(pb ? [pa, pb] : [pa]); }
    });
});

describe("P2: 参照元・ブランドの変更との競合を観測", () => {
    it("P07 O04: 取得後のメディア変更を保存してもAは取得済みsnapshotを再利用", async () => {
        const real = query.getMyItemEditing, entered = deferred<void>(), release = deferred<void>();
        vi.spyOn(query, "getMyItemEditing").mockImplementationOnce(async params => {
            const row = await real(params); entered.resolve(); await release.promise; return row;
        });
        const pending = run(f); let changed: Record<string, unknown> | null = null;
        try {
            await reach(entered.promise, [pending]);
            await observer.query(`UPDATE item_editing SET original_url = :video, thumbnail_url = :thumbnail,
                image_url = ARRAY[:image]::text[], attributes = CAST(:attributes AS jsonb) WHERE id = :id`, {
                replacements: { id: f.editing.id, video: "new-video", thumbnail: "new-thumbnail", image: "new-image",
                    attributes: JSON.stringify({ colorVariants: [{ uiId: "red", image_url: "new-red" }] }) },
            });
            changed = await editingSnapshot(f.editing.id); release.resolve(); await pending;
            expect(await onlyDraft()).toMatchObject({ original_url: "https://media.test/old-video", thumbnail_url: "https://media.test/old-thumbnail",
                image_url: ["https://media.test/old-image0"], attributes: { colorVariants: [{ image_url: "https://media.test/red" }] } });
            expect(await editingSnapshot(f.editing.id)).toEqual(changed);
        } finally { release.resolve(); await Promise.allSettled([pending]); }
    });

    it.each(["所有者変更", "削除"])("P08 O03: 初回取得後の%sを再確認せず下書き作成を継続", async mode => {
        const real = query.getMyItemEditing, entered = deferred<void>(), release = deferred<void>();
        const reads = vi.spyOn(query, "getMyItemEditing").mockImplementationOnce(async params => {
            const row = await real(params); entered.resolve(); await release.promise; return row;
        });
        const other = await editingSnapshot(f.otherEditing.id), published = f.item.toJSON();
        const pending = run(f);
        try {
            await reach(entered.promise, [pending]);
            if (mode === "削除") await observer.query("DELETE FROM item_editing WHERE id = :id", { replacements: { id: f.editing.id } });
            else await observer.query("UPDATE item_editing SET seller_id = :owner WHERE id = :id", { replacements: { id: f.editing.id, owner: f.other.id } });
            const changed = await editingSnapshot(f.editing.id); release.resolve(); await pending;
            expect(await onlyDraft()).toMatchObject({ name: f.body.itemMeta.name, seller_id: null, item_id: null });
            expect(reads).toHaveBeenCalledExactlyOnceWith({ itemEditingId: f.editing.id, userId: f.owner.id });
            expect(await editingSnapshot(f.editing.id)).toEqual(changed);
            if (mode === "削除") expect(changed).toBeNull(); else expect(changed!.seller_id).toBe(f.other.id);
            expect(await editingSnapshot(f.otherEditing.id)).toEqual(other); expect((await Item.findByPk(f.item.id))!.toJSON()).toEqual(published);
        } finally { release.resolve(); await Promise.allSettled([pending]); }
    });

    it.each(["brand", "alias"])("P09: 採用%sが解決後に削除されるとFK失敗で作成なし", async target => {
        let id = f.brand.id;
        if (target === "alias") {
            const name = `${f.prefix}reference`; const alias = await BrandAliases.create({ name, name_normalized: name, brand_id: null });
            id = alias.id; f.body.brand = { id: null, name };
        }
        const real = brandResolver.resolveBrand, entered = deferred<void>(), release = deferred<void>();
        vi.spyOn(brandResolver, "resolveBrand").mockImplementationOnce(async params => {
            const result = await real(params); entered.resolve(); await release.promise; return result;
        });
        const images = vi.spyOn(command, "updateItemDraftImage"), pending = run(f);
        const failure = expect(pending).rejects.toBeInstanceOf(ForeignKeyConstraintError);
        try {
            await reach(entered.promise, [pending]);
            await observer.query(`DELETE FROM ${target === "brand" ? "brands" : "brand_aliases"} WHERE id = :id`, { replacements: { id } });
            release.resolve(); await failure; expect(images).not.toHaveBeenCalled(); expect(await draftRows()).toEqual([]);
        } finally { release.resolve(); await Promise.allSettled([pending]); await failure; }
    });
});
