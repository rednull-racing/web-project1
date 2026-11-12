import { describe, expect, it, vi } from "vitest";
import Page, { generateMetadata } from "../page";
import ItemListUI from "../../itemListUI";
import { TrashItemList } from "../trashItemList";
vi.mock("../../itemListUI", () => ({ default: () => null }));
vi.mock("../trashItemList", () => ({ TrashItemList: () => null }));
describe("Pageとmetadata", () => {
    it("U-M01 非同期Pageの包含とmetadataを返し通信しない", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const page = await Page();
        expect(page.type).toBe(ItemListUI);
        expect(page.props.title).toBe("削除した商品");
        expect(page.props.children.type).toBe(TrashItemList);
        expect(await generateMetadata()).toEqual({
            title: "削除した商品一覧",
            description: "最近1か月以内に削除した商品をご覧いただけます。",
            robots: { index: false, follow: false },
        });
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
