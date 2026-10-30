import { API, runtime } from "@/../test/fixtures/item/itemConfirmPage/setup";
import { createConfirm } from "@/../test/fixtures/item/itemConfirmPage/fixtures";
import { ItemConfirmPage } from "@/app/item/confirm/itemConfirmPage";
import { server } from "@/../test/fixtures/server";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

describe("ItemConfirmPage DOM (async VideoTitleのみ同期代替)", () => {
    it.each(["normal", "edit"] as const)("P-N01 %sの全表示から実API wrapperで送信", async (page) => {
        const reached = vi.fn();
        server.use((page === "normal" ? http.post : http.put)(`${API}/items`, async ({ request }) => {
            reached(await request.json()); return HttpResponse.json({ itemId: 501 });
        }));
        render(<ItemConfirmPage id="101" itemEditing={createConfirm({ status: page })} page={page} />);
        expect(screen.getByText(page === "normal" ? "出品する商品の確認" : "更新する商品情報の確認")).toBeInTheDocument();
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("確認用シャツ");
        expect(screen.getByText("確認用動画")).toBeInTheDocument();
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "出品する" }));
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getAllByRole("button", { name: "出品する" }).at(-1)!);
        await waitFor(() => expect(runtime.push).toHaveBeenCalledExactlyOnceWith(page === "normal" ? "/upload/ok/501" : "/item/501"));
        expect(reached).toHaveBeenCalledExactlyOnceWith({ itemEditingId: 101 });
        expect(runtime.error).not.toHaveBeenCalled();
    });
    it.each(["normal", "edit"] as const)("P-N02 %s在庫0/1/省略の両セクションを更新してnull補完", (page) => {
        const requests = vi.fn();
        server.use(http.all(`${API}/*`, () => { requests(); return HttpResponse.json({}); }));
        const view = render(<ItemConfirmPage id="101" page={page} itemEditing={createConfirm()} />);
        for (const current of [0, 1, undefined]) {
            const data = createConfirm({ detail: null, summary: null, Category: null, ItemConditionOption: null,
                ShippingServiceOption: null, ShippingDayOption: null, TodouhukenOption: null,
                attributes: current === undefined ? {} : { inventory: { initial: 10, current, low_stock_ratio: 0.2 } } });
            view.rerender(<ItemConfirmPage id="101" page={page} itemEditing={data} />);
            if (current === 0) expect(screen.getAllByText("SOLD OUT").length).toBeGreaterThanOrEqual(2);
            else {
                expect(screen.queryByText("SOLD OUT")).not.toBeInTheDocument();
                expect(screen.getAllByText("￥12,000")).toHaveLength(2);
            }
            expect(screen.getAllByText("-")).toHaveLength(4);
            expect(screen.queryByText("null")).not.toBeInTheDocument();
        }
        expect(requests).not.toHaveBeenCalled();
    });
});
