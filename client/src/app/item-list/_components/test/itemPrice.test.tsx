import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, expectTypeOf, it } from "vitest";
import { ItemPrice } from "../itemPrice";

const fixture = (): ComponentProps<typeof ItemPrice> => ({
    data: { price: 12345, sale_flag: true, before_price: 20000, discount_rate: 20, discount_amount: 1000 },
    showSale: true,
});
const expectPrices = () => {
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("12,345円");
    expect(screen.getByText("20,000円")).toBeInTheDocument();
};

describe("ItemPriceの整形とセール表示", () => {
    it("U-R01 U-R07 不整合な入力値も再計算せず個別に整形して表示する", () => {
        render(<ItemPrice {...fixture()} />);
        expectPrices();
        expect(screen.getAllByText("20% OFF")).toHaveLength(1);
        expect(screen.getAllByText("1,000円引き")).toHaveLength(1);
    });

    it.each([true, false].flatMap((showSale) =>
        [true, false].map((sale_flag) => ({ showSale, sale_flag })),
    ))("U-R02 入力%jの表示条件を満たす場合だけセールを表示する", ({ showSale, sale_flag }) => {
        const props = fixture();
        render(<ItemPrice {...props} showSale={showSale} data={{ ...props.data, sale_flag }} />);
        expect(screen.getByRole("heading")).toHaveTextContent("12,345円");
        for (const text of ["20,000円", "20% OFF", "1,000円引き"]) {
            expect(screen.queryAllByText(text)).toHaveLength(showSale && sale_flag ? 1 : 0);
        }
    });

    it.each([-1, 0, 1])("U-R03 割引率%sは正の場合だけ表示する", (discount_rate) => {
        const props = fixture();
        render(<ItemPrice {...props} data={{ ...props.data, discount_rate, discount_amount: 0 }} />);
        expectPrices();
        expect(screen.queryAllByText(/% OFF/)).toHaveLength(discount_rate > 0 ? 1 : 0);
        if (discount_rate > 0) expect(screen.getByText("1% OFF")).toBeInTheDocument();
        expect(screen.queryByText(/円引き/)).not.toBeInTheDocument();
    });

    it.each([-1, 0, 1])("U-R04 割引額%sは正の場合だけ表示する", (discount_amount) => {
        const props = fixture();
        render(<ItemPrice {...props} data={{ ...props.data, discount_rate: 0, discount_amount }} />);
        expectPrices();
        expect(screen.queryAllByText(/円引き/)).toHaveLength(discount_amount > 0 ? 1 : 0);
        if (discount_amount > 0) expect(screen.getByText("1円引き")).toBeInTheDocument();
        expect(screen.queryByText(/% OFF/)).not.toBeInTheDocument();
    });

    it("U-R05 割引が両方0でも変更前価格を表示する", () => {
        const props = fixture();
        render(<ItemPrice {...props} data={{ ...props.data, discount_rate: 0, discount_amount: 0 }} />);
        expectPrices();
        expect(screen.queryByText(/% OFF|円引き/)).not.toBeInTheDocument();
    });

    it.each([[0, "0円"], [999, "999円"], [1000, "1,000円"]] as const)("U-R06 現在価格%sと変更前価格0を表示する", (price, expected) => {
        const props = fixture();
        const { container } = render(<ItemPrice {...props} data={{ ...props.data, price, before_price: 0 }} />);
        expect(screen.getByRole("heading").textContent).toBe(expected);
        expect(container.querySelector("p")?.textContent).toBe("0円");
    });

    it("U-R08 再描画で現在価格を更新し古いセール表示を除去する", () => {
        const props = fixture();
        const { rerender } = render(<ItemPrice {...props} />);
        expectPrices();
        rerender(<ItemPrice {...props} showSale={false} data={{ ...props.data, price: 500 }} />);
        expect(screen.getByRole("heading").textContent).toBe("500円");
        expect(screen.queryByText("12,345円")).not.toBeInTheDocument();
        expect(screen.queryByText("20,000円")).not.toBeInTheDocument();
        expect(screen.queryByText(/% OFF|円引き/)).not.toBeInTheDocument();
    });
});

describe("ItemPriceの文字列価格契約", () => {
    it.each([1200, "1200", "1200.00"])("AF-R01 価格%sは1,200円を表示する", (price) => {
        const props = fixture();
        render(<ItemPrice {...props} data={{ ...props.data, price }} />);
        expect(screen.getByRole("heading").textContent).toBe("1,200円");
    });

    it("AF-R02 表示用文字列は通貨記号や単位を付けず表示する", () => {
        expectTypeOf<ComponentProps<typeof ItemPrice>["data"]["price"]>().toEqualTypeOf<number | string>();
        const props = fixture();
        render(<ItemPrice {...props} data={{ ...props.data, price: "-" }} />);
        expect(screen.getByRole("heading").textContent).toBe("-");
    });

    it("AF-R03 文字列の変更前価格と割引数値を整形する", () => {
        const props = fixture();
        render(<ItemPrice {...props} data={{ ...props.data, before_price: "20000.00", discount_rate: "20", discount_amount: "1000" }} />);
        expect(screen.getByText("20,000円")).toBeInTheDocument();
        expect(screen.getByText("20% OFF")).toBeInTheDocument();
        expect(screen.getByText("1,000円引き")).toBeInTheDocument();
    });
});
