import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Summary } from "../summary";
import { VideoElem } from "../videoElem";
const mocks = vi.hoisted(() => ({ sort: vi.fn(), play: vi.fn(), destroy: vi.fn(), load: vi.fn(), attach: vi.fn() }));
vi.mock("../../api/itemSection", () => ({ fetchItemSortAdd: mocks.sort }));
vi.mock("../../api/video", () => ({ fetchOnPlay: mocks.play }));
vi.mock("hls.js", () => ({
    default: class Hls {
        static isSupported() {
            return true;
        }
        loadSource = mocks.load;
        attachMedia = mocks.attach;
        destroy = mocks.destroy;
    },
}));
it.each([false, true])("U-S05 confirm概要はnormalPage省略・soldout=%sで加点しない", async (soldout) => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(120);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(40);
    render(<Summary data={{ itemId: null, summary: "確認画面の長い概要", soldout }} />);
    await userEvent.click(screen.getByRole("button", { name: "...もっと見る" }));
    expect(screen.getByText("確認画面の長い概要")).toHaveStyle({ maxHeight: "120px" });
    await userEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(mocks.sort).not.toHaveBeenCalled();
});
it("U-S05 空概要はもっと見るを表示しない", () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(0);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(0);
    render(<Summary data={{ itemId: null, summary: "", soldout: false }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("U-S06 confirm動画はnormalPage/videoId省略で集計せずHLSを破棄", () => {
    const { container, unmount } = render(
        <VideoElem
            data={{ thumbnailUrl: "/thumb.png", originalUrl: "/original.mp4", convertedUrl: "/converted.m3u8" }}
        />,
    );
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    fireEvent.play(video!);
    expect(mocks.load).toHaveBeenCalledExactlyOnceWith("/converted.m3u8");
    expect(mocks.attach).toHaveBeenCalledWith(video);
    expect(mocks.play).not.toHaveBeenCalled();
    unmount();
    expect(mocks.destroy).toHaveBeenCalledOnce();
});
