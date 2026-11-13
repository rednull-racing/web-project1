import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { UploadedItemList } from "@/app/item-list/uploaded/uploadedItemList";
import { server } from "../../../../../fixtures/server";
import { base, deferred, response, row } from "../../../../../fixtures/item-list/uploaded/fixtures";
import { mount } from "../../../../../fixtures/item-list/uploaded/setup";

vi.mock("@/lib/getAccessToken", () => ({ getAccessToken: async () => "test-token" }));

describe("uploaded SWR HTTP integration", () => {
    it.each([["all", null], ["selling", "active"], ["sold", "soldout"]] as const)(
        "I-N01 %s wireと認証ヘッダー", async (tab, status) => {
            const requests: Request[] = [];
            server.use(http.get(`${base}/items/list/uploaded`, ({ request }) => {
                requests.push(request); return HttpResponse.json(response());
            }));
            mount(<UploadedItemList uploadedTab={tab} />);
            expect(await screen.findByRole("link", { name: /出品シャツ/ })).toHaveAttribute("href", "/item/101");
            expect(new URL(requests[0].url).searchParams.get("status")).toBe(status);
            expect(new URL(requests[0].url).searchParams.get("page")).toBe("1");
            expect(requests[0].headers.get("Authorization")).toBe("Bearer test-token");
        });
    it("I-N02 ページ切替・入力でページ1・Enter確定・空白解除", async () => {
        const queries: URLSearchParams[] = [];
        server.use(http.get(`${base}/items/list/uploaded`, ({ request }) => {
            const q = new URL(request.url).searchParams; queries.push(q);
            return HttpResponse.json({ ...response(), itemList: [{ item: row({ name: `page${q.get("page")}:${q.get("keyword") ?? "none"}` }) }] });
        }));
        mount(<UploadedItemList uploadedTab="all" />);
        await screen.findByText("page1:none");
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "2" }));
        await screen.findByText("page2:none");
        await user.type(screen.getByPlaceholderText("検索"), "日本 &%");
        await screen.findByText("page1:none");
        expect(queries.every((q) => !q.has("keyword"))).toBe(true);
        await user.keyboard("{Enter}");
        await screen.findByText("page1:日本 &%");
        await user.clear(screen.getByPlaceholderText("検索"));
        await screen.findByText("page1:none");
        await waitFor(() => expect(queries.at(-1)?.has("keyword")).toBe(false));
    });
    it("I-N03 アイコン検索・空配列でpagination非表示", async () => {
        server.use(http.get(`${base}/items/list/uploaded`, ({ request }) =>
            HttpResponse.json(new URL(request.url).searchParams.has("keyword") ? { itemList: [], totalPages: 0 } : response())));
        const { container } = mount(<UploadedItemList uploadedTab="all" />);
        await screen.findByText("出品シャツ");
        const user = userEvent.setup();
        await user.type(screen.getByPlaceholderText("検索"), "なし");
        const icon = container.querySelector('[data-icon="magnifying-glass"]');
        if (!icon) throw new Error("検索アイコンなし");
        await user.click(icon);
        await screen.findByText("商品が見つかりません");
        expect(screen.queryByRole("button", { name: "2" })).not.toBeInTheDocument();
    });
    it("I-A01 遅い旧応答による上書きを防ぐ", async () => {
        const gate = deferred(), started = deferred(), finished = deferred();
        server.use(http.get(`${base}/items/list/uploaded`, async ({ request }) => {
            const keyword = new URL(request.url).searchParams.get("keyword");
            if (keyword === "旧") { started.resolve(); await gate.promise; finished.resolve(); }
            return HttpResponse.json({ itemList: [{ item: row({ name: keyword ?? "初期" }) }], totalPages: 1 });
        }));
        mount(<UploadedItemList uploadedTab="all" />);
        await screen.findByText("初期");
        const user = userEvent.setup();
        try {
            await user.type(screen.getByPlaceholderText("検索"), "旧{Enter}");
            await started.promise;
            await user.clear(screen.getByPlaceholderText("検索"));
            await user.type(screen.getByPlaceholderText("検索"), "新{Enter}");
            await screen.findByRole("heading", { name: "新" });
        } finally { await act(async () => { gate.resolve(); await finished.promise; }); }
        expect(screen.getByRole("heading", { name: "新" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "旧" })).not.toBeInTheDocument();
    });
    it("I-E01 500は0件と同じ案内・再マウントで復帰", async () => {
        const seen = deferred();
        server.use(http.get(`${base}/items/list/uploaded`, () => { seen.resolve(); return new HttpResponse(null, { status: 500 }); }));
        const view = mount(<UploadedItemList uploadedTab="all" />);
        await act(async () => seen.promise);
        await screen.findByText("商品が見つかりません");
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
        view.unmount();
        server.use(http.get(`${base}/items/list/uploaded`, () => HttpResponse.json(response())));
        mount(<UploadedItemList uploadedTab="all" />);
        await screen.findByText("出品シャツ");
    });
});
