import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, it, expect, expectTypeOf, vi } from "vitest";
import { TrashItem } from "../trashItem";
import { ItemImage } from "../../_components/itemImage";
import { ItemPrice } from "../../_components/itemPrice";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
vi.mock("../../_components/itemImage", () => ({ ItemImage: vi.fn(() => null) }));
vi.mock("../../_components/itemPrice", () => ({ ItemPrice: vi.fn(() => null) }));
vi.mock("@/lib/formatRelativeTime", () => ({ formatRelativeTime: vi.fn(() => "1時間前") }));
const fixture = (): ComponentProps<typeof TrashItem> => ({
    itemTrash: {
        id: 101,
        name: "削除シャツ",
        title: "動画A",
        price: 12345,
        first_image_url: "/test-item.jpg",
        createdAt: "2026-11-11T23:00:00.000Z",
    },
    mutate: vi.fn(),
});
describe("TrashItemの表示と引数", () => {
    it("U-I01 Linkと日時・画像・非セール価格を正しく接続する", () => {
        const props = fixture();
        render(<TrashItem {...props} />);
        expect(screen.getByRole("link")).toHaveAttribute("href", "/item/deleted/101");
        expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("削除シャツ");
        expect(screen.getByText("動画A")).toBeInTheDocument();
        expect(screen.getByText("削除日時:")).toBeInTheDocument();
        expect(screen.getByText("1時間前")).toBeInTheDocument();
        expect(formatRelativeTime).toHaveBeenCalledWith(props.itemTrash.createdAt);
        expect(vi.mocked(ItemImage).mock.calls[0][0]).toEqual({
            data: { first_image_url: "/test-item.jpg", status: null },
            showSold: false,
        });
        expect(vi.mocked(ItemPrice).mock.calls[0][0]).toEqual({
            data: { price: 12345, sale_flag: false, before_price: 0, discount_rate: 0, discount_amount: 0 },
            showSale: false,
        });
        expect(props.mutate).not.toHaveBeenCalled();
    });
    it("U-I02 nullable名・動画タイトル・画像を補完または子へ委ねる", () => {
        const props = fixture();
        Object.assign(props.itemTrash, { name: null, title: null, first_image_url: null });
        render(<TrashItem {...props} />);
        expect(screen.getByRole("heading", { level: 2 })).toBeEmptyDOMElement();
        expect(screen.getByRole("heading", { level: 4 })).toBeEmptyDOMElement();
        expect(vi.mocked(ItemImage).mock.calls[0][0].data.first_image_url).toBeNull();
    });
    it.each([12345, "12345"])("U-I03 価格%jを共通価格表示へ渡して円表示する", async (price) => {
        const actual =
            await vi.importActual<typeof import("../../_components/itemPrice")>("../../_components/itemPrice");
        vi.mocked(ItemPrice).mockImplementationOnce(actual.ItemPrice);
        const props = fixture();
        props.itemTrash.price = price;
        render(<TrashItem {...props} />);
        expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("12,345円");
        expectTypeOf<null>().not.toExtend<ComponentProps<typeof TrashItem>["itemTrash"]["price"]>();
    });
});
