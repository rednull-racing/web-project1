import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TermsList } from "../terms-list";
it("U-S08 禁止事項の番号と本文は文字として表示", () => {
    const text = '<script>alert("x")</script>';
    const { container } = render(<TermsList number={15} fontSize="small" text={text} />);
    expect(container.textContent).toContain("15");
    expect(screen.getByText(text)).toBeVisible();
    expect(container.querySelector("script")).toBeNull();
});
