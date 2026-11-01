import "@/../test/fixtures/item/itemConfirmPage/setup";
import { createConfirm } from "@/../test/fixtures/item/itemConfirmPage/fixtures";
import { VideoSection } from "@/app/item/confirm/videoSection";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/../test/fixtures/server";
import { http, HttpResponse } from "msw";

const hls = vi.hoisted(() => ({ supported: vi.fn(() => false), load: vi.fn(), attach: vi.fn(), destroy: vi.fn() }));
vi.mock("hls.js", () => ({
    default: class {
        static isSupported = hls.supported;
        loadSource = hls.load;
        attachMedia = hls.attach;
        destroy = hls.destroy;
    },
}));
describe("VideoSection (async VideoTitleのみ同期代替)", () => {
    it.each(["mp4", "hls", "empty"])("C-N03 %s・保存日時・商品概要・説明開閉と閲覧API抑止", async (kind) => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-30T02:00:00Z"));
        hls.supported.mockReturnValue(kind === "hls");
        const reached = vi.fn();
        server.use(
            http.all("http://confirm-api.test/*", () => {
                reached();
                return HttpResponse.json({});
            }),
        );
        vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(200);
        vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(40);
        const data = createConfirm({
            summary: "長い概要".repeat(100),
            original_url: kind === "empty" ? "" : "/video.mp4",
            converted_url: kind === "hls" ? "/video.m3u8" : null,
        });
        const view = render(<VideoSection itemEditing={data} soldout={false} />);
        expect(screen.getByText("1時間前")).toBeInTheDocument();
        expect(screen.getByText("確認用動画")).toBeInTheDocument();
        expect(screen.getByText("確認用シャツ")).toBeInTheDocument();
        expect(screen.getByText("￥12,000")).toBeInTheDocument();
        const video = view.container.querySelector("video");
        if (kind === "empty") expect(screen.getByText("動画がありません。")).toBeInTheDocument();
        else {
            expect(video).toHaveAttribute("poster", "/test-thumb.png");
            fireEvent.play(video!);
            if (kind === "hls") {
                expect(hls.load).toHaveBeenCalledWith("/video.m3u8");
                expect(hls.attach).toHaveBeenCalledWith(video);
            } else expect(video).toHaveAttribute("src", "/video.mp4");
        }
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "...もっと見る" }));
        await user.click(screen.getByRole("button", { name: "閉じる" }));
        await act(async () => undefined);
        expect(reached).not.toHaveBeenCalled();
        view.unmount();
        if (kind === "hls") expect(hls.destroy).toHaveBeenCalledTimes(1);
    });
});
