import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";
import { TabHeader } from "@/app/item-list/tabHeader";
import ItemListHeaderUI from "@/app/item-list/itemListHeaderUI";
import { UploadedItemList } from "@/app/item-list/uploaded/uploadedItemList";
import { mount } from "../../../../fixtures/item-list/uploaded/setup";
import { base, response } from "../../../../fixtures/item-list/uploaded/fixtures";
import { server } from "../../../../fixtures/server";
const router = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components", async () => ({
    ...(await import("@/components/container/container")),
    ...(await import("@/components/title-back/back")),
}));
it("P-N01 ページ枠・一覧・タブの遷移要求を接続する", async () => {
    server.use(http.get(`${base}/items/list/uploaded`, () => HttpResponse.json(response())));
    mount(<><TabHeader tab="all" /><ItemListHeaderUI><UploadedItemList uploadedTab="all" /></ItemListHeaderUI></>);
    await screen.findByText("出品シャツ");
    const user = userEvent.setup();
    for (const [name, tab] of [["全商品", "all"], ["販売中のみ", "selling"], ["売り切れ", "sold"]]) {
        await user.click(screen.getByRole("button", { name }));
        expect(router.push).toHaveBeenLastCalledWith(`/item-list/uploaded?tab=${tab}`);
    }
    await user.click(screen.getByRole("button", { name: "戻る" }));
    expect(router.back).toHaveBeenCalledOnce();
    expect(screen.getByPlaceholderText("検索")).toBeInTheDocument();
});
