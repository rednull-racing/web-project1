import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDraft, createEmptyDraft, deepFreeze } from "@/../test/fixtures/item/itemDraftPage/fixtures";
import { VideoSection } from "../videoSection";

const mocks = vi.hoisted(() => ({
    video: vi.fn(),
    title: vi.fn(),
    peek: vi.fn(),
    summary: vi.fn(),
    time: vi.fn(() => "1時間前"),
}));
vi.mock("@/lib/formatRelativeTime", () => ({ formatRelativeTime: mocks.time }));
vi.mock("../../videoSection/videoElem", () => ({
    VideoElem: (props: unknown) => {
        mocks.video(props);
        return <div>video</div>;
    },
}));
vi.mock("../../videoSection/videoTitle", () => ({
    VideoTitle: (props: unknown) => {
        mocks.title(props);
        return <div>title</div>;
    },
}));
vi.mock("../../videoSection/itemPeek", () => ({
    ItemPeek: (props: unknown) => {
        mocks.peek(props);
        return <div>peek</div>;
    },
}));
vi.mock("../../videoSection/summary", () => ({
    Summary: (props: unknown) => {
        mocks.summary(props);
        return <div>summary</div>;
    },
}));

describe("VideoSection 単体", () => {
    it("U-V02 全入力の変換・updatedAt・下書きフラグと入力非破壊", () => {
        const draft = deepFreeze(createDraft());
        const before = structuredClone(draft);
        const { container } = render(<VideoSection itemDraft={draft} soldout={true} />);
        expect(Array.from(container.firstElementChild?.children ?? []).map((node) => node.textContent)).toEqual([
            "video",
            "title",
            "peek",
            "保存日時：1時間前",
            "summary",
        ]);
        expect(mocks.video).toHaveBeenCalledWith({
            normalPage: false,
            data: {
                thumbnailUrl: draft.thumbnail_url,
                originalUrl: draft.original_url,
                convertedUrl: draft.converted_url,
            },
        });
        expect(mocks.title).toHaveBeenCalledWith({ title: draft.title });
        expect(mocks.peek).toHaveBeenCalledWith({
            data: {
                itemName: draft.name,
                price: 800,
                firstImageUrl: draft.first_image_url,
                genderType: "men",
                ageType: "adult",
                soldout: true,
            },
        });
        expect(mocks.summary).toHaveBeenCalledWith({
            normalPage: false,
            data: { itemId: null, summary: draft.summary, soldout: true },
        });
        expect(mocks.time).toHaveBeenCalledExactlyOnceWith(draft.updatedAt);
        expect(screen.getByText("保存日時：")).toBeInTheDocument();
        expect(screen.getByText("1時間前")).toBeInTheDocument();
        expect(draft).toEqual(before);
    });
    it("U-V02 未入力を表示用に補完する", () => {
        render(<VideoSection itemDraft={createEmptyDraft()} soldout={false} />);
        expect(mocks.video).toHaveBeenCalledWith({
            normalPage: false,
            data: { thumbnailUrl: "/no-image(16x9).png", originalUrl: "", convertedUrl: null },
        });
        expect(mocks.title).toHaveBeenCalledWith({ title: "タイトル未入力" });
        expect(mocks.peek).toHaveBeenCalledWith({
            data: {
                itemName: "商品名未入力",
                price: "-",
                firstImageUrl: "/no-image(1x1).png",
                genderType: "men",
                ageType: "adult",
                soldout: false,
            },
        });
        expect(mocks.summary).toHaveBeenCalledWith({
            normalPage: false,
            data: { itemId: null, summary: "", soldout: false },
        });
    });
    it.each([
        { first_image_url: "/first.png", image_url: ["/a.png"], expected: "/first.png" },
        { first_image_url: "", image_url: ["", "/a.png", "/b.png"], expected: "/a.png" },
        { first_image_url: null, image_url: [], expected: "/no-image(1x1).png" },
        { first_image_url: null, image_url: [""], expected: "/no-image(1x1).png" },
    ])("U-V02 画像優先順位 $expected", ({ first_image_url, image_url, expected }) => {
        render(<VideoSection itemDraft={createDraft({ first_image_url, image_url })} soldout={false} />);
        expect(mocks.peek.mock.calls[0][0].data.firstImageUrl).toBe(expected);
    });
    it.each([0, 1, null])("U-V02 price=%sを未入力と混同しない", (price) => {
        render(<VideoSection itemDraft={createDraft({ price })} soldout={false} />);
        expect(mocks.peek.mock.calls[0][0].data.price).toBe(price ?? "-");
    });
    it.each(["", null])("U-V02 空文字とnullの商品名・タイトルを補完する %s", (name) => {
        render(<VideoSection itemDraft={createDraft({ name, title: name, thumbnail_url: name })} soldout={false} />);
        expect(mocks.title).toHaveBeenCalledWith({ title: "タイトル未入力" });
        expect(mocks.peek.mock.calls[0][0].data.itemName).toBe("商品名未入力");
        expect(mocks.video.mock.calls[0][0].data.thumbnailUrl).toBe("/no-image(16x9).png");
    });
});
