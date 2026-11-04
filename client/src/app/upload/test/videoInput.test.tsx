import { createRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VideoInput, type VideoInputValue } from "../videoInput";

const initial = (): VideoInputValue => ({
    videoFile: null,
    thumbnailFile: null,
    thumbnailPreview: null,
    title: "",
    summary: "",
    videoUploaded: true,
    thumbnailUploaded: true,
});
function setup(existingVideoUrl: string | null = null) {
    const change = vi.fn();
    function Host() {
        const [value, setValue] = useState(initial);
        return (
            <VideoInput
                value={value}
                onChange={(next) => {
                    change(next);
                    setValue(next);
                }}
                videoRef={createRef()}
                thumbnailRef={createRef()}
                existingVideoUrl={existingVideoUrl}
            />
        );
    }
    return { ...render(<Host />), change };
}
beforeEach(() => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-preview");
    vi.spyOn(window, "alert").mockImplementation(() => {});
});
describe("VideoInput", () => {
    it.each([-1, 0, 1])("U06 動画500MiB%+dの境界", async (offset) => {
        const { change } = setup("https://example.test/old.mp4");
        const input = screen.getByPlaceholderText("動画ファイルをアップロード");
        const file = new File(["small"], "clip.mp4", { type: "video/mp4" });
        Object.defineProperty(file, "size", { value: 500 * 1024 * 1024 + offset });
        await userEvent.upload(input, file);
        if (offset > 0) {
            expect(change).not.toHaveBeenCalled();
            expect(window.alert).toHaveBeenCalledWith("動画は500MB以内にしてください");
            expect(input).toHaveValue("");
        } else {
            expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ videoFile: file, videoUploaded: false }));
            expect(document.querySelector("video")).toHaveAttribute("src", "blob:test-preview");
        }
    });
    it("U06 未選択で値を変えず既存動画/代替サムネイルを表示", () => {
        const { change } = setup("https://example.test/old.mp4");
        fireEvent.change(screen.getByPlaceholderText("動画ファイルをアップロード"), { target: { files: [] } });
        expect(change).not.toHaveBeenCalled();
        expect(document.querySelector("video")).toHaveAttribute("src", "https://example.test/old.mp4");
        expect(screen.getByAltText("サムネイル").getAttribute("src")).toContain("no-image");
    });
    it("U06 サムネイル差替えで新規フラグとプレビュー", async () => {
        const { change } = setup();
        const file = new File(["image"], "thumb.png", { type: "image/png" });
        await userEvent.upload(screen.getByPlaceholderText("画像ファイルをアップロード"), file);
        expect(change).toHaveBeenLastCalledWith(
            expect.objectContaining({ thumbnailFile: file, thumbnailUploaded: false, thumbnailPreview: null }),
        );
    });
    it.each([
        [49, 499],
        [50, 500],
        [51, 501],
    ])("U07 動画文字数 %d/%d のUI上限と他値保持", async (titleLength, summaryLength) => {
        const { change } = setup();
        fireEvent.change(screen.getByPlaceholderText("動画のタイトル（50文字以内）"), {
            target: { value: "あ".repeat(48) },
        });
        await userEvent.type(
            screen.getByPlaceholderText("動画のタイトル（50文字以内）"),
            "あ".repeat(titleLength - 48),
        );
        fireEvent.change(screen.getByPlaceholderText("概要（500文字まで）"), { target: { value: "い".repeat(498) } });
        await userEvent.type(screen.getByPlaceholderText("概要（500文字まで）"), "い".repeat(summaryLength - 498));
        expect(screen.getByPlaceholderText("動画のタイトル（50文字以内）")).toHaveValue(
            "あ".repeat(Math.min(titleLength, 50)),
        );
        expect(screen.getByPlaceholderText("概要（500文字まで）")).toHaveValue(
            "い".repeat(Math.min(summaryLength, 500)),
        );
        expect(change).toHaveBeenLastCalledWith(
            expect.objectContaining({ videoUploaded: true, thumbnailUploaded: true }),
        );
    });
    it("Q06 MIME偽装を直接changeするとacceptだけでは拒否しない（観測）", () => {
        const { change } = setup();
        const file = new File(["text"], "fake.txt", { type: "text/plain" });
        fireEvent.change(screen.getByPlaceholderText("動画ファイルをアップロード"), { target: { files: [file] } });
        expect(change).toHaveBeenCalledWith(expect.objectContaining({ videoFile: file }));
    });
    it("AF-F8 動画再描画ではURLを再生成せずunmountで解放", async () => {
        const revoke = vi.spyOn(URL, "revokeObjectURL");
        const { unmount } = setup();
        await userEvent.upload(
            screen.getByPlaceholderText("動画ファイルをアップロード"),
            new File(["clip"], "clip.mp4", { type: "video/mp4" }),
        );
        await userEvent.type(screen.getByPlaceholderText("動画のタイトル（50文字以内）"), "x");
        unmount();
        expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
        expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:test-preview");
    });
});

it("AF-F8 サムネイル差替え時とunmount時に生成URLを解放する", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const { unmount } = setup();
    const input = screen.getByPlaceholderText("画像ファイルをアップロード");
    await userEvent.upload(input, new File(["a"], "a.png", { type: "image/png" }));
    await userEvent.type(screen.getByPlaceholderText("動画のタイトル（50文字以内）"), "変更");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    await userEvent.upload(input, new File(["b"], "b.png", { type: "image/png" }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(revoke).toHaveBeenCalledTimes(1);
    unmount();
    expect(revoke).toHaveBeenCalledTimes(2);
});
