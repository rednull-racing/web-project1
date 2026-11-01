import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../errors.js";
import type { getMyItemConfirmPageMetadata } from "../../../services/itemEditing/query.js";
import {
    deferred,
    makeMetadataRow,
    makeMetadata,
} from "../../../../test/fixtures/itemEditing/getItemConfirmPageMetadata/fixtures.js";
const mocks = vi.hoisted(() => ({ get: vi.fn<typeof getMyItemConfirmPageMetadata>() }));
vi.mock("../../../services/itemEditing/query.js", () => ({ getMyItemConfirmPageMetadata: mocks.get }));
import { getItemConfirmPageMetadataUseCase } from "../getItemConfirmPageMetadata.js";
const run = () => getItemConfirmPageMetadataUseCase({ itemEditingId: 101, userId: 7 });
beforeEach(() => vi.resetAllMocks());
describe("P0/P1/P2 getItemConfirmPageMetadata usecase", () => {
    it.each(["編集セッション", null, "", "  "])("U01 所有者条件を渡しname=%sとidのみを返す", async (name) => {
        const row = Object.freeze(makeMetadataRow(101, name));
        mocks.get.mockResolvedValue(row);
        expect(await run()).toEqual(makeMetadata(101, name));
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith({ itemEditingId: 101, userId: 7 });
    });
    it("U02 不存在はAppError 404", async () => {
        mocks.get.mockResolvedValue(null);
        const pending = run();
        await expect(pending).rejects.toBeInstanceOf(AppError);
        await expect(pending).rejects.toMatchObject({ code: "ITEM_EDITING_NOT_FOUND", statusCode: 404 });
        expect(mocks.get).toHaveBeenCalledOnce();
    });
    it("U03 元例外を伝播", async () => {
        const error = new Error("db");
        mocks.get.mockRejectedValue(error);
        await expect(run()).rejects.toBe(error);
        expect(mocks.get).toHaveBeenCalledOnce();
    });
    it.each(["成功", "null", "失敗"])("U04 取得%sまで完了しない", async (mode) => {
        const gate = deferred<Awaited<ReturnType<typeof getMyItemConfirmPageMetadata>>>();
        const row = makeMetadataRow(),
            error = new Error("db");
        mocks.get.mockReturnValue(gate.promise);
        let completed = false;
        const pending = run().finally(() => {
            completed = true;
        });
        const settled = Promise.allSettled([pending]);
        try {
            expect(mocks.get).toHaveBeenCalledOnce();
            await Promise.resolve();
            expect(completed).toBe(false);
        } finally {
            if (mode === "失敗") gate.reject(error);
            else gate.resolve(mode === "null" ? null : row);
            await settled;
        }
        if (mode === "成功") expect(await pending).toEqual(makeMetadata());
        else if (mode === "失敗") await expect(pending).rejects.toBe(error);
        else await expect(pending).rejects.toMatchObject({ code: "ITEM_EDITING_NOT_FOUND", statusCode: 404 });
    });
    it("U04 逆順完了でも結果が混ざらない", async () => {
        const gate = deferred<Awaited<ReturnType<typeof getMyItemConfirmPageMetadata>>>();
        const a = makeMetadataRow(),
            b = makeMetadataRow(202, "別の編集セッション");
        mocks.get.mockReturnValueOnce(gate.promise).mockResolvedValueOnce(b);
        const pending = run();
        try {
            expect(await getItemConfirmPageMetadataUseCase({ itemEditingId: 202, userId: 8 })).toEqual(
                makeMetadata(202, "別の編集セッション"),
            );
            expect(mocks.get).toHaveBeenNthCalledWith(2, { itemEditingId: 202, userId: 8 });
        } finally {
            gate.resolve(a);
            await pending;
        }
        expect(await pending).toEqual(makeMetadata());
    });
});
