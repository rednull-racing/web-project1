import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import ItemListUI from "@/app/item-list/itemListUI";
import { TrashItemList } from "@/app/item-list/trash/trashItemList";
import { server } from "../../../../fixtures/server";
import { base, deferred, response } from "../../../../fixtures/item-list/trash/fixtures";
import { mount } from "../../../../fixtures/item-list/trash/setup";

const router = vi.hoisted(() => ({ back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
// 関係のないbarrel exportを避け、ページ枠と見出しは実物を接続する。
vi.mock("@/components", async () => ({
    ...await import("@/components/container/container"),
    ...await import("@/components/title-back/title-back"),
}));
const page = () => <ItemListUI title="削除した商品"><TrashItemList /></ItemListUI>;

describe("削除した商品一覧のページ結合", () => {
    it("P-N01 実ページ枠と一覧・検索・ページ番号を接続し戻る要求を通知する", async () => {
        server.use(http.get(`${base}/item-trash/list`, () => HttpResponse.json(response())));
        const { container } = mount(page());
        await screen.findByRole("heading", { name: "検証用シャツ101" });
        expect(screen.getByRole("heading", { name: "削除した商品" })).toBeInTheDocument();
        expect(screen.getByPlaceholderText("検索")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
        // 現行TitleAndBackはSVG自体がトリガー。
        const back = container.querySelector('[data-icon="angle-left"]');
        if (!back) throw new Error("戻るアイコンがありません");
        await userEvent.setup().click(back);
        expect(router.back).toHaveBeenCalledOnce();
    });

    it.each([false, true])("P-N02 遅延=%sの空一覧は応答後だけ空案内を表示する", async (delayed) => {
        const gate = deferred<void>();
        server.use(http.get(`${base}/item-trash/list`, async () => {
            if (delayed) await gate.promise;
            return HttpResponse.json({ itemTrashList: [], totalPages: 0 });
        }));
        mount(page());
        try {
            expect(screen.getByRole("heading", { name: "削除した商品" })).toBeInTheDocument();
            expect(screen.queryByText("商品が見つかりません")).not.toBeInTheDocument();
        } finally { await act(async () => gate.resolve()); }
        await screen.findByText("商品が見つかりません");
        expect(screen.queryByRole("main")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "1" })).not.toBeInTheDocument();
    });
});
