import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VideoElem } from "../videoElem";

const hls = vi.hoisted(() => ({
    supported: vi.fn(), loadSource: vi.fn(), attachMedia: vi.fn(), destroy: vi.fn(), play: vi.fn(),
}));
vi.mock("hls.js", () => ({
    default: class Hls {
        static isSupported = hls.supported;
        loadSource = hls.loadSource;
        attachMedia = hls.attachMedia;
        destroy = hls.destroy;
    },
}));
vi.mock("../../api/video", () => ({ fetchOnPlay: hls.play }));
const media = { videoId: "99", thumbnailUrl: "/poster.png", convertedUrl: "/converted.m3u8", originalUrl: "/original.mp4" };

beforeEach(() => { hls.supported.mockReturnValue(true); });
describe("下書き動画", () => {
    it("U-N07 HLSを変換URLで開始しunmount時に破棄する", () => {
        const { container, unmount } = render(<VideoElem data={media} normalPage={false} />);
        const video = container.querySelector("video");
        expect(video).toHaveAttribute("poster", media.thumbnailUrl);
        expect(video).toHaveAttribute("controls");
        expect(video).toHaveAttribute("playsinline");
        expect(hls.loadSource).toHaveBeenCalledWith(media.convertedUrl);
        expect(hls.attachMedia).toHaveBeenCalledWith(video);
        expect(hls.destroy).not.toHaveBeenCalled();
        unmount();
        expect(hls.destroy).toHaveBeenCalledTimes(1);
    });
    it("U-N07 URL更新で旧HLSを破棄してから次を読み込みMP4にも切り替える", () => {
        const { container, rerender, unmount } = render(<VideoElem data={media} normalPage={false} />);
        rerender(<VideoElem data={{ ...media, convertedUrl: "/second.m3u8" }} normalPage={false} />);
        expect(hls.destroy).toHaveBeenCalledTimes(1);
        expect(hls.loadSource).toHaveBeenNthCalledWith(2, "/second.m3u8");
        expect(hls.attachMedia).toHaveBeenCalledTimes(2);
        expect(hls.destroy.mock.invocationCallOrder[0]).toBeLessThan(hls.loadSource.mock.invocationCallOrder[1]);
        rerender(<VideoElem data={{ ...media, convertedUrl: null, originalUrl: "/updated.mp4" }} normalPage={false} />);
        expect(hls.destroy).toHaveBeenCalledTimes(2);
        expect(hls.loadSource).toHaveBeenCalledTimes(2);
        expect(container.querySelector("video")).toHaveAttribute("src", "/updated.mp4");
        unmount();
        expect(hls.destroy).toHaveBeenCalledTimes(2);
    });
    it.each([
        [false, "/converted.m3u8", "/converted.m3u8"],
        [true, null, "/original.mp4"],
        [true, "/converted.mp4", "/converted.mp4"],
    ])("U-N07 HLS対応=%s 変換URL=%s でsrc=%s", (supported, convertedUrl, expected) => {
        hls.supported.mockReturnValue(supported);
        const { container } = render(<VideoElem data={{ ...media, convertedUrl }} normalPage={false} />);
        expect(container.querySelector("video")).toHaveAttribute("src", expected);
        expect(hls.loadSource).not.toHaveBeenCalled();
    });
    it("U-N07 動画がなければ代替文を表示する", () => {
        const { container } = render(<VideoElem data={{ ...media, convertedUrl: null, originalUrl: "" }} normalPage={false} />);
        expect(screen.getByText("動画がありません。")).toBeVisible();
        expect(container.querySelector("video")).toBeNull();
        expect(hls.attachMedia).not.toHaveBeenCalled();
    });
    it("U-N07 下書きで再生しても集計APIを呼ばない", () => {
        const { container } = render(<VideoElem data={media} normalPage={false} />);
        const video = container.querySelector("video");
        expect(video).not.toBeNull();
        fireEvent.play(video!);
        expect(hls.play).not.toHaveBeenCalled();
    });
    it("Q10 空の変換URLなら有効な元MP4を設定する", () => {
        const { container } = render(<VideoElem data={{ ...media, convertedUrl: "" }} normalPage={false} />);
        expect(container.querySelector("video")).toHaveAttribute("src", media.originalUrl);
    });
});
