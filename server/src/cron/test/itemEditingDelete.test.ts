import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deferred } from "../../../test/fixtures/items/createItem/fixtures.js";
const mocks = vi.hoisted(() => ({ schedule: vi.fn(), run: vi.fn() }));
vi.mock("node-cron", () => ({ default: { schedule: mocks.schedule } }));
vi.mock("../../usecases/itemEditing/cronDeleteItemEditing.js", () => ({ cronDeleteItemEditingUseCase: mocks.run }));
import { startItemEditingDeleteCron } from "../itemEditingDelete.js";
beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
const callback = (): (() => Promise<void>) => {
    startItemEditingDeleteCron();
    return mocks.schedule.mock.calls[0][1];
};
describe("P0/P1: Cron登録と結果通知", () => {
    it("C01: JSTの毎日12時を登録し即時実行しない", () => {
        startItemEditingDeleteCron();
        expect(mocks.schedule).toHaveBeenCalledExactlyOnceWith("0 12 * * *", expect.any(Function), {
            timezone: "Asia/Tokyo",
        });
        expect(mocks.run).not.toHaveBeenCalled();
    });
    it.each([0, 7])("C02: %i件の完了後に成功ログを出す", async (count) => {
        const gate = deferred<number>();
        mocks.run.mockReturnValue(gate.promise);
        const pending = callback()();
        try {
            expect(mocks.run).toHaveBeenCalledExactlyOnceWith();
            expect(console.log).not.toHaveBeenCalled();
        } finally {
            gate.resolve(count);
            await pending;
        }
        expect(console.log).toHaveBeenCalledExactlyOnceWith(`[cron] ${count}件の3日経過ItemEditingを削除しました。`);
        expect(console.error).not.toHaveBeenCalled();
    });
    it("C03: 失敗を捕捉して成功ログを出さず、次回は実行できる", async () => {
        const failure = new Error("failed");
        mocks.run.mockRejectedValueOnce(failure).mockResolvedValueOnce(0);
        const run = callback();
        await expect(run()).resolves.toBeUndefined();
        expect(console.error).toHaveBeenCalledExactlyOnceWith("[cron] ItemEditing削除エラー", failure);
        expect(console.log).not.toHaveBeenCalled();
        await run();
        expect(mocks.run).toHaveBeenCalledTimes(2);
        expect(console.log).toHaveBeenCalledOnce();
    });
});
