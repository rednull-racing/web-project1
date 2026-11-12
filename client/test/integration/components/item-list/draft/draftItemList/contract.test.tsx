import { Component } from "react";
import type { ReactNode } from "react";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { DraftItemList } from "@/app/item-list/draft/draftItemList";
import { server } from "../../../../../fixtures/server";
import { base, wireResponse } from "../../../../../fixtures/item-list/draft/fixtures";
import { mount } from "../../../../../fixtures/item-list/draft/setup";
// 描画例外を回収するが、例外表示を契約成功とは扱わない。
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    render() {
        return this.state.failed ? <p>描画エラー</p> : this.props.children;
    }
}
describe("実API一覧レスポンス契約", () => {
    it.each([false, true, "string"] as const)(
        "C-A01 wrapped配列price=%sで正しいIDと情報を利用できる",
        async (priceKind) => {
            const nullable = priceKind === true;
            const body = wireResponse(nullable);
            const payload =
                priceKind === "string"
                    ? {
                          ...body,
                          itemDraftList: [{ itemDraft: { ...body.itemDraftList[0].itemDraft, price: "12345" } }],
                      }
                    : body;
            server.use(http.get(`${base}/item-draft/list`, () => HttpResponse.json(payload)));
            mount(
                <Boundary>
                    <DraftItemList />
                </Boundary>,
            );
            const link = await screen.findByRole("link", { name: /保存日時/ });
            expect(link).toHaveAttribute("href", "/item/draft/101");
            if (nullable) {
                expect(screen.getByRole("heading", { name: "-" })).toBeInTheDocument();
            } else {
                expect(screen.getByRole("heading", { name: "検証用シャツ101" })).toBeInTheDocument();
                expect(screen.getByRole("heading", { name: "12,345円" })).toBeInTheDocument();
            }
        },
    );
});
