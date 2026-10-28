import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeliverySection } from "../deliverySection";
import type { ItemAttributes } from "../../../../types/itemAttributes";
const data = { condition: "未使用", shippingService: "配送A", shippingPlace: "東京都", shippingDay: "1〜2日", itemAttributes: {} as ItemAttributes };

describe("商品・配送情報", () => {
    it("U-N13 配送の4項目を表示する", () => {
        render(<DeliverySection data={data} />);
        for (const value of ["商品の状態", "未使用", "配送の方法", "配送A", "発送元地域", "東京都", "発送までの日数", "1〜2日"]) {
            expect(screen.getByText(value)).toBeVisible();
        }
        expect(screen.queryByText("在庫")).not.toBeInTheDocument();
    });
    it.each([99, 100, 101, 0])("U-N13 素材の合計%s%%は100だけ表示", (total) => {
        const materials = total ? [{ name: "綿", ratio: 60 }, { name: "麻", ratio: total - 60 }] : [];
        render(<DeliverySection data={{ ...data, itemAttributes: { materials } }} />);
        if (total === 100) {
            expect(screen.getByText("素材")).toBeVisible();
            expect(screen.getByText("綿")).toBeVisible();
            expect(screen.getByText("60%")).toBeVisible();
            expect(screen.getByText("40%")).toBeVisible();
        } else expect(screen.queryByText("素材")).not.toBeInTheDocument();
    });
    it.each([[10, 4, "在庫あり"], [10, 2, "残りわずか"], [10, 0, "SOLD OUT"]] as const)("U-N13 initial=%s current=%sで%s", (initial, current, expected) => {
        render(<DeliverySection data={{ ...data, itemAttributes: { inventory: { initial, current, low_stock_ratio: 0.2 } } }} />);
        expect(screen.getByText(expected)).toBeVisible();
    });
    it.each([2, 3, 4])("Q07 初期在庫%sで残り1なら低在庫表示", (initial) => {
        render(<DeliverySection data={{ ...data, itemAttributes: { inventory: { initial, current: 1, low_stock_ratio: 0.2 } } }} />);
        expect(screen.getByText("残りわずか")).toBeVisible();
    });
    it.each([2, 3, 4])("Q07 初期在庫%sで残り2なら在庫あり表示", (initial) => {
        render(<DeliverySection data={{ ...data, itemAttributes: { inventory: { initial, current: 2, low_stock_ratio: 0.2 } } }} />);
        expect(screen.getByText("在庫あり")).toBeVisible();
    });
    it("U-S01 配送と素材名をHTMLに変換しない", () => {
        const payload = '<script>alert(1)</script><img onerror="alert(2)">';
        const { container } = render(<DeliverySection data={{ ...data, condition: payload, shippingService: payload, shippingPlace: payload, shippingDay: payload, itemAttributes: { materials: [{ name: payload, ratio: 100 }] } }} />);
        expect(screen.getAllByText(payload)).toHaveLength(5);
        expect(container.querySelector("script, [onerror]")).toBeNull();
    });
});
