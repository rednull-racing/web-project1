import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { StockItemList } from "@/app/item-list/stock/stockItemList";
import { server } from "../../../../../fixtures/server";
import { base, deferred, response, row } from "../../../../../fixtures/item-list/stock/fixtures";
import { mount } from "../../../../../fixtures/item-list/stock/setup";

vi.mock("@/lib/getAccessToken", () => ({ getAccessToken: async () => "test-token" }));

describe("stock SWR HTTP integration", () => {
    it("I-N01 wire・在庫・Bearer・status条件なし", async () => {
        const requests: Request[] = [];
        server.use(http.get(`${base}/items/list/stock`, ({ request }) => {
            requests.push(request); return HttpResponse.json(response());
        }));
        mount(<StockItemList />);
        expect(await screen.findByRole("link", { name: /出品シャツ/ })).toHaveAttribute("href", "/item/101");
        expect(screen.getByText("1,234")).toBeInTheDocument();
        expect(new URL(requests[0].url).searchParams.get("page")).toBe("1");
        expect(new URL(requests[0].url).searchParams.has("status")).toBe(false);
        expect(requests[0].headers.get("Authorization")).toBe("Bearer test-token");
    });
    it("I-N02 ページ切替・入力でページ1・Enter確定・空白解除", async () => {
        const queries: URLSearchParams[] = [];
        server.use(http.get(`${base}/items/list/stock`, ({ request }) => {
            const q = new URL(request.url).searchParams; queries.push(q);
            return HttpResponse.json({ ...response(), itemList: [{ item: row({ name: `page${q.get("page")}:${q.get("keyword") ?? "none"}` }) }] });
        }));
        mount(<StockItemList />);
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
        server.use(http.get(`${base}/items/list/stock`, ({ request }) =>
            HttpResponse.json(new URL(request.url).searchParams.has("keyword") ? { itemList: [], totalPages: 0 } : response())));
        const { container } = mount(<StockItemList />);
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
        server.use(http.get(`${base}/items/list/stock`, async ({ request }) => {
            const keyword = new URL(request.url).searchParams.get("keyword");
            if (keyword === "旧") { started.resolve(); await gate.promise; finished.resolve(); }
            return HttpResponse.json({ itemList: [{ item: row({ name: keyword ?? "初期" }) }], totalPages: 1 });
        }));
        mount(<StockItemList />);
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
    it("I-E01 500は空応答扱いしない・再マウントで復帰（観測）", async () => {
        const seen = deferred();
        server.use(http.get(`${base}/items/list/stock`, () => { seen.resolve(); return new HttpResponse(null, { status: 500 }); }));
        const view = mount(<StockItemList />);
        await act(async () => seen.promise);
        expect(screen.queryByText("商品が見つかりません")).not.toBeInTheDocument();
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
        view.unmount();
        server.use(http.get(`${base}/items/list/stock`, () => HttpResponse.json(response())));
        mount(<StockItemList />);
        await screen.findByText("出品シャツ");
    });
    it("I-V01 未取得では空案内なし、空配列応答後に表示", async () => {
        const gate = deferred();
        server.use(http.get(`${base}/items/list/stock`, async () => {
            await gate.promise;
            return HttpResponse.json({ itemList: [], totalPages: 0 });
        }));
        mount(<StockItemList />);
        try {
            expect(screen.queryByText("商品が見つかりません")).not.toBeInTheDocument();
        } finally { await act(async () => gate.resolve()); }
        await screen.findByText("商品が見つかりません");
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

});
