import { describe, expect, it, vi } from "vitest";
import Page, { generateMetadata } from "../page";
import ItemListUI from "../../itemListUI";
import { DraftItemList } from "../draftItemList";
vi.mock("../../itemListUI", () => ({ default: () => null }));
vi.mock("../draftItemList", () => ({ DraftItemList: () => null }));
describe("Pageとmetadata", () => {
    it("U-M01 非同期Pageの包含とmetadataを返し通信しない", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const page = await Page();
        expect(page.type).toBe(ItemListUI);
        expect(page.props.title).toBe("下書き商品");
        expect(page.props.children.type).toBe(DraftItemList);
        expect(await generateMetadata()).toEqual({
            title: "下書き商品一覧",
            description: "下書き保存した商品をご覧いただけます。",
            robots: { index: false, follow: false },
        });
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
