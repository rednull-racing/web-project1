import "../../../../fixtures/items/createItem/databaseSetup.js";
import { QueryTypes } from "sequelize";
import sequelize from "../../../../../src/db.js";
import { describe, expect, it, vi } from "vitest";
import type { Transaction } from "sequelize";
import { seed, run, snapshot, assertProtected, assertPublishedCount, notification, observer, ItemEditing, Item, ids, Follow } from "../../../../fixtures/items/createItem/databaseFixtures.js";
import { boundary, deferred, requiredIdFields, expectedAttributes } from "../../../../fixtures/items/createItem/fixtures.js";
import * as query from "../../../../../src/services/itemEditing/query.js";
import * as followService from "../../../../../src/services/follow/follow.js";
import * as command from "../../../../../src/services/itemEditing/command.js";
import { updateItemEditingConfirmUseCase } from "../../../../../src/usecases/itemEditing/updateConfirm.js";
import { makeBody } from "../../../../fixtures/itemEditing/updateConfirm/fixtures.js";
vi.mock("../../../../../src/usecases/shared/buildSignedUrls.js", () => ({ buildSignedUrls: vi.fn(async () => ({ videoSignedUrl: null, videoUrl: "https://media.test/saved-video", thumbnailSignedUrl: null, thumbnailUrl: "https://media.test/saved-thumbnail", itemImageSignedUrls: [], finalImageUrls: ["https://media.test/saved-image"], attributesImageSignedUrls: {}, finalAttributesImageUrls: {} })) }));
const saveBody = (f: Awaited<ReturnType<typeof seed>>) => {
    const body = makeBody();
    body.itemMeta = { name: "保存後", detail: "保存した説明" };
    body.price = 4567;
    body.videoMeta = { title: "保存後タイトル", summary: "保存後説明" };
    body.category.id = String(f.editing.category_id);
    body.condition.id = String(f.editing.item_condition_id);
    body.shipping = { day: String(f.editing.shipping_day_id), service: String(f.editing.shipping_service_id), place: String(f.editing.shipping_place_id), freeText: "保存後配送" };
    body.brand = { id: String(f.editing.brand_id), name: f.brand.name };
    body.attributes = { allInventory: 12, colorVariants: [], materials: [] };
    return body;
};
const pid = async (t: Transaction) => (await sequelize.query<{
    pid: number;
}>("SELECT pg_backend_pid() AS pid", { transaction: t, type: QueryTypes.SELECT }))[0].pid;
const blocked = async (waiter: number, holder: number) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        const [row] = await observer.query<{
            blocked: boolean;
        }>("SELECT :holder = ANY(pg_blocking_pids(:waiter)) AS blocked", { replacements: { holder, waiter }, type: QueryTypes.SELECT });
        if (row.blocked)
            return;
    }
    throw new Error("pg_blocking_pidsで対象接続間の実待機を確認できない");
};
const observeStart = () => {
    const started = deferred<number>();
    const original = query.getMyItemEditing;
    vi.spyOn(query, "getMyItemEditing").mockImplementation(async (args) => { started.resolve(await pid(args.transaction!)); return original(args); });
    return started;
};
describe("P 実PostgreSQL行ロック・状態再評価", () => {
    it.each([false, true])("P01 P02: A先行でrollback=%s、Bの実待機後に解放", async (rollback) => {
        const f = await seed();
        const aRead = deferred<number>(), bStart = deferred<number>(), release = deferred<void>();
        const realGet = query.getMyItemEditing, realDelete = command.deleteItemEditing;
        let index = 0;
        let aTransaction: Transaction | undefined;
        vi.spyOn(query, "getMyItemEditing").mockImplementation(async (args) => {
            const slot = index++;
            const backend = await pid(args.transaction!);
            if (slot === 1)
                bStart.resolve(backend);
            const row = await realGet(args);
            if (slot === 0) {
                aTransaction = args.transaction;
                aRead.resolve(backend);
                await release.promise;
            }
            return row;
        });
        const failure = new Error("A item作成後のrollback");
        if (rollback)
            vi.spyOn(command, "deleteItemEditing").mockImplementation(async (args) => {
                await realDelete(args);
                if (args.transaction === aTransaction)
                    throw failure;
            });
        const a = run(f).then(id => ({ id }), error => ({ error }));
        let b: Promise<{
            id: number;
        } | {
            error: unknown;
        }> | undefined;
        try {
            const holder = await boundary(aRead.promise, a);
            b = run(f).then(id => ({ id }), error => ({ error }));
            const waiter = await boundary(bStart.promise, b);
            await blocked(waiter, holder);
            expect(notification).not.toHaveBeenCalled();
            release.resolve();
            const [first, second] = await Promise.all([a, b]);
            if (rollback) {
                expect(first).toEqual({ error: failure });
                expect(second).toHaveProperty("id");
            }
            else {
                expect(first).toHaveProperty("id");
                expect(second).toMatchObject({ error: { code: "ITEM_EDITING_NOT_FOUND", statusCode: 404 } });
            }
            expect(await snapshot("item_editing", f.editing.id)).toBeNull();
            expect(notification).toHaveBeenCalledTimes(1);
            const published = await Item.findAll({ where: { id: ids(Item).filter(id => id !== f.existing.id) } });
            expect(published).toHaveLength(1);
            await assertPublishedCount(f, 1);
            await assertProtected(f);
        }
        finally {
            release.resolve();
            await Promise.allSettled([a, ...(b ? [b] : [])]);
        }
    });
    const cases = [
        ...["commit", "rollback"].flatMap(outcome => ["delete", "owner"].map(action => ({ action, outcome, field: "" }))),
        ...requiredIdFields.flatMap(field => ["commit", "rollback"].map(outcome => ({ action: "null-id", outcome, field }))),
    ];
    it.each(cases)("P05 P06 AF-ID03: $action $field $outcome後に再評価", async ({ action, outcome, field }) => {
        const f = await seed();
        const holder = await sequelize.transaction();
        let pending: Promise<{
            id: number;
        } | {
            error: unknown;
        }> | undefined;
        let finished = false;
        try {
            const holderPid = await pid(holder);
            await ItemEditing.findByPk(f.editing.id, { transaction: holder, lock: holder.LOCK.UPDATE });
            if (action === "delete")
                await ItemEditing.destroy({ where: { id: f.editing.id }, transaction: holder });
            else
                await ItemEditing.update(action === "owner" ? { seller_id: f.other.id } : action === "null-id" ? { [field]: null } : { name: "保存後", price: 4567, image_url: ["https://media.test/updated"], first_image_url: "https://media.test/updated", original_url: "https://media.test/updated-video", attributes: { inventory: { initial: 12, current: 1, low_stock_ratio: 0.2 } } }, { where: { id: f.editing.id }, transaction: holder });
            const started = observeStart();
            pending = run(f).then(id => ({ id }), error => ({ error }));
            await blocked(await boundary(started.promise, pending), holderPid);
            if (outcome === "commit")
                await holder.commit();
            else
                await holder.rollback();
            finished = true;
            const result = await pending;
            if (outcome === "commit" && action !== "save") {
                expect(result).toMatchObject({ error: { code: action === "null-id" ? "INVALID_NUMBER" : "ITEM_EDITING_NOT_FOUND", statusCode: action === "null-id" ? 400 : 404 } });
                expect(notification).not.toHaveBeenCalled();
            }
            else {
                expect(result).toHaveProperty("id");
                if ("id" in result) {
                    const item = await snapshot("item", result.id);
                    expect(item!.name).toBe(action === "save" && outcome === "commit" ? "保存後" : f.editing.name);
                    if (action === "save" && outcome === "commit") {
                        expect(item!.price).toBe(4567);
                        expect(item!.image_url).toEqual(["https://media.test/updated"]);
                        expect(item!.attributes).toEqual({ inventory: { initial: 12, current: 12, low_stock_ratio: 0.2 } });
                    }
                }
            }
            await assertProtected(f);
        }
        finally {
            if (!finished)
                await holder.rollback();
            if (pending)
                await pending;
        }
    });
    it("P08: 公開ロック後のDELETEは待機しcommit後0件、公開商品維持", async () => {
        const f = await seed();
        const locked = deferred<number>(), release = deferred<void>();
        const original = query.getMyItemEditing;
        vi.spyOn(query, "getMyItemEditing").mockImplementation(async (args) => { const row = await original(args); locked.resolve(await pid(args.transaction!)); await release.promise; return row; });
        const publishing = run(f);
        const deleting = await sequelize.transaction();
        let pending: Promise<number> | undefined;
        let closed = false;
        try {
            const holder = await boundary(locked.promise, publishing);
            const waiter = await pid(deleting);
            pending = ItemEditing.destroy({ where: { id: f.editing.id }, transaction: deleting });
            await blocked(waiter, holder);
            release.resolve();
            const id = await publishing;
            expect(await pending).toBe(0);
            await deleting.commit();
            closed = true;
            expect(await snapshot("item", id)).not.toBeNull();
            await assertProtected(f);
        }
        finally {
            release.resolve();
            await publishing.catch(() => { });
            if (pending)
                await pending.catch(() => { });
            if (!closed)
                await deleting.rollback();
        }
    });
    it.each([false, true])("P09: 別セッション・別ユーザー=%sの実ロック取得後に両公開を解放", async differentOwner => {
        const f = await seed(); const target = differentOwner ? f.otherEditing : f.ownEditing;
        await target.update({ image_url: ["https://media.test/other-image"], first_image_url: "https://media.test/other-image", attributes: { inventory: { initial: 3, current: 0, low_stock_ratio: 0.7 } } });
        const bothRead = deferred<void>(), release = deferred<void>(); const original = query.getMyItemEditing; let readCount = 0;
        vi.spyOn(query, "getMyItemEditing").mockImplementation(async args => { const row = await original(args); if (++readCount === 2) bothRead.resolve(); await release.promise; return row; });
        const pending = Promise.all([run(f), run(f, target.id, differentOwner ? f.other.id : f.owner.id)]);
        try { await boundary(bothRead.promise, pending); expect(notification).not.toHaveBeenCalled(); }
        finally { release.resolve(); await pending; }
        const results = await pending; expect(new Set(results).size).toBe(2);
        const items = await Promise.all(results.map(id => snapshot("item", id)));
        expect(items.map(row => row!.name)).toEqual([f.editing.name, target.name]);
        expect(items.map(row => row!.seller_id)).toEqual([f.owner.id, differentOwner ? f.other.id : f.owner.id]);
        expect(items[0]!.attributes).toEqual(expectedAttributes()); expect(items[1]!.attributes).toEqual({ inventory: { initial: 3, current: 3, low_stock_ratio: 0.7 } });
        expect(items[1]!.image_url).toEqual(["https://media.test/other-image"]);
        await assertPublishedCount(f, 2);
        expect(notification.mock.calls.map(call => call[0].data).sort((a, b) => a.url.localeCompare(b.url))).toEqual(results.map((id, index) => ({
            read_user_id: index === 0 ? f.owner.id : differentOwner ? f.other.id : f.owner.id, url: `/item/${id}`,
            message_image: index === 0 ? f.editing.first_image_url : target.first_image_url,
            message: `商品「${index === 0 ? f.editing.name : target.name}」を出品いただき誠にありがとうございます。商品の詳細はこちらの商品ページからご確認ください。`, type: "ITEM",
        })).sort((a, b) => a.url.localeCompare(b.url)));
        for (const row of f.protectedRows.filter(row => row.table !== "item_editing" || row.id !== target.id)) expect(await snapshot(row.table, row.id)).toEqual(row.value);
    });
    it("P11: 前提エラー後の正常保存だけがセッションを消費", async () => { const f = await seed(); await f.editing.update({ original_url: null }); await expect(run(f)).rejects.toMatchObject({ code: "VIDEO_URL_NULL" }); expect(await snapshot("item_editing", f.editing.id)).not.toBeNull(); await f.editing.update({ original_url: "https://media.test/repaired" }); expect(await run(f)).toBeTypeOf("number"); expect(notification).toHaveBeenCalledTimes(1); });
});
describe("P 確認画面保存usecaseとの競合・集計時点", () => {
    it.each([false, true])("P03 P04: 実updateConfirmのrollback=%s後のコピー", async (rollback) => {
        const f = await seed();
        const saved = deferred<number>(), release = deferred<void>();
        const real = command.updateItemEditingImage;
        const failure = new Error("save rollback");
        vi.spyOn(command, "updateItemEditingImage").mockImplementationOnce(async (args) => {
            await real(args);
            saved.resolve(await pid(args.transaction!));
            await release.promise;
            if (rollback)
                throw failure;
        });
        const saving = updateItemEditingConfirmUseCase({ itemEditingId: f.editing.id, userId: f.owner.id, body: saveBody(f) }).then(() => ({ ok: true }), error => ({ error }));
        let publishing: Promise<number> | undefined;
        try {
            const holder = await boundary(saved.promise, saving);
            const start = observeStart();
            publishing = run(f);
            await blocked(await boundary(start.promise, publishing), holder);
            release.resolve();
            const result = await saving;
            expect(result).toEqual(rollback ? { error: failure } : { ok: true });
            const id = await publishing;
            const item = await snapshot("item", id);
            expect(item!.name).toBe(rollback ? f.editing.name : "保存後");
            expect(item!.price).toBe(rollback ? f.editing.price : 4567);
            expect(item!.image_url).toEqual(rollback ? f.editing.image_url : ["https://media.test/saved-image"]);
            const video = await snapshot("video", Number(item!.video_id));
            expect(video!.original_url).toBe(rollback ? f.editing.original_url : "https://media.test/saved-video");
            expect(item!.first_image_url).toBe(rollback ? f.editing.first_image_url : "https://media.test/saved-image");
            expect(item!.attributes).toEqual(rollback ? expectedAttributes() : { inventory: { initial: 12, current: 12, low_stock_ratio: 0.2 }, body_category: "top", lifestyle_category: "casual", layer: "middle" });
            expect(video!.title).toBe(rollback ? f.editing.title : "保存後タイトル");
            expect(video!.summary).toBe(rollback ? f.editing.summary : "保存後説明");
            await assertProtected(f);
        }
        finally {
            release.resolve();
            await saving;
            if (publishing)
                await publishing.catch(() => { });
        }
    });
    it("P07: 公開が先行し、実updateConfirmは事前準備後の再取得で待機し404", async () => {
        const f = await seed();
        const locked = deferred<number>(), saveStart = deferred<number>(), release = deferred<void>();
        const real = query.getMyItemEditing;
        let first = true;
        vi.spyOn(query, "getMyItemEditing").mockImplementation(async (args) => {
            if (!args.transaction)
                return real(args);
            if (first) {
                first = false;
                const row = await real(args);
                locked.resolve(await pid(args.transaction));
                await release.promise;
                return row;
            }
            saveStart.resolve(await pid(args.transaction));
            return real(args);
        });
        const publishing = run(f);
        let saving: Promise<unknown> | undefined;
        try {
            const holder = await boundary(locked.promise, publishing);
            saving = updateItemEditingConfirmUseCase({ itemEditingId: f.editing.id, userId: f.owner.id, body: saveBody(f) });
            const rejected = expect(saving).rejects.toMatchObject({ code: "ITEM_EDITING_NOT_FOUND", statusCode: 404 });
            await blocked(await boundary(saveStart.promise, saving), holder);
            release.resolve();
            const id = await publishing;
            await rejected;
            expect((await snapshot("item", id))!.name).toBe(f.editing.name);
            await assertProtected(f);
        }
        finally {
            release.resolve();
            await publishing.catch(() => { });
            if (saving)
                await saving.catch(() => { });
        }
    });
    it("P10: follower読取後にfollowと別商品のcommit、次の出品数だけ最新値", async () => {
        const f = await seed();
        const counted = deferred<void>(), release = deferred<void>();
        const real = followService.countFollower;
        vi.spyOn(followService, "countFollower").mockImplementationOnce(async (args) => { const count = await real(args); counted.resolve(); await release.promise; return count; });
        const publishing = run(f);
        try {
            await boundary(counted.promise, publishing);
            await Follow.create({ follow_user_id: f.other.id, follower_user_id: f.owner.id });
            await Item.create({ seller_id: f.owner.id, status: "active", uploaded_at: new Date() });
            release.resolve();
            const id = await publishing;
            expect(Number((await snapshot("item", id))!.sort_number)).toBe(6265);
            await assertProtected(f);
        }
        finally {
            release.resolve();
            await publishing.catch(() => { });
        }
    });
});
