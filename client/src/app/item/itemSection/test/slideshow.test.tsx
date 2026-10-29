import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Slideshow } from "../slideshow";

// Swiperの描画だけを代替し、拡大画像選択のReact状態を実処理で確認する。
vi.mock("swiper/react", () => ({
    Swiper: ({
        children,
        initialSlide,
        className,
    }: {
        children: ReactNode;
        initialSlide?: number;
        className?: string;
    }) => (
        <div
            data-testid={initialSlide === undefined ? "slideshow" : "modal"}
            data-initial-slide={initialSlide}
            className={className}
        >
            {children}
        </div>
    ),
    SwiperSlide: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("スライドショー", () => {
    it.each([1, 3])("U-N10 %s枚の画像を表示する", (count) => {
        render(<Slideshow images={Array.from({ length: count }, (_, i) => `/image${i}.png`)} />);
        expect(screen.getAllByRole("img")).toHaveLength(count);
        for (let i = 0; i < count; i++) expect(screen.getByAltText(`Slide ${i + 1}`)).toBeInTheDocument();
    });
    it("U-N10 2枚目を拡大し選択位置を保ちXで閉じる", async () => {
        const { container } = render(<Slideshow images={["/one.png", "/two.png", "/three.png"]} />);
        const user = userEvent.setup();
        await user.click(screen.getByAltText("Slide 2"));
        expect(screen.getByTestId("modal")).toHaveAttribute("data-initial-slide", "1");
        expect(screen.getByAltText("全画面スライド 2")).toBeInTheDocument();
        const close = container.querySelector("svg");
        expect(close).not.toBeNull();
        await user.click(close!);
        expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
    });
    it("Q08 拡大と閉じるをキーボードだけで操作できる", async () => {
        render(<Slideshow images={["/one.png", "/two.png"]} />);
        const user = userEvent.setup();
        await user.tab();
        const trigger = screen.getAllByRole("button", { name: /画像|Slide|拡大/ })[0];
        expect(trigger).toHaveFocus();
        await user.keyboard("{Enter}");
        expect(screen.getByTestId("modal")).toBeInTheDocument();
        await user.tab();
        expect(screen.getByRole("button", { name: /閉じる/ })).toHaveFocus();
        await user.keyboard("{Enter}");
        expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
    });
});
