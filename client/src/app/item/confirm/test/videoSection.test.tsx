import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createEditing } from "./fixtures";
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
    it("U-N03 全入力の変換・updatedAt・確認フラグと入力非破壊", () => {
        const draft = createEditing();
        const before = structuredClone(draft);
        const { container } = render(<VideoSection itemEditing={draft} soldout={true} />);
        expect(Array.from(container.firstElementChild?.children ?? []).map((node) => node.textContent)).toEqual([
            "video",
            "title",
            "peek",
            "保存日時：1時間前",
            "summary",
        ]);
        expect(mocks.video).toHaveBeenCalledWith({
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
                price: 12000,
                firstImageUrl: draft.first_image_url,
                genderType: "men",
                ageType: "adult",
                soldout: true,
            },
        });
        expect(mocks.summary).toHaveBeenCalledWith({
            data: { itemId: null, summary: draft.summary, soldout: true },
        });
        expect(mocks.time).toHaveBeenCalledExactlyOnceWith(draft.updatedAt);
        expect(screen.getByText("保存日時：")).toBeInTheDocument();
        expect(screen.getByText("1時間前")).toBeInTheDocument();
        expect(draft).toEqual(before);
    });
    it("U-N03 summary nullは空文字、加点条件は渡さない", () => {
        render(<VideoSection itemEditing={createEditing({ summary: null })} soldout={false} />);
        expect(mocks.summary).toHaveBeenCalledWith({ data: { itemId: null, summary: "", soldout: false } });
    });
});
