import { API, runtime } from "@/../test/fixtures/item/itemDraftPage/setup";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { ItemDraftPage } from "@/app/item/draft/itemDraftPage";
import { createDraft, createEmptyDraft, deferred } from "@/../test/fixtures/item/itemDraftPage/fixtures";
import { server } from "@/../test/fixtures/server";

const editButtons = () => screen.getAllByRole("button", { name: "編集する" });
const openDelete = () => userEvent.setup().click(screen.getByText("この下書き商品を削除する"));
const deleteButton = () => screen.getByRole("button", { name: "削除する" });

describe("ItemDraftPage DOM integration (VideoTitleのみ同期代替)", () => {
    it.each(["full", "empty"].flatMap((kind) => [0, 1].map((index) => ({ kind, index }))))("P-N01: $kind 下書きの編集ボタン$indexが返却IDへ遷移", async ({ kind, index }) => {
        const reached = vi.fn();
        server.use(http.post(`${API}/item-editing/draft`, async ({ request }) => { reached(await request.json()); return HttpResponse.json({ itemEditingId: 456 }, { status: 201 }); }));
        render(<ItemDraftPage id="11" itemDraft={kind === "empty" ? createEmptyDraft() : createDraft()} />);
        expect(editButtons()).toHaveLength(2); expect(screen.getAllByText("この下書き商品を削除する")).toHaveLength(1);
        await userEvent.setup().click(editButtons()[index]);
        await waitFor(() => expect(runtime.push).toHaveBeenCalledExactlyOnceWith("/upload/456"));
        expect(reached).toHaveBeenCalledExactlyOnceWith({ itemDraftId: 11 });
    });

    it.each(["full", "empty"])("P-N01: %s 下書きの削除が成功してmy-pageへ", async (kind) => {
        const reached = vi.fn();
        server.use(http.delete(`${API}/item-draft/11`, () => { reached(); return HttpResponse.json({ message: "deleted" }); }));
        render(<ItemDraftPage id="11" itemDraft={kind === "empty" ? createEmptyDraft() : createDraft()} />);
        await openDelete(); await userEvent.setup().click(deleteButton());
        await waitFor(() => expect(runtime.push).toHaveBeenCalledExactlyOnceWith("/my-page"));
        expect(reached).toHaveBeenCalledTimes(1);
    });

    it.each([0, 1, undefined].flatMap((current) => [null, 0].map((price) => ({ current, price }))))("P-N02: %j の両セクション表示", ({ current, price }) => {
        const draft = createEmptyDraft(); draft.price = price;
        draft.attributes = current === undefined ? {} : { inventory: { initial: 10, current, low_stock_ratio: 0.2 } };
        render(<ItemDraftPage id="11" itemDraft={draft} />);
        if (current === 0) expect(screen.getAllByText("SOLD OUT").length).toBeGreaterThanOrEqual(2);
        else {
            expect(screen.queryByText("SOLD OUT")).not.toBeInTheDocument();
            expect(screen.getAllByText(price === null ? "￥-" : "￥0")).toHaveLength(2);
        }
    });

    it.each(["edit", "delete"])("P-F01: %s HTTP失敗後も表示保持・再試行成功", async (operation) => {
        let failed = true;
        const response = () => failed ? HttpResponse.json({ code: "ERROR" }, { status: 500 }) : HttpResponse.json({ itemEditingId: 456, message: "deleted" }, { status: operation === "edit" ? 201 : 200 });
        server.use(http.post(`${API}/item-editing/draft`, response), http.delete(`${API}/item-draft/11`, response));
        render(<ItemDraftPage id="11" itemDraft={createDraft()} />);
        const perform = async () => {
            if (operation === "edit") await userEvent.setup().click(editButtons()[0]);
            else { await openDelete(); await userEvent.setup().click(deleteButton()); }
        };
        await perform(); await waitFor(() => expect(runtime.error).toHaveBeenCalledTimes(1));
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("下書きシャツ");
        expect(runtime.push).not.toHaveBeenCalled(); expect(runtime.success).not.toHaveBeenCalled();
        failed = false; await perform();
        await waitFor(() => expect(runtime.push).toHaveBeenCalledExactlyOnceWith(operation === "edit" ? "/upload/456" : "/my-page"));
    });

    it.each([0, 1])("Q02: 編集%s保留中は反対側を押してもHTTPは1回", async (first) => {
        const gate = deferred<void>(); const reached = vi.fn();
        server.use(http.post(`${API}/item-editing/draft`, async () => { reached(); await gate.promise; return HttpResponse.json({ code: "END" }, { status: 500 }); }));
        render(<ItemDraftPage id="11" itemDraft={createDraft()} />);
        const user = userEvent.setup(); await user.click(editButtons()[first]);
        try {
            await waitFor(() => expect(reached).toHaveBeenCalledTimes(1));
            await user.click(editButtons()[1 - first]);
            await act(async () => undefined);
            expect(reached).toHaveBeenCalledTimes(1);
            expect(editButtons().every((button) => button.hasAttribute("disabled"))).toBe(true);
        } finally { await act(async () => gate.resolve()); await waitFor(() => expect(runtime.error).toHaveBeenCalled()); }
    });

    it.each(["edit", "delete"])("Q03: %s保留中に相反操作のHTTPを送らない", async (first) => {
        const gate = deferred<void>(); const edit = vi.fn(); const del = vi.fn();
        const finish = async () => { await gate.promise; return HttpResponse.json({ code: "END" }, { status: 500 }); };
        server.use(http.post(`${API}/item-editing/draft`, () => { edit(); return finish(); }), http.delete(`${API}/item-draft/11`, () => { del(); return finish(); }));
        render(<ItemDraftPage id="11" itemDraft={createDraft()} />);
        const user = userEvent.setup();
        if (first === "edit") await user.click(editButtons()[0]); else { await openDelete(); await user.click(deleteButton()); }
        try {
            await waitFor(() => expect(first === "edit" ? edit : del).toHaveBeenCalledTimes(1));
            if (first === "edit") { await openDelete(); const button = screen.queryByRole("button", { name: "削除する" }); if (button) await user.click(button); }
            else await user.click(editButtons()[0]);
            await act(async () => undefined);
            expect(first === "edit" ? del : edit).not.toHaveBeenCalled();
        } finally { await act(async () => gate.resolve()); await waitFor(() => expect(runtime.error).toHaveBeenCalled()); }
    });

    it("Q04: 削除成功後の遷移待ちに再削除しない", async () => {
        const gate = deferred<void>(); runtime.sleep.mockReturnValue(gate.promise); const reached = vi.fn();
        server.use(http.delete(`${API}/item-draft/11`, () => { reached(); return HttpResponse.json({ message: "deleted" }); }));
        render(<ItemDraftPage id="11" itemDraft={createDraft()} />);
        const user = userEvent.setup(); await openDelete(); await user.click(deleteButton());
        try {
            await waitFor(() => expect(runtime.success).toHaveBeenCalledTimes(1));
            expect(runtime.push).not.toHaveBeenCalled();
            await openDelete(); const button = screen.queryByRole("button", { name: "削除する" }); if (button) await user.click(button);
            await act(async () => undefined);
            expect(reached).toHaveBeenCalledTimes(1); expect(runtime.success).toHaveBeenCalledTimes(1);
        } finally { await act(async () => gate.resolve()); await waitFor(() => expect(runtime.push).toHaveBeenCalled()); }
    });
    it("Q05: 削除開始へキーボードで到達できる", async () => {
        render(<ItemDraftPage id="11" itemDraft={createEmptyDraft()} />);
        const user = userEvent.setup();
        const trigger = screen.getByRole("button", { name: "この下書き商品を削除する" });
        let reached = false;
        for (let index = 0; index < 12; index++) {
            await user.tab();
            if (document.activeElement === trigger) { reached = true; break; }
        }
        expect(reached).toBe(true);
        await user.keyboard("{Enter}");
        expect(screen.getByText("確認")).toBeInTheDocument();
    });

    it("Q05: 削除確認に名前付きの閉じる操作がありキーボードで閉じられる", async () => {
        render(<ItemDraftPage id="11" itemDraft={createEmptyDraft()} />);
        await openDelete();
        const close = screen.getByRole("button", { name: /閉じる|キャンセル/ });
        close.focus(); await userEvent.setup().keyboard("{Enter}");
        expect(screen.queryByText("確認")).not.toBeInTheDocument();
        expect(runtime.push).not.toHaveBeenCalled(); expect(runtime.success).not.toHaveBeenCalled();
    });

});
