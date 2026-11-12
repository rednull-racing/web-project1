import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../../../../fixtures/server";
import { base, deferred, response, row } from "../../../../../fixtures/item-list/draft/fixtures";
import { mount, remove, notifications } from "../../../../../fixtures/item-list/draft/setup";

const heading = () => screen.findByRole("heading", { name: "検証用シャツ101" });
const search = async (value: string) => {
    const user = userEvent.setup();
    await user.clear(screen.getByPlaceholderText("検索"));
    await user.type(screen.getByPlaceholderText("検索"), value);
    await user.keyboard("{Enter}");
};

describe("下書き一覧のSWRと実コンポーネント連携（平坦fixture）", () => {
    it("C-N01 入力時は検索せず送信とページ操作でGET条件を更新する", async () => {
        const urls: URL[] = [];
        server.use(http.get(`${base}/item-draft/list`, ({ request }) => {
            urls.push(new URL(request.url)); return HttpResponse.json(response());
        }));
        mount(); await heading();
        const user = userEvent.setup();
        await user.type(screen.getByPlaceholderText("検索"), " シャツ ");
        expect(urls.map((url) => url.searchParams.get("keyword"))).toEqual([null]);
        await user.keyboard("{Enter}");
        await waitFor(() => expect(urls.at(-1)?.searchParams.get("keyword")).toBe("シャツ"));
        await heading();
        await user.click(screen.getByRole("button", { name: "2" }));
        await waitFor(() => expect(urls.at(-1)?.searchParams.get("page")).toBe("2"));
        expect(urls.at(-1)?.searchParams.get("keyword")).toBe("シャツ");
        await heading();
    });

    it("C-N02 確定検索のページ2から入力でページ1へ戻し空白で条件解除する", async () => {
        const urls: URL[] = [];
        server.use(http.get(`${base}/item-draft/list`, ({ request }) => {
            urls.push(new URL(request.url)); return HttpResponse.json(response());
        }));
        mount(); await heading(); await search("シャツ"); await heading();
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "2" })); await heading();
        await user.type(screen.getByPlaceholderText("検索"), "赤");
        await waitFor(() => expect(urls.at(-1)?.searchParams.get("page")).toBe("1"));
        expect(urls.at(-1)?.searchParams.get("keyword")).toBe("シャツ");
        await user.clear(screen.getByPlaceholderText("検索"));
        await user.type(screen.getByPlaceholderText("検索"), "　");
        await waitFor(() => expect(urls.at(-1)?.searchParams.has("keyword")).toBe(false));
        expect(urls.at(-1)?.searchParams.get("page")).toBe("1"); await heading();
    });

    it("C-E03 遅い検索A応答は新しい検索Bを上書きしない", async () => {
        const gate = deferred<void>();
        const started = deferred<void>();
        server.use(http.get(`${base}/item-draft/list`, async ({ request }) => {
            const keyword = new URL(request.url).searchParams.get("keyword");
            if (keyword === "A") { started.resolve(); await gate.promise; }
            return HttpResponse.json({ itemDraftList: [{ ...row(), name: keyword || "初期" }], totalPages: 1 });
        }));
        mount(); await screen.findByRole("heading", { name: "初期" });
        try {
            await search("A"); await started.promise;
            await search("B"); await screen.findByRole("heading", { name: "B" });
        } finally { await act(async () => gate.resolve()); }
        expect(screen.getByRole("heading", { name: "B" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "A" })).not.toBeInTheDocument();
    });

    it("C-X01 最終ページ最後の削除でも前ページへ補正せず空案内を表示する", async () => {
        let deleted = false;
        const pages: string[] = [];
        server.use(http.get(`${base}/item-draft/list`, ({ request }) => {
            const page = new URL(request.url).searchParams.get("page") || "1"; pages.push(page);
            return HttpResponse.json({ itemDraftList: deleted ? [] : [row()], totalPages: deleted ? 1 : 2 });
        }), http.delete(`${base}/item-draft/101`, () => { deleted = true; return HttpResponse.json({}); }));
        mount(); await heading(); await userEvent.setup().click(screen.getByRole("button", { name: "2" })); await heading();
        await remove(); await screen.findByText("商品が見つかりません");
        expect(pages.at(-1)).toBe("2"); expect(screen.queryByRole("button", { name: "1" })).not.toBeInTheDocument();
        expect(notifications.success).toHaveBeenCalledOnce();
    });
});
