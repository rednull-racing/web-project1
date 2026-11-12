import { render, screen } from "@testing-library/react";
import type { ComponentProps, ImgHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import { ItemImage } from "../itemImage";

vi.mock("next/image", () => ({
    default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
        // 画像最適化を除き、対象から渡されたDOM属性を検証する。
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img {...props} />
    ),
}));

const fixture = (): ComponentProps<typeof ItemImage> => ({
    data: { first_image_url: "/test-item.jpg", status: "active" },
    showSold: true,
});

const expectImage = (src: string) => {
    expect(screen.getAllByRole("img", { name: "商品画像" })).toHaveLength(1);
    const image = screen.getByRole("img", { name: "商品画像" });
    expect(image).toHaveAttribute("src", src);
    expect(image).toHaveAttribute("width", "80");
    expect(image).toHaveAttribute("height", "80");
};

describe("ItemImageの画像と売切れ表示", () => {
    it("U-I01 指定画像を1枚、指定寸法と代替テキストで表示する", () => {
        render(<ItemImage {...fixture()} />);
        expectImage("/test-item.jpg");
    });

    it("U-I02 空URLは代替画像を同じ寸法で表示する", () => {
        const props = fixture();
        props.data.first_image_url = "";
        render(<ItemImage {...props} />);
        expectImage("/no-image(1x1).png");
    });

    it.each([true, false].flatMap((showSold) =>
        (["active", "soldout", null] as const).map((status) => ({ showSold, status })),
    ))("U-I03 入力%jの売切れ条件を満たす場合だけ表示する", ({ showSold, status }) => {
        const props = fixture();
        render(<ItemImage {...props} showSold={showSold} data={{ ...props.data, status }} />);
        expectImage("/test-item.jpg");
        expect(screen.queryAllByText("SOLD")).toHaveLength(showSold && status === "soldout" ? 1 : 0);
    });

    it("U-I04 再描画した最新URLと売切れ条件だけを表示する", () => {
        const props = fixture();
        const { rerender } = render(<ItemImage {...props} data={{ ...props.data, status: "soldout" }} />);
        expect(screen.getAllByText("SOLD")).toHaveLength(1);
        rerender(<ItemImage showSold={false} data={{ first_image_url: "/second.jpg", status: "active" }} />);
        expectImage("/second.jpg");
        expect(screen.queryByText("SOLD")).not.toBeInTheDocument();
        rerender(<ItemImage showSold data={{ first_image_url: "/third.jpg", status: "soldout" }} />);
        expectImage("/third.jpg");
        expect(screen.getAllByText("SOLD")).toHaveLength(1);
    });
});
