import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ update: vi.fn(), destroy: vi.fn(), create: vi.fn(), findOne: vi.fn() }));
vi.mock("../../../models/index.js", () => ({
    ItemReport: { update: mocks.update, destroy: mocks.destroy, create: mocks.create, findOne: mocks.findOne },
    ItemReportOption: {},
}));
import { detachItemReports } from "../itemReport.js";
type Params = Parameters<typeof detachItemReports>[0];
const transaction = {} as Params["transaction"];
beforeEach(() => vi.resetAllMocks());

describe("P0/P1 detachItemReportsの対象限定・保持・transaction", () => {
    it.each([0, 1, 3])("S-REPORT-01: 対象通報%s件でもitem_idのみNULLへ更新", async (count) => {
        mocks.update.mockResolvedValue([count]);
        expect(await detachItemReports({ itemId: 101, transaction })).toBeUndefined();
        expect(mocks.update).toHaveBeenCalledExactlyOnceWith(
            { item_id: null },
            { where: { item_id: 101 }, transaction },
        );
        expect(mocks.update.mock.calls[0][1].transaction).toBe(transaction);
        expect(mocks.destroy).not.toHaveBeenCalled();
        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.findOne).not.toHaveBeenCalled();
    });
    it("S-REPORT-02: 更新の元例外を伝播し削除・再試行しない", async () => {
        const error = new Error("report update failure");
        mocks.update.mockRejectedValue(error);
        await expect(detachItemReports({ itemId: 101, transaction })).rejects.toBe(error);
        expect(mocks.update).toHaveBeenCalledOnce();
        expect(mocks.destroy).not.toHaveBeenCalled();
    });
    it.each(["成功", "失敗"])("S-REPORT-03: 更新の%sまで待機する", async (mode) => {
        let release!: (value: number[]) => void;
        let reject!: (reason: Error) => void;
        const gate = new Promise<number[]>((resolve, fail) => {
            release = resolve;
            reject = fail;
        });
        const error = new Error("delayed report update failure");
        mocks.update.mockReturnValue(gate);
        let completed = false;
        const pending = detachItemReports({ itemId: 101, transaction }).finally(() => {
            completed = true;
        });
        const settled = Promise.allSettled([pending]);
        try {
            expect(mocks.update).toHaveBeenCalledOnce();
            await Promise.resolve();
            expect(completed).toBe(false);
        } finally {
            if (mode === "失敗") reject(error);
            else release([2]);
            await settled;
        }
        if (mode === "失敗") await expect(pending).rejects.toBe(error);
        else await expect(pending).resolves.toBeUndefined();
        expect(completed).toBe(true);
        expect(mocks.update).toHaveBeenCalledOnce();
        expect(mocks.destroy).not.toHaveBeenCalled();
    });
});
