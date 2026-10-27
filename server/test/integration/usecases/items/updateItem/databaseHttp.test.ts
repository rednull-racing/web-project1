import "../../../../fixtures/items/updateItem/databaseSetup.js";
import "../../../../fixtures/items/updateItem/httpMocks.js";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    seed,
    snapshot,
    targetSnapshot,
    nonTargetSnapshot,
    notification,
    ItemEditing,
    Item,
} from "../../../../fixtures/items/updateItem/databaseFixtures.js";
import { makeHttpApp, makeToken, put } from "../../../../fixtures/items/updateItem/httpFixtures.js";
import * as command from "../../../../../src/services/itemEditing/command.js";
import { deferred, boundary } from "../../../../fixtures/items/updateItem/concurrencyFixtures.js";
import { updateItemRateLimit } from "../../../../../src/middleware/rateLimit/itemsRateLimit.js";
let secret: string;
let app: Awaited<ReturnType<typeof makeHttpApp>>;
beforeEach(async () => {
    secret = randomBytes(32).toString("hex");
    vi.stubEnv("NEXTAUTH_SECRET", secret);
    vi.spyOn(console, "error").mockImplementation(() => {});
    app = await makeHttpApp();
});
afterEach(() => {
    vi.restoreAllMocks();
});
const send = (itemEditingId: number, userId: number, extra: object = {}) =>
    put(app, secret, { itemEditingId, ...extra }, userId);

describe("D01 HTTPから実DBへ認証・認可・commit/rollbackを接続", () => {
    it("D01 H01: 所有者偽装を除去しcommit後に201・同じitemIdを返す", async () => {
        const f = await seed(),
            protectedBefore = await nonTargetSnapshot(f);
        const r = await send(f.editing.id, f.owner.id, {
            userId: f.other.id,
            seller_id: f.other.id,
            itemId: f.otherItem.id,
        });
        expect(r.status).toBe(201);
        expect(r.body).toEqual({ itemId: f.item.id });
        expect((await snapshot("item", f.item.id))!.name).toBe("新商品Ａ");
        expect(await snapshot("item_editing", f.editing.id)).toBeNull();
        expect(await nonTargetSnapshot(f)).toEqual(protectedBefore);
        expect(notification).toHaveBeenCalledTimes(1);
        const again = await send(f.editing.id, f.owner.id);
        expect(again.status).toBe(404);
        expect(again.body.code).toBe("ITEM_EDITING_NOT_FOUND");
        expect(notification).toHaveBeenCalledTimes(1);
    });
    it.each([
        "session-owner",
        "item-owner",
        "normal",
        "null-item",
        "empty-name",
        "empty-title",
        "root-inventory",
    ] as const)("D01 H01: %sを拒否し元行と4行を保持", async (mode) => {
        const f = await seed();
        if (mode === "session-owner") await f.editing.update({ seller_id: f.other.id });
        if (mode === "item-owner") await f.item.update({ seller_id: f.other.id });
        if (mode === "normal") await f.editing.update({ status: "normal" });
        if (mode === "null-item") await f.editing.update({ item_id: null });
        if (mode === "empty-name") await f.editing.update({ name: "" });
        if (mode === "empty-title") await f.editing.update({ title: "" });
        if (mode === "root-inventory") await f.editing.update({ attributes: {} });
        const before = await targetSnapshot(f),
            protectedBefore = await nonTargetSnapshot(f);
        const r = await send(f.editing.id, f.owner.id);
        const code =
            mode === "session-owner"
                ? "ITEM_EDITING_NOT_FOUND"
                : mode === "item-owner"
                  ? "ITEM_NOT_FOUND"
                  : mode === "normal" || mode === "null-item"
                    ? "ITEM_EDITING_STATE_INVALID"
                    : mode === "root-inventory"
                      ? "ITEM_ATTRIBUTES_INVALID"
                      : "ITEM_PUBLISH_DATA_INVALID";
        expect(r.status).toBe(mode.endsWith("owner") ? 404 : mode === "root-inventory" ? 500 : 400);
        expect(r.body.code).toBe(code);
        expect(await targetSnapshot(f)).toEqual(before);
        expect(await nonTargetSnapshot(f)).toEqual(protectedBefore);
        expect(notification).not.toHaveBeenCalled();
    });
    it.each(["no-auth", "invalid-body", "invalid-json"] as const)("D01 H02: %sで実DBへ進まない", async (mode) => {
        const f = await seed(),
            before = await targetSnapshot(f);
        const r =
            mode === "no-auth"
                ? await request(app).put("/api/items").send({ itemEditingId: f.editing.id })
                : mode === "invalid-body"
                  ? await put(app, secret, { itemEditingId: String(f.editing.id) }, f.owner.id)
                  : await request(app)
                        .put("/api/items")
                        .set("Authorization", "Bearer " + makeToken(secret, f.owner.id))
                        .set("Content-Type", "application/json")
                        .send('{"itemEditingId":');
        expect(r.status).toBe(mode === "no-auth" ? 401 : 400);
        expect(await targetSnapshot(f)).toEqual(before);
        expect(notification).not.toHaveBeenCalled();
    });
    it("D02 H01: 削除SQL後の例外でrollbackして500、修復再試行201", async () => {
        const f = await seed(),
            before = await targetSnapshot(f);
        const real = command.deleteItemEditing;
        vi.spyOn(command, "deleteItemEditing").mockImplementationOnce(async (args) => {
            await real(args);
            throw new Error("private injected SQL");
        });
        const failed = await send(f.editing.id, f.owner.id);
        expect(failed.status).toBe(500);
        expect(failed.body).toEqual({ error: "INTERNAL_SERVER_ERROR", message: "サーバーエラーが発生しました" });
        expect(await targetSnapshot(f)).toEqual(before);
        expect(notification).not.toHaveBeenCalled();
        expect((await send(f.editing.id, f.owner.id)).status).toBe(201);
    });
    it("D01 P02: commit前はHTTP成功応答も通知もなく、別接続では旧値", async () => {
        const f = await seed(),
            before = await targetSnapshot(f);
        const deleted = deferred<void>(),
            release = deferred<void>();
        const real = command.deleteItemEditing;
        vi.spyOn(command, "deleteItemEditing").mockImplementationOnce(async (args) => {
            await real(args);
            deleted.resolve();
            await release.promise;
        });
        let responseFinished = false;
        const pending = send(f.editing.id, f.owner.id).then((r) => {
            responseFinished = true;
            return r;
        });
        try {
            await boundary(deleted.promise, pending);
            expect(responseFinished).toBe(false);
            expect(await targetSnapshot(f)).toEqual(before);
            expect(notification).not.toHaveBeenCalled();
        } finally {
            release.resolve();
            await pending;
        }
        expect((await pending).status).toBe(201);
        expect(await snapshot("item_editing", f.editing.id)).toBeNull();
    });
    it("D01 H02: 5回の業務失敗を消費し6回目429でも全行不変", async () => {
        const f = await seed();
        await f.editing.update({ status: "normal" });
        const before = await targetSnapshot(f);
        // ユーザーIDはテストごとに新規採番されるためlimiterの共有storeと衝突しない。
        updateItemRateLimit.resetKey(`admin:${f.owner.id}`);
        for (let i = 0; i < 5; i++) expect((await send(f.editing.id, f.owner.id)).status).toBe(400);
        expect((await send(f.editing.id, f.owner.id)).status).toBe(429);
        expect(await targetSnapshot(f)).toEqual(before);
        expect(notification).not.toHaveBeenCalled();
        expect(await ItemEditing.findByPk(f.editing.id)).not.toBeNull();
        expect(await Item.findByPk(f.item.id)).not.toBeNull();
    });
});
