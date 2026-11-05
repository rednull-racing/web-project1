import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    destroy: vi.fn<Params["shipping"]["destroy"]>(),
    staticDestroy: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
}));
vi.mock("../../../models/index.js", () => ({
    ItemShippingProfile: { destroy: mocks.staticDestroy, findOne: mocks.findOne, create: mocks.create },
}));
import { deleteShipping } from "../itemShippingProfile.js";
type Params = Parameters<typeof deleteShipping>[0];
const transaction = {} as Params["transaction"];
// インスタンスメソッド呼出し境界の代用品であり、実Model validationは通さない。
const row = () => {
    const partial: Pick<Params["shipping"], "destroy"> = { destroy: mocks.destroy };
    return partial as Params["shipping"];
};
beforeEach(() => {
    vi.resetAllMocks();
    mocks.destroy.mockResolvedValue(undefined);
});

describe("P0/P1 deleteShippingの対象限定・transaction・待機契約", () => {
    it("S-DELETE-01: 渡されたインスタンスを同じtransactionで1回だけ削除", async () => {
        const shipping = row();
        expect(await deleteShipping({ shipping, transaction })).toBeUndefined();
        expect(mocks.destroy).toHaveBeenCalledExactlyOnceWith({ transaction });
        expect(mocks.destroy.mock.calls[0]?.[0]?.transaction).toBe(transaction);
        expect(mocks.staticDestroy).not.toHaveBeenCalled();
        expect(mocks.findOne).not.toHaveBeenCalled();
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it("S-DELETE-02: 元の削除例外をそのまま伝播し再実行しない", async () => {
        const error = new Error("instance destroy failure");
        mocks.destroy.mockRejectedValue(error);
        await expect(deleteShipping({ shipping: row(), transaction })).rejects.toBe(error);
        expect(mocks.destroy).toHaveBeenCalledOnce();
        expect(mocks.staticDestroy).not.toHaveBeenCalled();
    });
    it.each(["成功", "失敗"])("S-DELETE-03: destroyの%sまでserviceを完了しない", async (mode) => {
        let release!: () => void;
        let reject!: (reason: Error) => void;
        const gate = new Promise<void>((resolve, fail) => {
            release = resolve;
            reject = fail;
        });
        const error = new Error("delayed destroy failure");
        mocks.destroy.mockReturnValue(gate);
        let completed = false;
        const pending = deleteShipping({ shipping: row(), transaction }).finally(() => {
            completed = true;
        });
        const settled = Promise.allSettled([pending]);
        try {
            expect(mocks.destroy).toHaveBeenCalledOnce();
            await Promise.resolve();
            expect(completed).toBe(false);
        } finally {
            if (mode === "失敗") reject(error);
            else release();
            await settled;
        }
        if (mode === "失敗") await expect(pending).rejects.toBe(error);
        else await expect(pending).resolves.toBeUndefined();
        expect(completed).toBe(true);
        expect(mocks.destroy).toHaveBeenCalledOnce();
    });
});
