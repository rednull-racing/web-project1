import { mocks, setup, transaction } from "../../../../fixtures/items/createItem/usecaseMocks.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createItemUseCase } from "../../../../../src/usecases/itemEditing/createItem.js";
const master = vi.hoisted(() => ({ condition: vi.fn(), day: vi.fn(), service: vi.fn(), place: vi.fn() }));
vi.mock("../../../../../src/services/itemConditionOption/itemConditionOption.js", () => ({
    getItemCondition: master.condition,
}));
vi.mock("../../../../../src/services/shippingDayOption/shippingDayOption.js", () => ({ getShippingDay: master.day }));
vi.mock("../../../../../src/services/shippingServiceOption/shippingServiceOption.js", () => ({
    getShippingService: master.service,
}));
vi.mock("../../../../../src/services/todouhuken/todouhuken.js", () => ({ getTodouhuken: master.place }));
let editing: ReturnType<typeof setup>;
const run = () => createItemUseCase({ userId: 7, itemEditingId: 11 });
beforeEach(() => {
    editing = setup();
    for (const fn of Object.values(master)) fn.mockResolvedValue({ id: 1 });
    mocks.getCategories.mockImplementation(async ({ categoryId }) =>
        categoryId === 21 ? { id: 21, name: " シャツ ", parent_id: 28 } : { id: 28, name: " ＴＯＰＳ " },
    );
});
afterEach(() => vi.restoreAllMocks());
describe("H 実validateMaster・normalizeJapanese接続", () => {
    it("M01 M06 N09: 実helperで順次参照して検索文字列生成、attributes保持", async () => {
        expect(await run()).toBe(456);
        expect(mocks.getCategories).toHaveBeenNthCalledWith(1, { categoryId: 21, transaction });
        expect(mocks.getCategories).toHaveBeenNthCalledWith(2, { categoryId: 28, transaction });
        expect(master.condition).toHaveBeenCalledExactlyOnceWith({ conditionId: 22, transaction });
        expect(master.day).toHaveBeenCalledExactlyOnceWith({ dayId: 23, transaction });
        expect(master.service).toHaveBeenCalledExactlyOnceWith({ serviceId: 24, transaction });
        expect(master.place).toHaveBeenCalledExactlyOnceWith({ todouhukenId: 25, transaction });
        const calls = [
            mocks.getCategories.mock.invocationCallOrder[0],
            master.condition.mock.invocationCallOrder[0],
            master.day.mock.invocationCallOrder[0],
            master.service.mock.invocationCallOrder[0],
            master.place.mock.invocationCallOrder[0],
            mocks.getCategories.mock.invocationCallOrder[1],
            mocks.countFollower.mock.invocationCallOrder[0],
        ];
        expect(calls).toEqual([...calls].sort((a, b) => a - b));
        expect(mocks.createItem.mock.calls[0][0].data.search_text).toBe("testかたかなvideoてすとしゃつtopsuser");
        expect(mocks.createItem.mock.calls[0][0].data.attributes.body_category).toBe(editing.attributes.body_category);
    });
    const steps = () => [mocks.getCategories, master.condition, master.day, master.service, master.place];
    it.each([
        "CATEGORY_NOT_FOUND",
        "ITEM_CONDITION_NOT_FOUND",
        "SHIPPING_DAY_NOT_FOUND",
        "SHIPPING_SERVICE_NOT_FOUND",
        "PLACE_NOT_FOUND",
    ])("M02 M07: %sで後続停止", async (code) => {
        const index = [
            "CATEGORY_NOT_FOUND",
            "ITEM_CONDITION_NOT_FOUND",
            "SHIPPING_DAY_NOT_FOUND",
            "SHIPPING_SERVICE_NOT_FOUND",
            "PLACE_NOT_FOUND",
        ].indexOf(code);
        steps()[index].mockResolvedValue(null);
        await expect(run()).rejects.toMatchObject({ code, statusCode: 404 });
        for (const fn of steps().slice(index + 1)) expect(fn).not.toHaveBeenCalled();
        expect(mocks.countFollower).not.toHaveBeenCalled();
        expect(mocks.createVideo).not.toHaveBeenCalled();
        expect(mocks.createNotification).not.toHaveBeenCalled();
    });
    it.each([0, 1, 2, 3, 4, 5])("M04: 検索%sの同一Error伝播", async (index) => {
        const failure = new Error("lookup");
        if (index === 5) mocks.getCategories.mockResolvedValueOnce({ parent_id: 28 }).mockRejectedValueOnce(failure);
        else steps()[index].mockRejectedValue(failure);
        await expect(run()).rejects.toBe(failure);
        expect(mocks.countFollower).not.toHaveBeenCalled();
        expect(mocks.createItem).not.toHaveBeenCalled();
        expect(mocks.createNotification).not.toHaveBeenCalled();
    });
    it("M03 N09: 親なし・半角濁点・ユーザー名なし", async () => {
        editing.name = " ＴＥＳＴ ｶﾞ ";
        editing.title = " Ａ カ ";
        mocks.getCategories.mockResolvedValue({ parent_id: null, name: " ｼｬﾂ \t\n　" });
        mocks.getUser.mockResolvedValue({ user_name: null, penalty_points: 5 });
        await run();
        expect(mocks.getCategories).toHaveBeenCalledTimes(1);
        expect(mocks.createItem.mock.calls[0][0].data.search_text).toBe("testがaかしゃつ");
    });
});
const brandMocks = vi.hoisted(() => ({
    getBrand: vi.fn(),
    getBrandOne: vi.fn(),
    getAliasOne: vi.fn(),
    createAliases: vi.fn(),
}));
vi.mock("../../../../../src/services/brands/brands.js", () => ({
    getBrand: brandMocks.getBrand,
    getBrandOne: brandMocks.getBrandOne,
}));
vi.mock("../../../../../src/services/brandAliases/brandAliases.js", () => ({
    getAliasOne: brandMocks.getAliasOne,
    createAliases: brandMocks.createAliases,
}));
it("AF-BR03 F1: 実resolveBrandの既存ブランド選択後はalias=nullでも公開成功", async () => {
    const { resolveBrand } = await import("../../../../../src/usecases/shared/resolveBrand.js");
    const { makeBody } = await import("../../../../fixtures/itemEditing/updateConfirm/fixtures.js");
    const body = makeBody();
    body.brand = { id: "26", name: "既存ブランド" };
    brandMocks.getBrand.mockResolvedValue({ id: 26, name: "既存ブランド" });
    const result = await resolveBrand({ brandId: 26, body, transaction });
    expect(result).toEqual({ brand: { id: 26, name: "既存ブランド" }, alias: null });
    // updateConfirmが保存する二つのIDを、取得境界のfixtureへ反映する。保存自体はDB未検証。
    editing.brand_id = result.brand!.id;
    editing.brand_aliases_id = result.alias?.id ?? null;
    expect(await run()).toBe(456);
    expect(mocks.createItem.mock.calls[0][0].data.brand_aliases_id).toBeNull();
    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
});
it("M07: 複数マスター欠落では最初のconditionエラーを優先し親検索へ進まない", async () => {
    master.condition.mockResolvedValue(null);
    master.day.mockResolvedValue(null);
    mocks.getCategories.mockResolvedValueOnce({ id: 21, parent_id: 28 }).mockRejectedValueOnce(new Error("parent"));
    await expect(run()).rejects.toMatchObject({ code: "ITEM_CONDITION_NOT_FOUND", statusCode: 404 });
    expect(master.day).not.toHaveBeenCalled();
    expect(mocks.getCategories).toHaveBeenCalledTimes(1);
    expect(mocks.createItem).not.toHaveBeenCalled();
});
