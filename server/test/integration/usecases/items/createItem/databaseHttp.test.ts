import "../../../../fixtures/items/createItem/databaseSetup.js";
import sequelize from "../../../../../src/db.js";
import "../../../../fixtures/items/createItem/httpMocks.js";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    seed,
    snapshot,
    assertRolledBack,
    assertProtected,
    assertPublishedRelations,
    notification,
    Item,
} from "../../../../fixtures/items/createItem/databaseFixtures.js";
import {
    boundary,
    deferred,
    requiredIdFields,
    nullableBrandCases,
} from "../../../../fixtures/items/createItem/fixtures.js";
import * as command from "../../../../../src/services/itemEditing/command.js";
import { makeHttpApp, post } from "../../../../fixtures/items/createItem/httpFixtures.js";
let secret: string, app: Awaited<ReturnType<typeof makeHttpApp>>;
beforeEach(async () => {
    secret = randomBytes(32).toString("hex");
    vi.stubEnv("NEXTAUTH_SECRET", secret);
    app = await makeHttpApp();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
});
describe("D/R 実usecase・HTTP・DB", () => {
    it.each(["name", "title"])("B06 D09: %sの空文字はHTTP400で公開せず元行保持", async (field) => {
        const f = await seed();
        await f.editing.update({ [field]: "" });
        const before = await snapshot("item_editing", f.editing.id);
        const result = await post(app, secret, { itemEditingId: f.editing.id }, f.owner.id);
        expect(result.status).toBe(400);
        expect(result.body).toEqual({
            code: "ITEM_PUBLISH_DATA_INVALID",
            message: "商品情報を確認して、もう一度保存してください。",
        });
        await assertRolledBack(f, before);
    });
    it.each(["success", "missing", "url", "attributes", "insert", "notification"])(
        "D09: %sのHTTPと保存結果",
        async (mode) => {
            const f = await seed();
            if (mode === "url") await f.editing.update({ original_url: null });
            if (mode === "attributes") await f.editing.update({ attributes: { colorVariants: null } });
            const before = await snapshot("item_editing", f.editing.id);
            if (mode === "insert") vi.spyOn(Item, "create").mockRejectedValueOnce(new Error("private SQL"));
            if (mode === "notification") notification.mockRejectedValueOnce(new Error("notify"));
            const result = await post(
                app,
                secret,
                { itemEditingId: mode === "missing" ? 2147483647 : f.editing.id },
                f.owner.id,
            );
            const status = { success: 201, missing: 404, url: 400, attributes: 500, insert: 500, notification: 201 }[
                mode
            ];
            expect(result.status).toBe(status);
            if (status === 201) {
                expect(Object.keys(result.body)).toEqual(["itemId"]);
                await assertPublishedRelations(result.body.itemId);
                expect(await snapshot("item_editing", f.editing.id)).toBeNull();
                await assertProtected(f);
            } else {
                expect(result.body).not.toHaveProperty("itemId");
                expect(JSON.stringify(result.body)).not.toContain("private SQL");
                await assertRolledBack(f, before);
            }
        },
    );
    it.each(["401", "429", "INVALID_BODY", "INVALID_JSON"])("D10: %sは公開transaction未開始", async (mode) => {
        const f = await seed();
        const before = await snapshot("item_editing", f.editing.id);
        if (mode === "429")
            for (let i = 0; i < 5; i++) expect((await post(app, secret, {}, f.owner.id)).status).toBe(400);
        const spy = vi.spyOn(sequelize, "transaction");
        spy.mockClear();
        const result =
            mode === "401"
                ? await request(app).post("/api/items").send({ itemEditingId: f.editing.id })
                : mode === "INVALID_JSON"
                  ? await request(app)
                        .post("/api/items")
                        .set("Content-Type", "application/json")
                        .send('{"itemEditingId":')
                  : await post(app, secret, mode === "INVALID_BODY" ? {} : { itemEditingId: f.editing.id }, f.owner.id);
        expect(result.status).toBe(mode === "401" ? 401 : mode === "429" ? 429 : 400);
        expect(spy).not.toHaveBeenCalled();
        await assertRolledBack(f, before);
    });
    it("D06 R09: 実404の5回も制限を消費", async () => {
        const f = await seed();
        for (let i = 0; i < 5; i++) {
            const r = await post(app, secret, { itemEditingId: 2147483647 }, f.owner.id);
            expect(r.status).toBe(404);
            expect(r.body).toEqual({ code: "ITEM_EDITING_NOT_FOUND", message: "ITEM_EDITING_NOT_FOUND" });
        }
        expect((await post(app, secret, { itemEditingId: f.editing.id }, f.owner.id)).status).toBe(429);
    });
    it.each(requiredIdFields)("AF-ID01 AF-ID02: HTTPで%s=nullを拒否、修復後だけ公開", async (field) => {
        const f = await seed();
        const original = f.editing[field];
        await f.editing.update({ [field]: null });
        const before = await snapshot("item_editing", f.editing.id);
        expect((await post(app, secret, { itemEditingId: f.editing.id }, f.owner.id)).status).toBe(400);
        await assertRolledBack(f, before);
        await f.editing.update({ [field]: original });
        expect((await post(app, secret, { itemEditingId: f.editing.id }, f.owner.id)).status).toBe(201);
    });
});

it.each(nullableBrandCases)("AF-BR02: HTTPは保存済みブランドID %jをnullのまま公開", async (patch) => {
    const f = await seed();
    await f.editing.update(patch);
    const result = await post(app, secret, { itemEditingId: f.editing.id }, f.owner.id);
    expect(result.status).toBe(201);
    const item = await snapshot("item", result.body.itemId);
    expect(item).toMatchObject({ brand_id: f.editing.brand_id, brand_aliases_id: f.editing.brand_aliases_id });
    expect(await snapshot("item_editing", f.editing.id)).toBeNull();
    await assertProtected(f);
});

it.each([false, true])("D02 D09: 削除後rollback=%sの確定までHTTPは応答しない", async (rollback) => {
    const f = await seed();
    const before = await snapshot("item_editing", f.editing.id);
    const entered = deferred<void>(),
        release = deferred<void>();
    const original = command.deleteItemEditing;
    vi.spyOn(command, "deleteItemEditing").mockImplementationOnce(async (args) => {
        await original(args);
        entered.resolve();
        await release.promise;
        if (rollback) throw new Error("HTTP rollback injection");
    });
    let responded = false;
    const pending = post(app, secret, { itemEditingId: f.editing.id }, f.owner.id).then((result) => {
        responded = true;
        return result;
    });
    try {
        await boundary(entered.promise, pending);
        expect(responded).toBe(false);
        expect(await snapshot("item_editing", f.editing.id)).toEqual(before);
    } finally {
        release.resolve();
        await pending;
    }
    const result = await pending;
    expect(result.status).toBe(rollback ? 500 : 201);
    if (rollback) {
        expect(result.body).toEqual({ error: "INTERNAL_SERVER_ERROR", message: "サーバーエラーが発生しました" });
        await assertRolledBack(f, before);
    } else {
        await assertPublishedRelations(result.body.itemId);
        expect(await snapshot("item_editing", f.editing.id)).toBeNull();
    }
});
