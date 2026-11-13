import { screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { StockItem } from "../stockItem";
import { mount } from "../../../../../test/fixtures/item-list/stock/setup";
import { row } from "../../../../../test/fixtures/item-list/stock/fixtures";
it.each([0, 1, 1234])("U-V01 在庫%sを表示し売切れバッジを表示しない", (current) => {
    const mutate = vi.fn();
    mount(
        <StockItem
            item={row({
                status: "soldout",
                attributes: {
                    inventory: { initial: 2000, current, low_stock_ratio: 0.2 },
                    colorVariants: [{ inventory: { initial: 99, current: 99, low_stock_ratio: 0.2 } }],
                },
            })}
            mutate={mutate}
        />,
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/item/101");
    expect(screen.getByText(current.toLocaleString())).toBeInTheDocument();
    expect(screen.queryByText("99")).not.toBeInTheDocument();
    expect(screen.queryByText("SOLD")).not.toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
});
it.each([undefined, {}])("U-V02 attributes/inventory省略とnullable関連", (attributes) => {
    mount(<StockItem item={row({ name: null, Video: null, attributes, uploaded_at: null })} mutate={vi.fn()} />);
    expect(screen.getByText("在庫数：")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toBeEmptyDOMElement();
    expect(screen.getByRole("heading", { level: 4 })).toBeEmptyDOMElement();
    expect(decodeURIComponent(screen.getByRole("img").getAttribute("src") ?? "")).toContain("/no-image(1x1).png");
    expect(screen.getByText("1,200円")).toBeInTheDocument();
});
it("U-N02 Sale数値文字列とnull割引を共通価格へ渡す", () => {
    mount(
        <StockItem
            item={row({ Sale: { sale_flag: true, before_price: "2000", discount_rate: "40", discount_amount: null } })}
            mutate={vi.fn()}
        />,
    );
    expect(screen.getByText("2,000円")).toBeInTheDocument();
    expect(screen.getByText("40% OFF")).toBeInTheDocument();
    expect(screen.getByText("紹介動画")).toBeInTheDocument();
});
