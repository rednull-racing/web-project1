import { mocks, setup, transaction } from "../../../../fixtures/items/updateItem/usecaseMocks.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
const masters = vi.hoisted(() => ({ condition: vi.fn(), day: vi.fn(), service: vi.fn(), place: vi.fn() }));
vi.mock("../../../../../src/services/itemConditionOption/itemConditionOption.js", () => ({ getItemCondition: masters.condition }));
vi.mock("../../../../../src/services/shippingDayOption/shippingDayOption.js", () => ({ getShippingDay: masters.day }));
vi.mock("../../../../../src/services/shippingServiceOption/shippingServiceOption.js", () => ({ getShippingService: masters.service }));
vi.mock("../../../../../src/services/todouhuken/todouhuken.js", () => ({ getTodouhuken: masters.place }));
import { updateItemUseCase } from "../../../../../src/usecases/items/update/updateItem.js";
const run = () => updateItemUseCase({ userId: 7, itemEditingId: 11 });
beforeEach(() => {
    setup();
    for (const fn of Object.values(masters)) fn.mockResolvedValue({ id: 1 });
    mocks.getCategories.mockImplementation(async ({ categoryId }) => categoryId === 21
        ? { id: 21, parent_id: 28, name: " シャツ " } : { id: 28, parent_id: null, name: " ＴＯＰＳ " });
});
describe("M01 実validateMasterとupdateItemの接続・DB非接続", () => {
    it("M01: 5マスターを同じtransactionで順次検証し親検索後に更新", async () => {
        expect(await run()).toBe(456);
        expect(mocks.getCategories).toHaveBeenNthCalledWith(1, { categoryId: 21, transaction });
        expect(masters.condition).toHaveBeenCalledExactlyOnceWith({ conditionId: 22, transaction });
        expect(masters.day).toHaveBeenCalledExactlyOnceWith({ dayId: 23, transaction });
        expect(masters.service).toHaveBeenCalledExactlyOnceWith({ serviceId: 24, transaction });
        expect(masters.place).toHaveBeenCalledExactlyOnceWith({ todouhukenId: 25, transaction });
        expect(mocks.getCategories).toHaveBeenNthCalledWith(2, { categoryId: 28, transaction });
        for (const fn of Object.values(masters)) expect(fn.mock.calls[0][0].transaction).toBe(transaction);
        expect(mocks.updateItem.mock.calls[0][0].data.search_text).toBe("testかたかなvideoてすとしゃつtopsuser");
    });
    const cases = [
        ["category", "CATEGORY_NOT_FOUND"], ["condition", "ITEM_CONDITION_NOT_FOUND"],
        ["day", "SHIPPING_DAY_NOT_FOUND"], ["service", "SHIPPING_SERVICE_NOT_FOUND"], ["place", "PLACE_NOT_FOUND"],
    ] as const;
    it.each(cases)("M01 E02: %s不在は%sで後続検証・更新なし", async (key, code) => {
        const funcs = [mocks.getCategories, masters.condition, masters.day, masters.service, masters.place];
        const index = cases.findIndex(c => c[0] === key);
        funcs[index].mockResolvedValue(null);
        await expect(run()).rejects.toMatchObject({ code, statusCode: 404 });
        for (const fn of funcs.slice(index + 1)) expect(fn).not.toHaveBeenCalled();
        expect(mocks.updateVideo).not.toHaveBeenCalled(); expect(mocks.deleteItemEditing).not.toHaveBeenCalled(); expect(mocks.createNotification).not.toHaveBeenCalled();
    });
    it.each(cases)("M01 T01: %s取得例外を同一参照で伝播", async (key) => {
        const failure = new Error("select");
        const fn = key === "category" ? mocks.getCategories : masters[key];
        fn.mockRejectedValue(failure);
        await expect(run()).rejects.toBe(failure);
        expect(mocks.updateVideo).not.toHaveBeenCalled(); expect(mocks.createNotification).not.toHaveBeenCalled();
    });
});
