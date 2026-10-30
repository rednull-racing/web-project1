import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Back } from "../back";

const mocks = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks }));

it.each(["click", "Enter", "Space"])("U-S08 F2 %sで名前付き戻るボタンから履歴へ一度だけ戻る", async (action) => {
    render(<Back />);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "戻る" });
    expect(button).toHaveAttribute("type", "button");
    if (action === "click") await user.click(button);
    else {
        await user.tab();
        expect(button).toHaveFocus();
        await user.keyboard(action === "Enter" ? "{Enter}" : " ");
    }
    expect(mocks.back).toHaveBeenCalledOnce();
    expect(mocks.push).not.toHaveBeenCalled();
});

it.each(["click", "Enter", "Space"])("U-S08 F2 %sでurl指定があれば指定先へ一度だけ遷移", async (action) => {
    render(<Back url="/item/501" />);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "戻る" });
    if (action === "click") await user.click(button);
    else {
        await user.tab();
        expect(button).toHaveFocus();
        await user.keyboard(action === "Enter" ? "{Enter}" : " ");
    }
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/item/501");
    expect(mocks.back).not.toHaveBeenCalled();
});
