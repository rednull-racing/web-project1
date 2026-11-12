import { screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import ItemListUI from "@/app/item-list/itemListUI";
import { DraftItemList } from "@/app/item-list/draft/draftItemList";
import { server } from "../../../../fixtures/server";
import { base, deferred, response } from "../../../../fixtures/item-list/draft/fixtures";
import { mount } from "../../../../fixtures/item-list/draft/setup";
const router = vi.hoisted(() => ({ back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
// barrel経由の無関係な部品だけを避け、ページ枠と見出しは実物を接続する。
vi.mock("@/components", async () => ({
    ...(await import("@/components/container/container")),
    ...(await import("@/components/title-back/title-back")),
}));
const page = () => (
    <ItemListUI title="下書き商品">
        <DraftItemList />
    </ItemListUI>
);
describe("下書き一覧のページ枠", () => {
    it("P-N01 タイトルと一覧・検索・ページ番号を接続し戻る要求を通知する", async () => {
        server.use(http.get(`${base}/item-draft/list`, () => HttpResponse.json(response())));
        const { container } = mount(page());
        await screen.findByRole("heading", { name: "検証用シャツ101" });
        expect(screen.getByRole("heading", { name: "下書き商品" })).toBeInTheDocument();
        expect(screen.getByPlaceholderText("検索")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
        const back = container.querySelector('[data-icon="angle-left"]');
        if (!back) throw new Error("戻るアイコンがありません");
        await userEvent.setup().click(back);
        expect(router.back).toHaveBeenCalledOnce();
    });
    it("P-N02 遅延中は空案内を表示せず空応答後だけ表示する", async () => {
        const gate = deferred<void>();
        server.use(
            http.get(`${base}/item-draft/list`, async () => {
                await gate.promise;
                return HttpResponse.json({ itemDraftList: [], totalPages: 0 });
            }),
        );
        mount(page());
        try {
            expect(screen.getByRole("heading", { name: "下書き商品" })).toBeInTheDocument();
            expect(screen.queryByText("商品が見つかりません")).not.toBeInTheDocument();
        } finally {
            await act(async () => gate.resolve());
        }
        await screen.findByText("商品が見つかりません");
        expect(screen.queryByRole("button", { name: "1" })).not.toBeInTheDocument();
    });
});
