import { beforeEach, expect, it, vi } from "vitest";
import { formProps } from "@/../test/fixtures/upload/itemUploadPage/fixtures";
import { fetchUploadPage, normalizeUploadPage } from "../server";
const apiFetchServer = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/server", () => ({ apiFetchServer }));
beforeEach(() => {
    apiFetchServer.mockReset();
});
it("U17 form GETはno-store、7キーと初期値を保持", async () => {
    const { itemEditing, category, allCondition, allDay, allService, allPlace, hasShop } = formProps();
    const response = { itemEditing, category, allCondition, allDay, allService, allPlace, hasShop };
    apiFetchServer.mockResolvedValue(response);
    expect(await fetchUploadPage("123")).toEqual(response);
    expect(apiFetchServer).toHaveBeenCalledExactlyOnceWith("/item-editing/123/form", { cache: "no-store" });
});
it("AF-F10 GET数値IDをUI境界で文字列へ正規化し入力を変更しない", () => {
    const props = formProps();
    const response = {
        ...props,
        itemEditing: {
            ...props.itemEditing,
            id: 123,
            Category: { ...props.category[0], id: 10 },
            Brand: { id: 20, name: "Brand" },
            ItemConditionOption: { id: 1, name: "未使用" },
            ShippingDayOption: { id: 2, name: "翌日" },
            ShippingServiceOption: { id: 3, name: "宅配" },
            TodouhukenOption: { id: 4, name: "東京" },
        },
        category: [{ ...props.category[0], id: 10 }],
        allCondition: [{ id: 1, name: "未使用" }],
        allDay: [{ id: 2, name: "翌日" }],
        allService: [{ id: 3, name: "宅配" }],
        allPlace: [{ id: 4, name: "東京" }],
    };
    const normalized = normalizeUploadPage(response);
    expect(normalized.itemEditing).toMatchObject({
        id: "123",
        Category: { id: "10", level: 1 },
        Brand: { id: "20" },
        ItemConditionOption: { id: "1" },
        ShippingDayOption: { id: "2" },
        ShippingServiceOption: { id: "3" },
        TodouhukenOption: { id: "4" },
    });
    expect(normalized.category[0].id).toBe("10");
    expect(normalized.allCondition[0].id).toBe("1");
    expect(normalized.allDay[0].id).toBe("2");
    expect(normalized.allService[0].id).toBe("3");
    expect(normalized.allPlace[0].id).toBe("4");
    expect(response.itemEditing.id).toBe(123);
});
it("U17 server例外伝播", async () => {
    const error = new Error("failed");
    apiFetchServer.mockRejectedValue(error);
    await expect(fetchUploadPage("123")).rejects.toBe(error);
});
