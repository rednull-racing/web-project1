import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";
import ItemListUI from "@/app/item-list/itemListUI";
import { StockItemList } from "@/app/item-list/stock/stockItemList";
import { mount } from "../../../../fixtures/item-list/stock/setup";
import { base, response } from "../../../../fixtures/item-list/stock/fixtures";
import { server } from "../../../../fixtures/server";
const router = vi.hoisted(() => ({ back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components", async () => ({
    ...(await import("@/components/container/container")),
    ...(await import("@/components/title-back/title-back")),
}));
it("P-N01 ページ枠・見出し・検索・在庫一覧・戻る要求を接続", async () => {
    server.use(http.get(`${base}/items/list/stock`, () => HttpResponse.json(response())));
    mount(<ItemListUI title="在庫一覧"><StockItemList /></ItemListUI>);
    await screen.findByText("出品シャツ");
    expect(screen.getByRole("heading", { name: "在庫一覧" })).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("検索")).toBeInTheDocument();
    const back = screen.getByRole("button", { name: "戻る" });
    await userEvent.setup().click(back);
    expect(router.back).toHaveBeenCalledOnce();
});
