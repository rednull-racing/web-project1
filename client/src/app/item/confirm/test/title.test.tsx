import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Title } from "../title";

it.each([
    ["normal", "出品する商品の確認"],
    ["edit", "更新する商品情報の確認"],
] as const)("U-N01 %sのタイトル", (page, title) => {
    render(<Title page={page} />);
    expect(screen.getByText(title)).toBeInTheDocument();
});
