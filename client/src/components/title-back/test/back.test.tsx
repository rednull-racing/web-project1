import { fireEvent, render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Back } from "../back";
const mocks = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks }));
it("U-S08 confirmの戻るは履歴へ戻る要求のみ", () => {
    const { container } = render(<Back />); const icon = container.querySelector("svg");
    expect(icon).not.toBeNull(); fireEvent.click(icon!);
    expect(mocks.back).toHaveBeenCalledOnce(); expect(mocks.push).not.toHaveBeenCalled();
});
