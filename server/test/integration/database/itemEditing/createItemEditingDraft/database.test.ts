import "../../../../fixtures/itemEditing/createItemEditingDraft/databaseSetup.js";
import { randomBytes } from "node:crypto";
import express from "express";
import type { ErrorRequestHandler } from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../../../src/errors.js";
import {
    seed,
    run,
    snapshot,
    savedEditings,
    protectedRows,
    expectCopied,
    replaceDraft,
    expectUnchanged,
} from "../../../../fixtures/itemEditing/createItemEditingDraft/databaseFixtures.js";
import type { DbFixture } from "../../../../fixtures/itemEditing/createItemEditingDraft/databaseFixtures.js";
import {
    copyVariants,
    expectAppError,
    makeBody,
} from "../../../../../src/usecases/itemEditing/test/createItemEditingDraft.fixtures.js";

let f: DbFixture;
beforeEach(async () => {
    f = await seed();
});
describe("P0/P1: 実DBのコピー・削除・所有権・再実行", () => {
    it("N01 N02 N09 ST01 ST06: 全項目をコピーして元下書きだけを削除し新規行IDを返す", async () => {
        const original = (await snapshot("item_draft", f.draft.id))!;
        const protectedBefore = await protectedRows(f),
            before = Date.now();
        const id = await run(f),
            after = Date.now();
        const saved = await snapshot("item_editing", id);
        expectCopied(saved, original, f.owner.id);
        expect(saved!.id).toBe(id);
        for (const column of ["createdAt", "updatedAt"]) {
            expect(saved![column]).toBeInstanceOf(Date);
            const time = (saved![column] as Date).getTime();
            expect(time).toBeGreaterThanOrEqual(before);
            expect(time).toBeLessThanOrEqual(after);
            expect(saved![column]).not.toEqual(original[column]);
        }
        expect(await snapshot("item_draft", f.draft.id)).toBeNull();
        expect(await savedEditings(f)).toEqual([saved]);
        expect(await protectedRows(f)).toEqual(protectedBefore);
    });
    it.each(copyVariants)("$id: $nameがDB再取得でも完全に維持される", async ({ values }) => {
        await replaceDraft(f, values);
        const original = (await snapshot("item_draft", f.draft.id))!;
        const id = await run(f);
        expectCopied(await snapshot("item_editing", id), original, f.owner.id);
        expect(await snapshot("item_draft", f.draft.id)).toBeNull();
        expect(await savedEditings(f)).toHaveLength(1);
    });
    it.each([
        { item_id: null },
        { brand_id: null, brand_aliases_id: null },
        { brand_id: null },
        { brand_aliases_id: null },
    ])("N08: nullable参照%jを保存し参照先を変更しない", async (values) => {
        await replaceDraft(f, values);
        const original = (await snapshot("item_draft", f.draft.id))!,
            protectedBefore = await protectedRows(f);
        expectCopied(await snapshot("item_editing", await run(f)), original, f.owner.id);
        expect(await protectedRows(f)).toEqual(protectedBefore);
    });
    it("E01: 不存在IDは404で既存データを変更しない", async () => {
        const original = (await snapshot("item_draft", f.draft.id))!,
            protectedBefore = await protectedRows(f);
        // 削除した当ケースの採番IDで、共有データの不存在を仮定しない。
        await f.sameOwnerDraft.destroy();
        const afterDelete = await protectedRows(f);
        expect(afterDelete[0]).toBeNull();
        await expectAppError(run(f, f.sameOwnerDraft.id));
        expect(await snapshot("item_draft", f.draft.id)).toEqual(original);
        expect(await savedEditings(f)).toEqual([]);
        expect(await protectedRows(f)).toEqual(afterDelete);
        expect(protectedBefore.slice(1)).toEqual(afterDelete.slice(1));
    });
    it("E02 ST03 ST06: 他人所有の下書きを404で拒否し全列を保持する", async () => {
        const original = (await snapshot("item_draft", f.draft.id))!,
            protectedBefore = await protectedRows(f);
        await expectAppError(run(f, f.draft.id, f.other.id));
        await expectUnchanged(f, original, protectedBefore);
    });
    it("ST04: 成功後の同じ入力は404、追加生成も成功行の変更もない", async () => {
        const id = await run(f),
            saved = await snapshot("item_editing", id);
        await expectAppError(run(f));
        expect(await savedEditings(f)).toEqual([saved]);
        expect(await snapshot("item_draft", f.draft.id)).toBeNull();
    });
});

describe("P0: HTTP入口で拒否した場合の実DB不変", () => {
    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });
    it.each(["未認証", "入力不正", "制限超過"] as const)(
        "ST03 AF-R05: %sではtransactionを始めず実DBを保持する",
        async (mode) => {
            const original = (await snapshot("item_draft", f.draft.id))!,
                protectedBefore = await protectedRows(f);
            vi.spyOn(console, "log").mockImplementation(() => {});
            vi.spyOn(console, "error").mockImplementation(() => {});
            vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
            const secret = randomBytes(32).toString("hex");
            vi.stubEnv("NEXTAUTH_SECRET", secret);
            const { default: router } = await import("../../../../../src/routes/itemEditing.js");
            const { createItemEditingDraftRateLimit } =
                await import("../../../../../src/middleware/rateLimit/itemEditingRateLimit.js");
            createItemEditingDraftRateLimit.resetKey(`admin:${f.owner.id}`);
            const app = express();
            app.use(express.json());
            app.use("/api/item-editing", router);
            const observe: ErrorRequestHandler = (error, _req, res, _next) => {
                void _req;
                void _next;
                if (error instanceof AppError) res.status(error.statusCode).json({ code: error.code });
                else res.status(500).json({ code: "TEST_UNEXPECTED_ERROR" });
            };
            expect(observe.length).toBe(4);
            app.use(observe);
            const token = jwt.sign({ id: f.owner.id }, secret, { expiresIn: 3600 });
            const send = (valid: boolean, authenticated = true) => {
                const req = request(app).post("/api/item-editing/draft");
                if (authenticated) req.set("Authorization", `Bearer ${token}`);
                return req.send(valid ? makeBody(f.draft.id) : {});
            };
            const { sequelize } =
                await import("../../../../fixtures/itemEditing/createItemEditingDraft/databaseFixtures.js");
            const transaction = vi.spyOn(sequelize, "transaction");
            if (mode === "制限超過") for (let i = 0; i < 5; i++) expect((await send(false)).status).toBe(400);
            const result = await send(mode !== "入力不正", mode !== "未認証");
            expect(result.status).toBe(mode === "未認証" ? 401 : mode === "入力不正" ? 400 : 429);
            expect(transaction).not.toHaveBeenCalled();
            await expectUnchanged(f, original, protectedBefore);
            createItemEditingDraftRateLimit.resetKey(`admin:${f.owner.id}`);
        },
    );
});
