import "../../../../fixtures/itemDraft/deleteItemDraft/databaseSetup.js";
import { randomBytes } from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    seed,
    snapshot,
    protectedRows,
    absentId,
    sequelize,
} from "../../../../fixtures/itemDraft/deleteItemDraft/databaseFixtures.js";
import type { DbFixture } from "../../../../fixtures/itemDraft/deleteItemDraft/databaseFixtures.js";
import * as command from "../../../../../src/services/itemDraft/command.js";
import * as query from "../../../../../src/services/itemDraft/query.js";
import * as usecase from "../../../../../src/usecases/itemDraft/deleteItemDraft.js";
import { deferred, waitForGate } from "../../../../fixtures/itemDraft/deleteItemDraft/fixtures.js";
let f: DbFixture, app: ReturnType<typeof express>, secret: string;
const sent = vi.fn();
const remove = (id: number | string = f.draft.id, owner = f.owner.id, admin = false) =>
    request(app)
        .delete(`/api/item-draft/${id}`)
        .set("Authorization", `Bearer ${jwt.sign({ id: owner, admin }, secret, { expiresIn: 3600 })}`);
beforeEach(async () => {
    f = await seed();
    secret = randomBytes(32).toString("hex");
    vi.stubEnv("NEXTAUTH_SECRET", secret);
    sent.mockClear();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const [{ default: router }, { errorHandler }] = await Promise.all([
        import("../../../../../src/routes/itemDraft.js"),
        import("../../../../../src/middleware/errorHandler.js"),
    ]);
    app = express();
    app.use(express.json());
    app.use((_req, res, next) => {
        const json = res.json;
        res.json = (body) => {
            sent(body);
            return json.call(res, body);
        };
        next();
    });
    app.use("/api/item-draft", router);
    app.use(errorHandler);
});
describe("P0/P1: HTTPから実DBへの削除接続", () => {
    it("H01: 実destroy後もcommit前に200を送らず、commit後に削除完了JSON", async () => {
        const before = await protectedRows(f),
            original = await snapshot("item_draft", f.draft.id);
        const gate = deferred<void>(),
            entered = deferred<void>(),
            real = command.deleteItemDraft;
        vi.spyOn(command, "deleteItemDraft").mockImplementationOnce(async (params) => {
            await real(params);
            entered.resolve();
            await gate.promise;
        });
        const pending = remove().then((x) => x);
        try {
            await waitForGate(entered.promise, pending);
            expect(sent).not.toHaveBeenCalled();
            expect(await snapshot("item_draft", f.draft.id)).toEqual(original);
        } finally {
            gate.resolve();
            await pending;
        }
        const result = await pending;
        expect(result.status).toBe(200);
        expect(result.headers["content-type"]).toContain("application/json");
        expect(result.body).toEqual({ message: "下書き商品を削除しました" });
        expect(await snapshot("item_draft", f.draft.id)).toBeNull();
        expect(await protectedRows(f)).toEqual(before);
    });
    it.each(["他人", "不存在", "所有者null", "管理者"])("H02 R12: %sは実認可で404、削除しない", async (mode) => {
        const before = await protectedRows(f),
            original = await snapshot("item_draft", f.draft.id),
            spy = vi.spyOn(command, "deleteItemDraft");
        const id = mode === "不存在" ? await absentId() : mode === "所有者null" ? f.orphan.id : f.draft.id;
        const owner = mode === "他人" ? f.other.id : mode === "管理者" ? f.admin.id : f.owner.id;
        const result = await remove(id, owner, mode === "管理者");
        expect(result.status).toBe(404);
        expect(result.body).toEqual({ code: "ITEM_DRAFT_NOT_FOUND", message: "ITEM_DRAFT_NOT_FOUND" });
        expect(spy).not.toHaveBeenCalled();
        expect(await snapshot("item_draft", f.draft.id)).toEqual(original);
        expect(await protectedRows(f)).toEqual(before);
    });
    it.each(["無認証", "不正id", "制限超過"])("H03: %sではusecaseとDBに到達しない", async (mode) => {
        if (mode === "制限超過") for (let i = 0; i < 20; i++) expect((await remove("bad")).status).toBe(400);
        const uc = vi.spyOn(usecase, "deleteItemDraftUseCase"),
            transaction = vi.spyOn(sequelize, "transaction"),
            get = vi.spyOn(query, "getMyItemDraft"),
            destroy = vi.spyOn(command, "deleteItemDraft");
        const req =
            mode === "無認証"
                ? request(app).delete(`/api/item-draft/${f.draft.id}`)
                : remove(mode === "不正id" ? "bad" : f.draft.id);
        expect((await req).status).toBe(mode === "無認証" ? 401 : mode === "不正id" ? 400 : 429);
        for (const spy of [uc, transaction, get, destroy]) expect(spy).not.toHaveBeenCalled();
    });
    it("H04: 実destroy後の障害は500で行を全列rollback", async () => {
        const original = await snapshot("item_draft", f.draft.id),
            before = await protectedRows(f),
            real = command.deleteItemDraft;
        vi.spyOn(command, "deleteItemDraft").mockImplementationOnce(async (params) => {
            await real(params);
            throw new Error("実削除後失敗");
        });
        const result = await remove();
        expect(result.status).toBe(500);
        expect(result.body).toEqual({ error: "INTERNAL_SERVER_ERROR", message: "サーバーエラーが発生しました" });
        expect(await snapshot("item_draft", f.draft.id)).toEqual(original);
        expect(await protectedRows(f)).toEqual(before);
    });
});
