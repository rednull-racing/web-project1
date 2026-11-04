import { beforeEach, expect, it, vi } from "vitest";
import { fetchDraftVideoConvert, fetchVideoConvert } from "../video";
const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ apiFetch }));
beforeEach(() => { apiFetch.mockReset(); });
it.each([["editing", () => fetchVideoConvert("123"), "/item-editing/123/convert"], ["draft", () => fetchDraftVideoConvert(456), "/item-draft/456/convert"]] as const)("U19 %sの変換PATCH", async (_, fn, path) => { const response = { ok: true }; apiFetch.mockResolvedValue(response); expect(await fn()).toBe(response); expect(apiFetch).toHaveBeenCalledExactlyOnceWith(path, { method: "PATCH" }); });
it.each([() => fetchVideoConvert("123"), () => fetchDraftVideoConvert(456)])("U19 変換例外伝播 %s", async fn => { const error = new Error("failed"); apiFetch.mockRejectedValue(error); await expect(fn()).rejects.toBe(error); });
