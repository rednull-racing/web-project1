import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../errors.js";
import { deferred, makeConfirmRow } from "./getItemConfirmPage.fixtures.js";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../../services/itemEditing/query.js", () => ({ getMyItemConfirmPage: mocks.get }));
import { getItemConfirmPageUseCase } from "../getItemConfirmPage.js";

beforeEach(() => vi.resetAllMocks());
describe("P0/P1 確認ページusecaseの取得・存在判定・待機", () => {
    it("U01: 所有者と対象IDだけを渡しnull・0・空配列を含む同じ行を返す", async () => {
        const row = makeConfirmRow();
        mocks.get.mockResolvedValue(row);
        expect(await getItemConfirmPageUseCase({ userId: 7, itemEditingId: 123 })).toBe(row);
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemEditingId: 123 });
        expect(row).toEqual(makeConfirmRow());
    });
    it("U02: 所有者条件で取得できなければAppError404", async () => {
        mocks.get.mockResolvedValue(null);
        const pending = getItemConfirmPageUseCase({ userId: 7, itemEditingId: 123 });
        await expect(pending).rejects.toBeInstanceOf(AppError);
        await expect(pending).rejects.toMatchObject({ code: "ITEM_EDITING_NOT_FOUND", statusCode: 404 });
        expect(mocks.get).toHaveBeenCalledOnce();
    });
    it("U03: DB例外の同じ参照を伝播し再検索しない", async () => {
        const error = new Error("DB failure");
        mocks.get.mockRejectedValue(error);
        await expect(getItemConfirmPageUseCase({ userId: 7, itemEditingId: 123 })).rejects.toBe(error);
        expect(mocks.get).toHaveBeenCalledOnce();
    });
    it.each([false, true])("U04: 取得保留中は完了せず解放後に返却/例外伝播 reject=%s", async (fail) => {
        const gate = deferred<ReturnType<typeof makeConfirmRow>>();
        const row = makeConfirmRow(), error = new Error("delayed DB failure");
        mocks.get.mockReturnValue(gate.promise);
        let completed = false;
        const pending = getItemConfirmPageUseCase({ userId: 7, itemEditingId: 123 });
        const settled = pending.then(value => { completed = true; return value; }, reason => { completed = true; return reason; });
        try {
            await Promise.resolve();
            expect(completed).toBe(false);
        } finally {
            if (fail) gate.reject(error); else gate.resolve(row);
        }
        expect(await settled).toBe(fail ? error : row);
    });
    it("U05: 別対象の検索を逆順で完了しても結果が混ざらない", async () => {
        const first = deferred<ReturnType<typeof makeConfirmRow>>(), second = deferred<ReturnType<typeof makeConfirmRow>>();
        const row1 = makeConfirmRow(123), row2 = makeConfirmRow(456);
        mocks.get.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const p1 = getItemConfirmPageUseCase({ userId: 7, itemEditingId: 123 });
        const p2 = getItemConfirmPageUseCase({ userId: 8, itemEditingId: 456 });
        const settled = Promise.allSettled([p1, p2]);
        try {
            second.resolve(row2);
            expect(await p2).toBe(row2);
        } finally { first.resolve(row1); second.resolve(row2); await settled; }
        expect(await p1).toBe(row1);
        expect(mocks.get.mock.calls).toEqual([[{ userId: 7, itemEditingId: 123 }], [{ userId: 8, itemEditingId: 456 }]]);
    });
});
