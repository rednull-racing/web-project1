import "../../../../fixtures/itemEditing/createItemEditingCopy/databaseSetup.js";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    seed,
    sequelize,
    editingIds,
    protectedSnapshot,
    expectedCopy,
    expectCopy,
    ItemEditing,
} from "../../../../fixtures/itemEditing/createItemEditingCopy/databaseFixtures.js";
import type { DbFixture } from "../../../../fixtures/itemEditing/createItemEditingCopy/databaseFixtures.js";
import { makeHttpApp, postCopy } from "../../../../fixtures/itemEditing/createItemEditingCopy/httpFixtures.js";

// 対象copyは実処理。他エンドポイントの初期化だけを切り離す。
vi.mock("../../../../../src/usecases/itemEditing/convertItemEditingVideo.js", () => ({
    convertItemEditingVideoUseCase: vi.fn(),
}));
vi.mock("../../../../../src/usecases/itemEditing/createItemEditing.js", () => ({ createItemEditingUseCase: vi.fn() }));
vi.mock("../../../../../src/usecases/itemEditing/createItemEditingDraft.js", () => ({
    createItemEditingDraftUseCase: vi.fn(),
}));
vi.mock("../../../../../src/usecases/itemEditing/updateConfirm.js", () => ({
    updateItemEditingConfirmUseCase: vi.fn(),
}));

let f: DbFixture;
let app: Awaited<ReturnType<typeof makeHttpApp>>;
let secret: string;
beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T00:00:00Z"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    secret = randomBytes(32).toString("hex");
    vi.stubEnv("NEXTAUTH_SECRET", secret);
    f = await seed();
    app = await makeHttpApp();
    const { createItemEditingCopyRateLimit } =
        await import("../../../../../src/middleware/rateLimit/itemEditingRateLimit.js");
    await createItemEditingCopyRateLimit.resetKey("admin:" + f.owner.id);
});
afterEach(() => {
    vi.useRealTimers();
    // DB suite全体のenvはdatabaseFixturesの接続終了後に復元する。
});
const post = (body: object = { itemId: f.item.id }) => postCopy(app, secret, body, f.owner.id);

describe("P0 statusクエリの永続化", () => {
    it.each(["normal", "edit"] as const)("QSTATUS06: %sを保存しコピー元と既存行を保持する", async (status) => {
        const before = await protectedSnapshot(f);
        const result = await postCopy(
            app,
            secret,
            { itemId: f.item.id, status: "soldout" },
            f.owner.id,
            "?status=" + status,
        );
        expect(result.status).toBe(201);
        await expectCopy(result.body.itemEditingId, {
            ...expectedCopy(f),
            status,
            item_id: status === "edit" ? f.item.id : null,
        });
        expect(await protectedSnapshot(f)).toEqual(before);
    });
    it.each([{}, { itemId: null }])("EDIT-ID01: editでもbody=%jは400でDBを開始しない", async (body) => {
        const before = await protectedSnapshot(f),
            ids = await editingIds(f);
        const transaction = vi.spyOn(sequelize, "transaction");
        const result = await postCopy(app, secret, body, f.owner.id, "?status=edit");
        expect(result.status).toBe(400);
        expect(result.body).toEqual({ code: "INVALID_BODY", message: "INVALID_BODY" });
        expect(transaction).not.toHaveBeenCalled();
        expect(await editingIds(f)).toEqual(ids);
        expect(await protectedSnapshot(f)).toEqual(before);
    });
    it("QSTATUS07: query欠落は400でDBを開始せず既存データを保持する", async () => {
        const before = await protectedSnapshot(f),
            ids = await editingIds(f);
        const transaction = vi.spyOn(sequelize, "transaction");
        const result = await postCopy(app, secret, { itemId: f.item.id, status: "normal" }, f.owner.id, "");
        expect(result.status).toBe(400);
        expect(result.body.code).toBe("INVALID_QUERY");
        expect(transaction).not.toHaveBeenCalled();
        expect(await editingIds(f)).toEqual(ids);
        expect(await protectedSnapshot(f)).toEqual(before);
    });
});

describe("P1/P2 実HTTPと実usecase・DBの接続", () => {
    it.each([401, 400, 404])("D07: %sで停止して新規行・既存データを変更しない", async (status) => {
        const before = await protectedSnapshot(f),
            ids = await editingIds(f);
        const transaction = vi.spyOn(sequelize, "transaction");
        const result =
            status === 401
                ? await request(app).post("/api/item-editing/copy").send({ itemId: f.item.id })
                : await post(status === 400 ? {} : { itemId: f.otherItem.id });
        expect(result.status).toBe(status);
        expect(transaction).toHaveBeenCalledTimes(status === 404 ? 1 : 0);
        expect(await editingIds(f)).toEqual(ids);
        expect(await protectedSnapshot(f)).toEqual(before);
    });
    it("D07 Q05: 5回成功で異なる編集行を作り6回目はDB未開始、窓更新後は追加できる", async () => {
        const before = await protectedSnapshot(f),
            initial = await editingIds(f);
        const copied: number[] = [];
        for (let i = 0; i < 5; i++) {
            const response = await post();
            expect(response.status).toBe(201);
            expect(Object.keys(response.body)).toEqual(["itemEditingId"]);
            const id: unknown = response.body.itemEditingId;
            expect(id).toBeTypeOf("number");
            if (typeof id !== "number") throw new Error("HTTP応答の新規IDが数値ではない");
            copied.push(id);
            await expectCopy(id, expectedCopy(f));
        }
        expect(new Set(copied).size).toBe(5);
        const transaction = vi.spyOn(sequelize, "transaction");
        const afterFive = await editingIds(f);
        expect(afterFive).toEqual([...initial, ...copied].sort((a, b) => a - b));
        expect((await post()).status).toBe(429);
        expect(transaction).not.toHaveBeenCalled();
        expect(await editingIds(f)).toEqual(afterFive);
        expect(await protectedSnapshot(f)).toEqual(before);

        vi.setSystemTime(new Date("2026-10-15T00:10:00.001Z"));
        const reopened = await post();
        expect(reopened.status).toBe(201);
        expect(transaction).toHaveBeenCalledTimes(1);
        expect(copied).not.toContain(reopened.body.itemEditingId);
        await expectCopy(reopened.body.itemEditingId, expectedCopy(f));
        expect(await editingIds(f)).toHaveLength(initial.length + 6);
        expect(await protectedSnapshot(f)).toEqual(before);
    }, 30000);
});

describe("P1 修正後のHTTP・DB境界", () => {
    it.each([2147483648, Number.MAX_SAFE_INTEGER])("O02 AF-ID01 AF-ID02: itemId=%sは400でDB未開始", async (itemId) => {
        const before = await protectedSnapshot(f),
            ids = await editingIds(f);
        const transaction = vi.spyOn(sequelize, "transaction");
        const response = await post({ itemId });
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ code: "INVALID_BODY", message: "INVALID_BODY" });
        expect(transaction).not.toHaveBeenCalled();
        expect(await editingIds(f)).toEqual(ids);
        expect(await protectedSnapshot(f)).toEqual(before);
    });

    it("O01 AF-INV01: 破損した保存済みサイズ在庫は明示的な500で作成しない", async () => {
        await f.item.update({
            attributes: { colorVariants: [{ sizes: [{ size: "M" }] }] } as unknown as typeof f.item.attributes,
        });
        const before = await protectedSnapshot(f),
            ids = await editingIds(f);
        const create = vi.spyOn(ItemEditing, "create");
        const response = await post();
        expect(response.status).toBe(500);
        expect(response.body).toEqual({
            code: "ITEM_ATTRIBUTES_INVALID",
            message: "商品の在庫情報を確認できません。時間をおいてもう一度お試しください。",
        });
        expect(create).not.toHaveBeenCalled();
        expect(await editingIds(f)).toEqual(ids);
        expect(await protectedSnapshot(f)).toEqual(before);
    });
});
