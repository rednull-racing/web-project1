import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CategoryText } from "../categoryText";

describe("カテゴリー", () => {
    it.each(["シャツ", ""])("U-N13 カテゴリー名%sをそのまま表示", (name) => {
        const { container } = render(<CategoryText categoryName={name} />);
        expect(screen.getByText("カテゴリー")).toBeVisible();
        expect(container.querySelectorAll("p")[1]).toHaveTextContent(name);
    });
    it("U-S01 HTMLとして描画しない", () => {
        const payload = '<script>alert(1)</script><img onerror="alert(2)">';
        const { container } = render(<CategoryText categoryName={payload} />);
        expect(screen.getByText(payload)).toBeVisible();
        expect(container.querySelector("script, [onerror]")).toBeNull();
    });
});
