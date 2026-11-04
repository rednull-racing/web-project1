import { beforeEach, expect, it, vi } from "vitest";
import { fetchUploadPage } from "../server";
const apiFetchServer = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/server", () => ({ apiFetchServer }));
beforeEach(() => { apiFetchServer.mockReset(); });
it("U17 form GETはno-store、7キーを保持", async () => { const response = { itemEditing: { id: 123 }, category: [], allCondition: [], allDay: [], allService: [], allPlace: [], hasShop: false }; apiFetchServer.mockResolvedValue(response); expect(await fetchUploadPage("123")).toBe(response); expect(apiFetchServer).toHaveBeenCalledExactlyOnceWith("/item-editing/123/form", { cache: "no-store" }); });
it("U17 server例外伝播", async () => { const error = new Error("failed"); apiFetchServer.mockRejectedValue(error); await expect(fetchUploadPage("123")).rejects.toBe(error); });
