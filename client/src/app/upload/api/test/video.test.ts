import { beforeEach, expect, it, vi } from "vitest";
import { fetchDraftVideoConvert, fetchVideoConvert } from "../video";
const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ apiFetch }));
beforeEach(() => { apiFetch.mockReset(); });
it.each([["editing", () => fetchVideoConvert("123"), "/item-editing/123/convert"], ["draft", () => fetchDraftVideoConvert(456), "/item-draft/456/convert"]] as const)("U19 %sの変換PATCH", async (_, fn, path) => { const response = { ok: true }; apiFetch.mockResolvedValue(response); expect(await fn()).toBe(response); expect(apiFetch).toHaveBeenCalledExactlyOnceWith(path, { method: "PATCH" }); });
it.each([() => fetchVideoConvert("123"), () => fetchDraftVideoConvert(456)])("U19 変換例外伝播 %s", async fn => { const error = new Error("failed"); apiFetch.mockRejectedValue(error); await expect(fn()).rejects.toBe(error); });

it.each(["editing", "draft"] as const)("AF-F9 %s処理状態をno-storeで照会", async target => {
    const { fetchVideoConversionState } = await import("../video");
    const state = { video_status: "processing", converted_url: null };
    apiFetch.mockResolvedValue(target === "editing" ? { itemEditing: state } : { itemDraft: state });
    const controller = new AbortController();
    expect(await fetchVideoConversionState(target, 123, controller.signal)).toEqual(state);
    expect(apiFetch).toHaveBeenCalledExactlyOnceWith(target === "editing" ? "/item-editing/123/form" : "/item-draft/123/item-page", { cache: "no-store", signal: controller.signal });
});
it("AF-F9 処理状態応答に対象レコードがなければ拒否", async () => {
    const { fetchVideoConversionState } = await import("../video");
    apiFetch.mockResolvedValue({});
    await expect(fetchVideoConversionState("editing", 123)).rejects.toThrow("処理状態");
});
