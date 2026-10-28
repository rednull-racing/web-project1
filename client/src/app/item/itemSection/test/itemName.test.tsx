import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ItemName } from "../itemName";

describe("商品名", () => {
    it.each([false, true])("U-N11 draftではrecommend=%sでも炎を表示しない", (recommend) => {
        const { container } = render(<ItemName data={{ itemName: "商品名", recommend }} page="draft" />);
        expect(screen.getByRole("heading", { level: 1, name: "商品名" })).toBeVisible();
        expect(container.querySelector("#itemName")).toContainElement(screen.getByRole("heading"));
        expect(container.querySelector('[data-icon="fire"]')).toBeNull();
    });
    it("U-S01 商品名のHTMLをエスケープする", () => {
        const name = '<script>alert(1)</script><img onerror="alert(2)">';
        const { container } = render(<ItemName data={{ itemName: name, recommend: false }} page="draft" />);
        expect(screen.getByRole("heading", { name })).toBeVisible();
        expect(container.querySelector("script, [onerror]")).toBeNull();
    });
});
