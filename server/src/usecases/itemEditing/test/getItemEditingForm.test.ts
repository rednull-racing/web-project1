import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../errors.js";
import { deferred, makeFormRow } from "./getItemEditingForm.fixtures.js";

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    category: vi.fn(),
    condition: vi.fn(),
    day: vi.fn(),
    service: vi.fn(),
    place: vi.fn(),
    shop: vi.fn(),
}));
vi.mock("../../../services/categories/categories.js", () => ({ getAllLevel1: mocks.category }));
vi.mock("../../../services/itemConditionOption/itemConditionOption.js", () => ({ getAllCondition: mocks.condition }));
vi.mock("../../../services/shippingDayOption/shippingDayOption.js", () => ({ getAllShippingDay: mocks.day }));
vi.mock("../../../services/shippingServiceOption/shippingServiceOption.js", () => ({
    getAllShippingService: mocks.service,
}));
vi.mock("../../../services/todouhukenOption/todouhukenOption.js", () => ({ getAllTodouhuken: mocks.place }));
vi.mock("../../../services/users/query.js", () => ({ getUserHasShop: mocks.shop }));
vi.mock("../../../services/itemEditing/query.js", () => ({ getMyItemEditingForm: mocks.get }));
import { getItemEditingFormUseCase } from "../getItemEditingForm.js";

const additional = ["category", "condition", "day", "service", "place", "shop"] as const;
beforeEach(() => {
    vi.resetAllMocks();
    for (const key of additional) mocks[key].mockResolvedValue(key === "shop" ? null : []);
});
describe("P0/P1 フォームusecaseの取得・存在判定・待機", () => {
    it("U01: 所有者と対象IDだけを渡しnull・0・空配列を含む同じ行を返す", async () => {
        const row = makeFormRow();
        mocks.get.mockResolvedValue(row);
        const category = [
            {
                id: 10,
                name: "親",
                level: 1,
                allowed_gender: "women",
                allowed_age: "adult",
                parent_id: null,
                sort_order: 2,
            },
        ];
        const condition = [{ id: 21, name: "新品" }],
            day = [{ id: 31, name: "翌日" }];
        const service = [{ id: 41, name: "配送" }],
            place = [{ id: 51, name: "東京都" }];
        mocks.category.mockResolvedValue(category);
        mocks.condition.mockResolvedValue(condition);
        mocks.day.mockResolvedValue(day);
        mocks.service.mockResolvedValue(service);
        mocks.place.mockResolvedValue(place);
        const result = await getItemEditingFormUseCase({ userId: 7, itemEditingId: 123 });
        expect(result).toEqual({
            itemEditing: row,
            category,
            allCondition: condition,
            allDay: day,
            allService: service,
            allPlace: place,
            hasShop: false,
        });
        expect(result.itemEditing).toBe(row);
        expect(result.category).toBe(category);
        expect(result.allCondition).toBe(condition);
        expect(result.allDay).toBe(day);
        expect(result.allService).toBe(service);
        expect(result.allPlace).toBe(place);
        for (const key of additional) {
            expect(mocks[key]).toHaveBeenCalledExactlyOnceWith(...(key === "shop" ? [{ userId: 7 }] : []));
        }
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemEditingId: 123 });
        expect(row).toEqual(makeFormRow());
    });
    it("U02: 所有者条件で取得できなければAppError404", async () => {
        mocks.get.mockResolvedValue(null);
        const pending = getItemEditingFormUseCase({ userId: 7, itemEditingId: 123 });
        await expect(pending).rejects.toBeInstanceOf(AppError);
        await expect(pending).rejects.toMatchObject({ code: "ITEM_EDITING_NOT_FOUND", statusCode: 404 });
        expect(mocks.get).toHaveBeenCalledOnce();
        for (const key of additional) expect(mocks[key]).not.toHaveBeenCalled();
    });
    it("U03: DB例外の同じ参照を伝播し再検索しない", async () => {
        const error = new Error("DB failure");
        mocks.get.mockRejectedValue(error);
        await expect(getItemEditingFormUseCase({ userId: 7, itemEditingId: 123 })).rejects.toBe(error);
        expect(mocks.get).toHaveBeenCalledOnce();
        for (const key of additional) expect(mocks[key]).not.toHaveBeenCalled();
    });
    it.each([false, true])("U04: 取得保留中は完了せず解放後に返却/例外伝播 reject=%s", async (fail) => {
        const gate = deferred<ReturnType<typeof makeFormRow>>();
        const row = makeFormRow(),
            error = new Error("delayed DB failure");
        mocks.get.mockReturnValue(gate.promise);
        let completed = false;
        const pending = getItemEditingFormUseCase({ userId: 7, itemEditingId: 123 });
        const settled = pending.then(
            (value) => {
                completed = true;
                return value;
            },
            (reason) => {
                completed = true;
                return reason;
            },
        );
        try {
            await Promise.resolve();
            expect(completed).toBe(false);
            for (const key of additional) expect(mocks[key]).not.toHaveBeenCalled();
        } finally {
            if (fail) gate.reject(error);
            else gate.resolve(row);
        }
        const value = await settled;
        if (fail) expect(value).toBe(error);
        else expect(value.itemEditing).toBe(row);
    });
    it("U05: 別対象の検索を逆順で完了しても結果が混ざらない", async () => {
        const first = deferred<ReturnType<typeof makeFormRow>>(),
            second = deferred<ReturnType<typeof makeFormRow>>();
        const row1 = makeFormRow(123),
            row2 = makeFormRow(456);
        mocks.get.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const category1 = [{ id: 11 }],
            category2 = [{ id: 22 }];
        mocks.category.mockResolvedValueOnce(category2).mockResolvedValueOnce(category1);
        mocks.shop.mockImplementation(async ({ userId }: { userId: number }) =>
            userId === 7 ? { ShopInfo: { id: 77 } } : { ShopInfo: null },
        );
        const p1 = getItemEditingFormUseCase({ userId: 7, itemEditingId: 123 });
        const p2 = getItemEditingFormUseCase({ userId: 8, itemEditingId: 456 });
        const settled = Promise.allSettled([p1, p2]);
        try {
            second.resolve(row2);
            expect((await p2).itemEditing).toBe(row2);
            expect((await p2).category).toBe(category2);
            expect((await p2).hasShop).toBe(false);
        } finally {
            first.resolve(row1);
            second.resolve(row2);
            await settled;
        }
        expect((await p1).itemEditing).toBe(row1);
        expect((await p1).category).toBe(category1);
        expect((await p1).hasShop).toBe(true);
        expect(mocks.get.mock.calls).toEqual([
            [{ userId: 7, itemEditingId: 123 }],
            [{ userId: 8, itemEditingId: 456 }],
        ]);
    });
});

describe("P0/P1 追加フォームデータの取得・失敗・待機", () => {
    it.each([null, { ShopInfo: null }, { ShopInfo: { id: 77 } }])(
        "U06: ショップ取得結果 %j をbooleanへ変換しユーザー情報を公開しない",
        async (user) => {
            mocks.get.mockResolvedValue(makeFormRow());
            mocks.shop.mockResolvedValue(user);
            const result = await getItemEditingFormUseCase({ userId: 7, itemEditingId: 123 });
            expect(result.hasShop).toBe(!!user?.ShopInfo);
            expect(Object.keys(result).sort()).toEqual([
                "allCondition",
                "allDay",
                "allPlace",
                "allService",
                "category",
                "hasShop",
                "itemEditing",
            ]);
            expect(mocks.shop).toHaveBeenCalledExactlyOnceWith({ userId: 7 });
        },
    );
    it.each(additional)("U07: %s の失敗は同じ例外を伝播し部分成功を返さない", async (key) => {
        mocks.get.mockResolvedValue(makeFormRow());
        const error = new Error(key + " failure");
        mocks[key].mockRejectedValue(error);
        await expect(getItemEditingFormUseCase({ userId: 7, itemEditingId: 123 })).rejects.toBe(error);
        expect(mocks.get).toHaveBeenCalledOnce();
        for (const name of additional) expect(mocks[name]).toHaveBeenCalledOnce();
    });
    it.each(additional)("U08: %s の取得完了を待ってから返す", async (key) => {
        mocks.get.mockResolvedValue(makeFormRow());
        const started = deferred<void>(),
            gate = deferred<[] | null>();
        mocks[key].mockImplementation(() => {
            started.resolve();
            return gate.promise;
        });
        let done = false;
        const pending = getItemEditingFormUseCase({ userId: 7, itemEditingId: 123 });
        const settled = pending.finally(() => {
            done = true;
        });
        try {
            await Promise.race([
                started.promise,
                settled.then(() => {
                    throw new Error("取得開始前に完了");
                }),
            ]);
            expect(done).toBe(false);
            for (const name of additional) expect(mocks[name]).toHaveBeenCalledOnce();
        } finally {
            gate.resolve(key === "shop" ? null : []);
            await settled;
        }
        expect(await pending).toEqual({
            itemEditing: makeFormRow(),
            category: [],
            allCondition: [],
            allDay: [],
            allService: [],
            allPlace: [],
            hasShop: false,
        });
    });
});
