import { act, renderHook } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { server } from "../../../../../test/fixtures/server";
import { useFileUpload } from "../useFileUpload";
import { params } from "./fixtures";
const calls = vi.hoisted(() => ({ editing: vi.fn(), draft: vi.fn(), state: vi.fn(), error: vi.fn() }));
vi.mock("../../api/video", () => ({ fetchVideoConvert: calls.editing, fetchDraftVideoConvert: calls.draft, fetchVideoConversionState: calls.state }));
vi.mock("react-hot-toast", () => ({ default: { error: calls.error } }));
const file = (name = "red", type = "image/png") => new File([name], `${name}.png`, { type });
const signed = { url: "https://storage.test/video", fields: { key: "v", policy: "test-policy" } };
beforeEach(() => {
    Object.values(calls).forEach(fn => fn.mockReset());
    calls.editing.mockResolvedValue({}); calls.draft.mockResolvedValue({});
    calls.state.mockResolvedValueOnce({ video_status: null, converted_url: null })
        .mockResolvedValue({ video_status: "converted", converted_url: "https://media.test/new.m3u8" });
});
it.each(["editing", "draft"] as const)("U20 AF-F9 %s POST→202受付→状態完了まで待機", async target => {
    const order: string[] = []; let text = "";
    server.use(http.post(signed.url, async ({ request }) => {
        order.push("post"); expect(request.headers.get("content-type")).toContain("multipart/form-data");
        expect(request.headers.get("authorization")).toBeNull(); text = await request.text();
        return new HttpResponse(null, { status: 204 });
    }));
    calls[target].mockImplementation(async () => { order.push("accepted"); });
    const { result } = renderHook(useFileUpload);
    const args = target === "editing" ? { target, itemEditingId: "123", videoFile: file("video", "video/mp4"), videoSignedUrl: signed } : { target, itemDraftId: 456, videoFile: file("video", "video/mp4"), videoSignedUrl: signed };
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const operation = result.current.videoUploadAndConvert(args);
    await vi.waitFor(() => expect(calls[target]).toHaveBeenCalledOnce());
    expect(order).toEqual(["post", "accepted"]);
    expect(calls.state).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(await operation).toBe(true);
    expect(calls.state).toHaveBeenLastCalledWith(target, target === "editing" ? "123" : 456, expect.any(AbortSignal));
    expect(text.indexOf('name="file"')).toBeGreaterThan(text.indexOf('name="policy"'));
    expect(await result.current.videoUploadAndConvert(args)).toBe(true);
    expect(calls[target]).toHaveBeenCalledOnce();
});
it("U21 動画なし・署名なしは既存動画として省略", async () => {
    const { result } = renderHook(useFileUpload);
    expect(await result.current.videoUploadAndConvert({ target: "editing", itemEditingId: "123", videoFile: null, videoSignedUrl: null })).toBe(true);
    expect(calls.editing).not.toHaveBeenCalled();
});
it.each(["file", "url"])("AF-F6 動画片方不足%sは失敗", async missing => {
    const { result } = renderHook(useFileUpload);
    expect(await result.current.videoUploadAndConvert({ target: "editing", itemEditingId: "123", videoFile: missing === "file" ? null : file(), videoSignedUrl: missing === "url" ? null : signed })).toBe(false);
    expect(calls.editing).not.toHaveBeenCalled();
});
it.each(["http", "network"])("U21 動画%s失敗で変換しない", async kind => {
    server.use(http.post(signed.url, () => kind === "http" ? new HttpResponse(null, { status: 500 }) : HttpResponse.error()));
    const { result } = renderHook(useFileUpload);
    const operation = result.current.videoUploadAndConvert({ target: "editing", itemEditingId: "123", videoFile: file(), videoSignedUrl: signed });
    if (kind === "network") await expect(operation).rejects.toThrow(); else expect(await operation).toBe(false);
    expect(calls.editing).not.toHaveBeenCalled();
});
it.each(["failed", "processing", "stale", "abort"])("AF-F9 %sは完了扱いしない", async kind => {
    server.use(http.post(signed.url, () => new HttpResponse(null, { status: 204 })));
    const old = { video_status: "converted", converted_url: "https://media.test/old.m3u8" };
    calls.state.mockReset().mockResolvedValueOnce(old).mockResolvedValue(kind === "stale" ? old : { video_status: kind, converted_url: null });
    const { result } = renderHook(useFileUpload);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const operation = result.current.videoUploadAndConvert({ target: "editing", itemEditingId: "123", videoFile: file(), videoSignedUrl: signed });
    await vi.waitFor(() => expect(calls.editing).toHaveBeenCalledOnce());
    if (kind === "abort") { result.current.cancelUploads(); await expect(operation).rejects.toMatchObject({ name: "AbortError" }); }
    else { await act(() => vi.advanceTimersByTimeAsync(kind === "failed" ? 1000 : 120000)); expect(await operation).toBe(false); }
});
it("AF-F9 processing後は同じURLのconvertedも新処理完了とする", async () => {
    server.use(http.post(signed.url, () => new HttpResponse(null, { status: 204 })));
    calls.state.mockReset().mockResolvedValueOnce({ video_status: "converted", converted_url: "same" })
        .mockResolvedValueOnce({ video_status: "processing", converted_url: null })
        .mockResolvedValue({ video_status: "converted", converted_url: "same" });
    const { result } = renderHook(useFileUpload);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const operation = result.current.videoUploadAndConvert({ target: "editing", itemEditingId: "123", videoFile: file(), videoSignedUrl: signed });
    await vi.waitFor(() => expect(calls.editing).toHaveBeenCalledOnce());
    await act(() => vi.advanceTimersByTimeAsync(2000)); expect(await operation).toBe(true);
});
it("AF-F6 サムネイル転送は成功したFileとURLの組だけ再送しない", async () => {
    const received: string[] = [];
    server.use(http.put("https://storage.test/:key", async ({ request }) => { received.push(await request.text()); expect(request.headers.get("authorization")).toBeNull(); expect(request.headers.get("content-type")).toBe("image/png"); return new HttpResponse(null, { status: 204 }); }));
    const { result } = renderHook(useFileUpload); const first = file("first");
    expect(await result.current.thumbnailUpload({ thumbnailFile: first, thumbnailSignedUrl: "https://storage.test/a" })).toBe(true);
    expect(await result.current.thumbnailUpload({ thumbnailFile: first, thumbnailSignedUrl: "https://storage.test/a" })).toBe(true);
    expect(await result.current.thumbnailUpload({ thumbnailFile: first, thumbnailSignedUrl: "https://storage.test/b" })).toBe(true);
    expect(received).toEqual(["first", "first"]);
});
it.each(["file", "url"])("AF-F6 サムネイル片方不足%sは失敗", async missing => {
    const { result } = renderHook(useFileUpload);
    expect(await result.current.thumbnailUpload({ thumbnailFile: missing === "file" ? null : file(), thumbnailSignedUrl: missing === "url" ? null : "https://storage.test/thumb" })).toBe(false);
});
it.each(["http", "network"])("U22 U23 U24 各画像%s失敗はfalse、再試行可能", async kind => {
    let fail = true;
    server.use(http.put("https://storage.test/image", () => fail ? kind === "http" ? new HttpResponse(null, { status: 500 }) : HttpResponse.error() : new HttpResponse(null, { status: 204 })));
    const { result } = renderHook(useFileUpload); const image = file();
    const values = params().attributesValue; values.colorVariants[0].image = image; values.colorVariants[0].image_uploaded = false;
    const operations = [() => result.current.thumbnailUpload({ thumbnailFile: image, thumbnailSignedUrl: "https://storage.test/image" }), () => result.current.itemImageUpload({ itemImageFiles: [{ id: "a", file: image, preview: "", uploaded: false }], itemImageSignedUrls: [{ index: 0, url: "https://storage.test/image" }] }), () => result.current.attributesImageUpload({ attributesValue: values, signedUrlMap: { red: "https://storage.test/image" } })];
    for (const operation of operations) expect(await operation()).toBe(false);
    fail = false; for (const operation of operations) expect(await operation()).toBe(true);
});
it("U23 AF-F6 商品画像はindexで解決し署名不足は失敗", async () => {
    const received: Record<string, string> = {};
    server.use(http.put("https://storage.test/:key", async ({ request, params: path }) => { received[String(path.key)] = await request.text(); return new HttpResponse(null, { status: 204 }); }));
    const files = ["a", "b"].map(name => ({ id: name, file: file(name), preview: "", uploaded: false }));
    const { result } = renderHook(useFileUpload);
    expect(await result.current.itemImageUpload({ itemImageFiles: files, itemImageSignedUrls: [] })).toBe(false);
    expect(await result.current.itemImageUpload({ itemImageFiles: files, itemImageSignedUrls: [{ index: 1, url: "https://storage.test/b" }, { index: 0, url: "https://storage.test/a" }] })).toBe(true);
    expect(received).toEqual({ a: "a", b: "b" });
});
it("AF-F4 逆順署名と画像なし色を挟んでもuiIdで対応", async () => {
    const received: Record<string, string> = {};
    server.use(http.put("https://storage.test/:color", async ({ request, params: path }) => { received[String(path.color)] = await request.text(); return new HttpResponse(null, { status: 204 }); }));
    const values = params().attributesValue; const red = values.colorVariants[0];
    values.colorVariants = [{ ...red, image: file("RED"), image_uploaded: false }, { ...red, _uiId: "none", image: null }, { ...red, _uiId: "blue", image: file("BLUE"), image_uploaded: false }];
    const { result } = renderHook(useFileUpload);
    expect(await result.current.attributesImageUpload({ attributesValue: values, signedUrlMap: { blue: "https://storage.test/blue", red: "https://storage.test/red" } })).toBe(true);
    expect(received).toEqual({ red: "RED", blue: "BLUE" });
});
it("AF-F4 削除色の署名を無視し残った色へ正しく転送", async () => {
    const received: string[] = [];
    server.use(http.put("https://storage.test/blue", async ({ request }) => { received.push(await request.text()); return new HttpResponse(null, { status: 204 }); }));
    const values = params().attributesValue; values.colorVariants[0] = { ...values.colorVariants[0], _uiId: "blue", image: file("BLUE"), image_uploaded: false };
    const { result } = renderHook(useFileUpload);
    expect(await result.current.attributesImageUpload({ attributesValue: values, signedUrlMap: { red: "https://storage.test/red", blue: "https://storage.test/blue" } })).toBe(true);
    expect(received).toEqual(["BLUE"]);
});
it("AF-F6 新規属性画像の署名欠落はfalse、既存だけならmap不要", async () => {
    const values = params().attributesValue; const { result } = renderHook(useFileUpload);
    expect(await result.current.attributesImageUpload({ attributesValue: values, signedUrlMap: null })).toBe(true);
    values.colorVariants[0].image = file(); values.colorVariants[0].image_uploaded = false;
    expect(await result.current.attributesImageUpload({ attributesValue: values, signedUrlMap: {} })).toBe(false);
});
it("AF-F6 unmountは実行中リクエストをabort", async () => {
    let signal: AbortSignal | undefined;
    const pending = new Promise<Response>((_, reject) => {
        vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
            signal = init?.signal ?? undefined;
            signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
            return pending;
        });
    });
    const { result, unmount } = renderHook(useFileUpload);
    const operation = result.current.thumbnailUpload({ thumbnailFile: file(), thumbnailSignedUrl: "https://storage.test/thumb" });
    unmount(); await expect(operation).rejects.toMatchObject({ name: "AbortError" }); expect(signal?.aborted).toBe(true);
});
it("AF-F6 成功した画像だけcallbackでstate同期し失敗画像を再試行", async () => {
    const uploaded = vi.fn(); const requests: string[] = []; let fail = true;
    server.use(http.put("https://storage.test/:key", ({ params: path }) => {
        requests.push(String(path.key));
        return new HttpResponse(null, { status: path.key === "b" && fail ? 500 : 204 });
    }));
    const { result } = renderHook(useFileUpload);
    const args = {
        itemImageFiles: ["a", "b"].map(id => ({ id, file: file(id), preview: "", uploaded: false })),
        itemImageSignedUrls: ["a", "b"].map((id, index) => ({ index, url: `https://storage.test/${id}` })),
        onUploaded: uploaded,
    };
    expect(await result.current.itemImageUpload(args)).toBe(false);
    expect(uploaded).toHaveBeenCalledWith("a"); expect(uploaded).not.toHaveBeenCalledWith("b");
    fail = false; expect(await result.current.itemImageUpload(args)).toBe(true);
    expect(requests.filter(id => id === "a")).toHaveLength(1);
    expect(requests.filter(id => id === "b")).toHaveLength(2);
    expect(uploaded).toHaveBeenCalledWith("b");
});
it.each(["state", "editing"] as const)("U21 AF-F9 %s例外で完了通知なし", async target => {
    server.use(http.post(signed.url, () => new HttpResponse(null, { status: 204 })));
    const error = new Error("conversion failed"); calls[target].mockRejectedValue(error);
    const uploaded = vi.fn(); const { result } = renderHook(useFileUpload);
    await expect(result.current.videoUploadAndConvert({ target: "editing", itemEditingId: "123", videoFile: file(), videoSignedUrl: signed, onUploaded: uploaded })).rejects.toBe(error);
    expect(uploaded).not.toHaveBeenCalled();
});
it("U24 署名なし・画像なしの既存属性はskip成功", async () => {
    const { result } = renderHook(useFileUpload);
    for (const signedUrlMap of [null, undefined, {}])
        expect(await result.current.attributesImageUpload({ attributesValue: params().attributesValue, signedUrlMap })).toBe(true);
});
it("AF-F6 兄弟失敗後の再試行は転送中の同File/URLを共有する", async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const counts = { a: 0, b: 0 };
    server.use(http.put("https://storage.test/:key", async ({ params: path }) => {
        const key = String(path.key) as "a" | "b";
        counts[key]++;
        if (key === "a") await gate;
        return new HttpResponse(null, { status: key === "b" && counts.b === 1 ? 500 : 204 });
    }));
    const { result } = renderHook(useFileUpload);
    const args = {
        itemImageFiles: ["a", "b"].map(id => ({ id, file: file(id), preview: "", uploaded: false })),
        itemImageSignedUrls: ["a", "b"].map((id, index) => ({ index, url: `https://storage.test/${id}` })),
    };
    expect(await result.current.itemImageUpload(args)).toBe(false);
    const retry = result.current.itemImageUpload(args);
    await vi.waitFor(() => expect(counts.b).toBe(2));
    expect(counts.a).toBe(1);
    release(); expect(await retry).toBe(true);
});
it("AF-F9 時間切れ再試行で進行中jobを再受付せず元baselineを保持", async () => {
    server.use(http.post(signed.url, () => new HttpResponse(null, { status: 204 })));
    calls.state.mockReset().mockResolvedValueOnce({ video_status: "converted", converted_url: "same" })
        .mockResolvedValue({ video_status: "processing", converted_url: null });
    const { result } = renderHook(useFileUpload);
    const args = { target: "editing" as const, itemEditingId: "123", videoFile: file(), videoSignedUrl: signed };
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const first = result.current.videoUploadAndConvert(args);
    await vi.waitFor(() => expect(calls.editing).toHaveBeenCalledTimes(1));
    await act(() => vi.advanceTimersByTimeAsync(120000));
    expect(await first).toBe(false);
    calls.state.mockResolvedValueOnce({ video_status: "processing", converted_url: null })
        .mockResolvedValue({ video_status: "converted", converted_url: "same" });
    const retry = result.current.videoUploadAndConvert(args);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(await retry).toBe(true);
    expect(calls.editing).toHaveBeenCalledTimes(1);
});
it("AF-F9 failed後の再試行は新しい変換を受付できる", async () => {
    server.use(http.post(signed.url, () => new HttpResponse(null, { status: 204 })));
    calls.state.mockReset().mockResolvedValueOnce({ video_status: null, converted_url: null })
        .mockResolvedValue({ video_status: "failed", converted_url: null });
    const { result } = renderHook(useFileUpload);
    const args = { target: "editing" as const, itemEditingId: "123", videoFile: file(), videoSignedUrl: signed };
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const first = result.current.videoUploadAndConvert(args);
    await vi.waitFor(() => expect(calls.editing).toHaveBeenCalledTimes(1));
    await act(() => vi.advanceTimersByTimeAsync(1000)); expect(await first).toBe(false);
    calls.state.mockResolvedValueOnce({ video_status: "failed", converted_url: null })
        .mockResolvedValue({ video_status: "converted", converted_url: "new" });
    const retry = result.current.videoUploadAndConvert(args);
    await vi.waitFor(() => expect(calls.editing).toHaveBeenCalledTimes(2));
    await act(() => vi.advanceTimersByTimeAsync(1000)); expect(await retry).toBe(true);
});
