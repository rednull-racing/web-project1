import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../../../../fixtures/server";
import { base, deferred, response, row } from "../../../../../fixtures/item-list/trash/fixtures";
import { mount } from "../../../../../fixtures/item-list/trash/setup";

const ready = () => screen.findByRole("heading", { name: "検証用シャツ101" });
const search = async (value: string) => {
    const user = userEvent.setup();
    await user.clear(screen.getByPlaceholderText("検索"));
    await user.type(screen.getByPlaceholderText("検索"), value);
    await user.keyboard("{Enter}");
};

describe("削除済み商品一覧とHTTP・SWRの結合", () => {
    it.each([
        { price: 12345, expected: "12,345円", nullable: false },
        { price: "12345", expected: "12,345円", nullable: false },
        { price: 0, expected: "0円", nullable: true },
        { price: "0", expected: "0円", nullable: true },
    ])("C-N01 wire入力%jを変換せず認証GETと商品情報を接続する", async ({ price, expected, nullable }) => {
        const requests: { path: string; auth: string | null }[] = [];
        server.use(http.get(`${base}/item-trash/list`, ({ request }) => {
            requests.push({ path: new URL(request.url).pathname, auth: request.headers.get("authorization") });
            const itemTrash = { ...row(), price, name: nullable ? null : row().name,
                title: nullable ? null : row().title, first_image_url: nullable ? null : row().first_image_url };
            return HttpResponse.json({ itemTrashList: [{ itemTrash }], totalPages: 1 });
        }));
        mount();
        await screen.findByRole("heading", { name: expected });
        const link = screen.getByRole("link");
        expect(link).toHaveAttribute("href", "/item/deleted/101");
        expect(screen.getByText("削除日時:")).toBeInTheDocument();
        expect(screen.getByText("1時間前")).toBeInTheDocument();
        expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(nullable ? "" : "検証用シャツ101");
        expect(screen.getByRole("heading", { level: 4 }).textContent).toBe(nullable ? "" : "動画A");
        expect(screen.getByRole("img", { name: "商品画像" })).toHaveAttribute("src", nullable ? "/no-image(1x1).png" : "/test-item.jpg");
        expect(screen.queryByText("SOLD")).not.toBeInTheDocument();
        expect(requests).toEqual([{ path: "/api/item-trash/list", auth: "Bearer test-token" }]);
    });

    it("C-N02 入力だけでは検索せず送信後とページ2操作で取得条件を変更する", async () => {
        const urls: URL[] = [];
        server.use(http.get(`${base}/item-trash/list`, ({ request }) => {
            urls.push(new URL(request.url)); return HttpResponse.json(response());
        }));
        mount(); await ready(); const user = userEvent.setup();
        await user.type(screen.getByPlaceholderText("検索"), " シャツ ");
        expect(urls.map((url) => url.searchParams.get("keyword"))).toEqual([null]);
        await user.keyboard("{Enter}");
        await waitFor(() => expect(urls.at(-1)?.searchParams.get("keyword")).toBe("シャツ"));
        expect(urls.at(-1)?.searchParams.get("page")).toBe("1"); await ready();
        await user.click(screen.getByRole("button", { name: "2" }));
        await waitFor(() => expect(urls.at(-1)?.searchParams.get("page")).toBe("2"));
        expect(urls.at(-1)?.searchParams.get("keyword")).toBe("シャツ"); await ready();
    });

    it("C-N03 検索中のページ2から入力すると旧検索のページ1へ戻り空白で解除する", async () => {
        const urls: URL[] = [];
        server.use(http.get(`${base}/item-trash/list`, ({ request }) => {
            urls.push(new URL(request.url)); return HttpResponse.json(response());
        }));
        mount(); await ready(); await search("シャツ"); await ready(); const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "2" })); await ready();
        await user.type(screen.getByPlaceholderText("検索"), "赤");
        await waitFor(() => expect(urls.at(-1)?.searchParams.get("page")).toBe("1"));
        expect(urls.at(-1)?.searchParams.get("keyword")).toBe("シャツ");
        await user.clear(screen.getByPlaceholderText("検索")); await user.type(screen.getByPlaceholderText("検索"), "　");
        await waitFor(() => expect(urls.at(-1)?.searchParams.has("keyword")).toBe(false));
        expect(urls.at(-1)?.searchParams.get("page")).toBe("1"); await ready();
    });

    it("C-E01 遅延GET中に空案内を先走らせず空応答後だけ表示する", async () => {
        const gate = deferred<void>();
        server.use(http.get(`${base}/item-trash/list`, async () => {
            await gate.promise; return HttpResponse.json({ itemTrashList: [], totalPages: 0 });
        }));
        mount();
        try {
            expect(screen.getByPlaceholderText("検索")).toBeInTheDocument();
            expect(screen.queryByText("商品が見つかりません")).not.toBeInTheDocument();
            expect(screen.queryByRole("main")).not.toBeInTheDocument();
        } finally { await act(async () => gate.resolve()); }
        await screen.findByText("商品が見つかりません");
        expect(screen.queryByRole("main")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "1" })).not.toBeInTheDocument();
    });

    it.each(["401", "500", "429", "network"])("C-E02 %s失敗時は専用エラーなし、再mountのGET成功で回復する", async (failure) => {
        let failed = true; const completed = deferred<void>(); const methods: string[] = [];
        server.use(http.get(`${base}/item-trash/list`, ({ request }) => {
            methods.push(request.method); completed.resolve();
            if (!failed) return HttpResponse.json(response());
            if (failure === "network") return HttpResponse.error();
            if (failure === "429") return HttpResponse.text("Too many requests", { status: 429 });
            return HttpResponse.json({ code: "GET_FAILED" }, { status: Number(failure) });
        }));
        const first = mount();
        await act(async () => { await completed.promise; });
        expect(screen.getByPlaceholderText("検索")).toBeInTheDocument();
        expect(screen.queryByRole("main")).not.toBeInTheDocument();
        expect(screen.queryByText("商品が見つかりません")).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        first.unmount(); failed = false; mount(); await ready();
        expect(methods).toEqual(["GET", "GET"]);
    });

    it("C-E03 検索Aの遅い応答で新しい検索Bを上書きしない", async () => {
        const gate = deferred<void>(), started = deferred<void>();
        server.use(http.get(`${base}/item-trash/list`, async ({ request }) => {
            const keyword = new URL(request.url).searchParams.get("keyword");
            if (keyword === "A") { started.resolve(); await gate.promise; }
            return HttpResponse.json({ itemTrashList: [{ itemTrash: { ...row(), name: keyword || "初期" } }], totalPages: 1 });
        }));
        mount(); await screen.findByRole("heading", { name: "初期" });
        try {
            await search("A"); await started.promise;
            await search("B"); await screen.findByRole("heading", { name: "B" });
        } finally { await act(async () => gate.resolve()); }
        expect(screen.getByRole("heading", { name: "B" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "A" })).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText("検索")).toHaveValue("B");
    });
});
