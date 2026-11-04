import { API, runtime } from "@/../test/fixtures/upload/itemUploadPage/setup";
import { deferred, emptySigned, formProps } from "@/../test/fixtures/upload/itemUploadPage/fixtures";
import { server } from "@/../test/fixtures/server";
import { Form } from "@/app/upload/form";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";

const stages = ["save", "video", "convert", "thumbnail", "item", "attribute"] as const;
for (const action of ["main", "draft"] as const) {
    it.each(["none", ...stages] as const)(`C04 C05 C06 ${action}: %sで停止・後続なし`, async (failure) => {
        const events: string[] = [];
        const signed = {
            ...emptySigned(), videoSignedUrl: { url: "http://storage.test/video", fields: { key: "test-video" } },
            thumbnailSignedUrl: "http://storage.test/thumbnail",
            itemImageSignedUrls: [{ index: 1, url: "http://storage.test/item" }],
            attributesImageSignedUrls: { "color-0": "http://storage.test/attribute" },
        };
        const handle = (stage: typeof stages[number]) => {
            events.push(stage);
            return stage === failure ? HttpResponse.json({ code: "FAIL" }, { status: 500 }) : HttpResponse.json(stage === "save" ? signed : {});
        };
        const method = action === "main" ? http.put : http.post;
        server.use(
            method(`${API}/${action === "main" ? "item-editing/123" : "item-draft"}`, () => handle("save")),
            http.post("http://storage.test/video", async ({ request }) => {
                expect(request.headers.get("authorization")).toBeNull();
                expect(request.headers.get("content-type")).toContain("multipart/form-data");
                return handle("video");
            }),
            http.patch(`${API}/${action === "main" ? "item-editing/123" : "item-draft/456"}/convert`, ({ request }) => {
                expect(request.headers.get("authorization")).toBe("Bearer test-access-token");
                return handle("convert");
            }),
            http.get(`${API}/${action === "main" ? "item-editing/123/form" : "item-draft/456/item-page"}`, () => HttpResponse.json({
                [action === "main" ? "itemEditing" : "itemDraft"]: { video_status: "converted", converted_url: events.includes("convert") ? "new.m3u8" : "old.m3u8" },
            })),
            ...(["thumbnail", "item", "attribute"] as const).map((stage) => http.put(`http://storage.test/${stage}`, ({ request }) => {
                expect(request.headers.get("authorization")).toBeNull();
                expect(request.headers.get("content-type")).toBe("image/jpeg");
                return handle(stage);
            })),
        );
        render(<Form {...formProps()} />);
        const file = (name: string, type: string) => new File([name], name, { type });
        fireEvent.change(screen.getByPlaceholderText("動画ファイルをアップロード"), { target: { files: [file("new.mp4", "video/mp4")] } });
        fireEvent.change(screen.getByPlaceholderText("画像ファイルをアップロード"), { target: { files: [file("thumb.jpg", "image/jpeg")] } });
        fireEvent.change(screen.getByPlaceholderText("商品画像をアップロード"), { target: { files: [file("item.jpg", "image/jpeg")] } });
        fireEvent.change(screen.getAllByPlaceholderText("画像をアップロード")[0], { target: { files: [file("red.jpg", "image/jpeg")] } });
        await userEvent.click(screen.getByRole("button", { name: action === "main" ? "出品する" : "下書き保存する" }));
        if (failure === "none") {
            await waitFor(() => expect(runtime.assign).toHaveBeenCalledTimes(1));
            expect(events).toEqual(stages);
            expect(runtime.error).not.toHaveBeenCalled();
        } else {
            await waitFor(() => expect(runtime.error).toHaveBeenCalledTimes(1));
            expect(events).toEqual(stages.slice(0, stages.indexOf(failure) + 1));
            expect(runtime.success).not.toHaveBeenCalled();
            expect(runtime.assign).not.toHaveBeenCalled();
            expect(runtime.sleep).not.toHaveBeenCalled();
        }
        if (failure !== "none") {
            const button = screen.getByRole("button", { name: action === "main" ? "出品する" : "下書き保存する" });
            expect(button).toBeEnabled();
        }
    });
}

it("AF-F9 動画変換202受付では遷移せずconvertedを確認して進む", async () => {
    let converted = false; let accepted = false;
    const polled = deferred<void>();
    server.use(
        http.put(`${API}/item-editing/123`, () => HttpResponse.json({ ...emptySigned(), videoSignedUrl: { url: "http://storage.test/video", fields: { key: "test-video" } } })),
        http.post("http://storage.test/video", () => new HttpResponse(null, { status: 204 })),
        http.patch(`${API}/item-editing/123/convert`, () => { accepted = true; return HttpResponse.json({ message: "変換処理を受け付けました" }, { status: 202 }); }),
        http.get(`${API}/item-editing/123/form`, () => {
            if (accepted) polled.resolve();
            return HttpResponse.json({ itemEditing: { video_status: !accepted ? "converted" : converted ? "converted" : "processing",
                converted_url: converted ? "new.m3u8" : "old.m3u8" } });
        }),
    );
    render(<Form {...formProps()} />);
    fireEvent.change(screen.getByPlaceholderText("動画ファイルをアップロード"), { target: { files: [new File(["video"], "v.mp4", { type: "video/mp4" })] } });
    await userEvent.click(screen.getByRole("button", { name: "出品する" }));
    await polled.promise;
    expect(runtime.assign).not.toHaveBeenCalled();
    expect(runtime.success).not.toHaveBeenCalled();
    converted = true;
    await waitFor(() => expect(runtime.assign).toHaveBeenCalledExactlyOnceWith("/item/confirm/123"), { timeout: 3000 });
});
