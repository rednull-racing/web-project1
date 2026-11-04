import { API, runtime } from "@/../test/fixtures/upload/itemUploadPage/setup";
import { deferred, emptySigned, formProps } from "@/../test/fixtures/upload/itemUploadPage/fixtures";
import { server } from "@/../test/fixtures/server";
import { Form } from "@/app/upload/form";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

for (const mode of ["normal", "edit"] as const) {
    describe(`Form HTTP ${mode}`, () => {
        it("C03 初期値・ショップ属性・既存動画優先と下書き表示", () => {
            const props = formProps(mode);
            const view = render(<Form {...props} />);
            expect(screen.getByDisplayValue("綿シャツ")).toBeInTheDocument();
            expect(screen.getByDisplayValue("着用動画")).toBeInTheDocument();
            expect(screen.getByDisplayValue("1,000")).toBeInTheDocument();
            expect(view.container.querySelector("video")).toHaveAttribute("src", props.itemEditing.converted_url);
            expect(screen.getAllByAltText("attributes_preview")).toHaveLength(2);
            expect(screen.queryByRole("button", { name: "下書き保存する" }) !== null).toBe(mode === "normal");
        });
        it("C04 C08 既存のみで正しい本文・認証・確認先へ進む", async () => {
            const reached = vi.fn();
            server.use(http.put(`${API}/item-editing/123`, async ({ request }) => {
                reached(await request.json(), request.headers.get("authorization"));
                return HttpResponse.json(emptySigned());
            }));
            render(<Form {...formProps(mode)} />);
            const user = userEvent.setup();
            const name = screen.getByDisplayValue("綿シャツ");
            await user.clear(name);
            await user.type(name, "変更後");
            await user.click(screen.getByRole("button", { name: "出品する" }));
            await waitFor(() => expect(runtime.assign).toHaveBeenCalledExactlyOnceWith(mode === "normal" ? "/item/confirm/123" : "/item/confirm/edit/123"));
            expect(reached).toHaveBeenCalledTimes(1);
            expect(reached.mock.calls[0][1]).toBe("Bearer test-access-token");
            expect(reached.mock.calls[0][0]).toMatchObject({
                itemMeta: { name: "変更後", detail: "商品の説明" },
                video: { uploaded: true }, thumbnail: { uploaded: true },
                itemImages: [{ name: "item.jpg", type: null, uploaded: true }],
                attributes: { allInventory: 2, colorVariants: [
                    { uiId: "color-0", image: { name: "color-0.jpg", uploaded: true } },
                    { uiId: "color-1", image: { name: "color-1.jpg", uploaded: true } },
                ] }, price: 1000,
            });
            expect(runtime.success).toHaveBeenCalledExactlyOnceWith("商品データを登録しました");
            expect(runtime.sleep).toHaveBeenCalledExactlyOnceWith(1500);
        });
        it.each([401, 403, 404, 429, 500, "network", "json"] as const)("C01 C06 %sで停止し入力を保持", async (status) => {
            server.use(http.put(`${API}/item-editing/123`, () => {
                if (status === "network") return HttpResponse.error();
                if (status === "json") return new HttpResponse("invalid", { status: 500 });
                return HttpResponse.json({ code: "FAIL" }, { status });
            }));
            render(<Form {...formProps(mode)} />);
            await userEvent.click(screen.getByRole("button", { name: "出品する" }));
            if (typeof status === "number") await waitFor(() => expect(runtime.error).toHaveBeenCalledExactlyOnceWith("データ作成に失敗しました"));
            else await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
            expect(screen.getByRole("button", { name: "出品する" })).toBeEnabled();
            expect(screen.getByDisplayValue("綿シャツ")).toBeInTheDocument();
            expect(runtime.assign).not.toHaveBeenCalled();
            expect(runtime.success).not.toHaveBeenCalled();
            expect(runtime.sleep).not.toHaveBeenCalled();
        });
        it("C01 トークンなしはHTTP前に停止", async () => {
            runtime.token.mockResolvedValue(null);
            const request = vi.fn();
            server.use(http.put(`${API}/item-editing/123`, () => { request(); return HttpResponse.json(emptySigned()); }));
            render(<Form {...formProps(mode)} />);
            await userEvent.click(screen.getByRole("button", { name: "出品する" }));
            await waitFor(() => expect(runtime.error).toHaveBeenCalledTimes(1));
            expect(request).not.toHaveBeenCalled();
            expect(runtime.assign).not.toHaveBeenCalled();
        });
        it("C06 バリデーション失敗でAPIへ進まない", async () => {
            const props = formProps(mode); props.itemEditing.title = " ";
            const request = vi.fn();
            server.use(http.put(`${API}/item-editing/123`, () => { request(); return HttpResponse.json(emptySigned()); }));
            render(<Form {...props} />);
            await userEvent.click(screen.getByRole("button", { name: "出品する" }));
            expect(runtime.error).toHaveBeenCalledWith("動画タイトルを入力してください");
            expect(request).not.toHaveBeenCalled();
            expect(runtime.assign).not.toHaveBeenCalled();
        });
        it("C07 同一送信の連打を止め失敗後復旧", async () => {
            const gate = deferred<void>(); const request = vi.fn();
            server.use(http.put(`${API}/item-editing/123`, async () => {
                request(); await gate.promise; return HttpResponse.json({ code: "FAIL" }, { status: 500 });
            }));
            render(<Form {...formProps(mode)} />);
            const user = userEvent.setup();
            await user.click(screen.getByRole("button", { name: "出品する" }));
            await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
            const busy = screen.getByRole("button", { name: "登録中..." });
            expect(busy).toBeDisabled(); await user.click(busy);
            expect(request).toHaveBeenCalledTimes(1);
            gate.resolve();
            await waitFor(() => expect(screen.getByRole("button", { name: "出品する" })).toBeEnabled());
            expect(runtime.assign).not.toHaveBeenCalled();
        });
    });
}

it("C05 必須未入力の下書きはnumeric editingIdで保存", async () => {
    const props = formProps(); props.itemEditing.title = ""; props.itemEditing.name = ""; props.itemEditing.price = 0; props.itemEditing.before_price = 0;
    const reached = vi.fn();
    server.use(http.post(`${API}/item-draft`, async ({ request }) => { reached(await request.json()); return HttpResponse.json(emptySigned()); }));
    render(<Form {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "下書き保存する" }));
    await waitFor(() => expect(runtime.assign).toHaveBeenCalledExactlyOnceWith("/item-list/draft"));
    expect(reached.mock.calls[0][0]).toMatchObject({ itemEditingId: 123, itemMeta: { name: "" }, price: 0 });
    expect(runtime.success).toHaveBeenCalledExactlyOnceWith("下書き保存しました");
});

it.each([true, false])("C03 hasShop=%sで表示と非表示属性の送信を区別", async (hasShop) => {
    const props = formProps(); props.hasShop = hasShop;
    const reached = vi.fn();
    server.use(http.put(`${API}/item-editing/123`, async ({ request }) => { reached(await request.json()); return HttpResponse.json(emptySigned()); }));
    render(<Form {...props} />);
    expect(screen.queryAllByAltText("attributes_preview")).toHaveLength(hasShop ? 2 : 0);
    await userEvent.click(screen.getByRole("button", { name: "出品する" }));
    await waitFor(() => expect(reached).toHaveBeenCalledTimes(1));
    expect(reached.mock.calls[0][0].attributes.allInventory).toBe(2);
});

it("Q02 観測: 成功待機中に送信ボタンが再有効化され再送できる", async () => {
    const gate = deferred<void>(); runtime.sleep.mockReturnValue(gate.promise);
    const reached = vi.fn();
    server.use(http.put(`${API}/item-editing/123`, () => { reached(); return HttpResponse.json(emptySigned()); }));
    render(<Form {...formProps()} />);
    await userEvent.click(screen.getByRole("button", { name: "出品する" }));
    await waitFor(() => expect(runtime.success).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "出品する" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "出品する" }));
    await waitFor(() => expect(reached).toHaveBeenCalledTimes(2));
    expect(runtime.assign).not.toHaveBeenCalled();
    await act(async () => gate.resolve());
    expect(runtime.assign).toHaveBeenCalledTimes(2);
});

it("Q02 観測: 出品中も下書き送信が実行できる", async () => {
    const gate = deferred<void>(); const events: string[] = [];
    server.use(
        http.put(`${API}/item-editing/123`, async () => { events.push("main"); await gate.promise; return HttpResponse.json({ code: "FAIL" }, { status: 500 }); }),
        http.post(`${API}/item-draft`, () => { events.push("draft"); return HttpResponse.json(emptySigned()); }),
    );
    render(<Form {...formProps()} />);
    await userEvent.click(screen.getByRole("button", { name: "出品する" }));
    await waitFor(() => expect(events).toEqual(["main"]));
    expect(screen.getByRole("button", { name: "下書き保存する" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "下書き保存する" }));
    await waitFor(() => expect(runtime.assign).toHaveBeenCalledWith("/item-list/draft"));
    expect(events).toEqual(["main", "draft"]);
    gate.resolve();
    await waitFor(() => expect(runtime.error).toHaveBeenCalledTimes(1));
});

it("C08 商品画像は9枚から複数追加して10枚で停止し超過分を送信しない", async () => {
    const props = formProps(); props.itemEditing.image_url = Array.from({ length: 9 }, (_, i) => `https://media.test/${i}.jpg`);
    const reached = vi.fn();
    server.use(http.put(`${API}/item-editing/123`, async ({ request }) => { reached(await request.json()); return HttpResponse.json(emptySigned()); }));
    render(<Form {...props} />);
    const input = screen.getByPlaceholderText("商品画像をアップロード");
    const a = new File(["a"], "a.jpg", { type: "image/jpeg" });
    const b = new File(["b"], "b.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [a, b] } });
    expect(input).toBeDisabled();
    expect(screen.getAllByAltText(/^商品画像-/)).toHaveLength(10);
    await userEvent.click(screen.getByRole("button", { name: "出品する" }));
    await waitFor(() => expect(reached).toHaveBeenCalledTimes(1));
    expect(reached.mock.calls[0][0].itemImages.at(-1)).toEqual({ name: "a.jpg", type: "image/jpeg", uploaded: false });
});


it("C03 C08 uiIdのない既存属性画像を入力変更後もbodyへ保持する", async () => {
    const props = formProps();
    props.itemEditing.attributes.colorVariants?.forEach((variant) => { delete variant.uiId; });
    const reached = vi.fn();
    server.use(http.put(`${API}/item-editing/123`, async ({ request }) => {
        reached(await request.json()); return HttpResponse.json(emptySigned());
    }));
    render(<Form {...props} />);
    await userEvent.type(screen.getByDisplayValue("綿シャツ"), "変更");
    await userEvent.click(screen.getByRole("button", { name: "出品する" }));
    await waitFor(() => expect(reached).toHaveBeenCalledTimes(1));
    expect(reached.mock.calls[0][0].attributes.colorVariants.map((v: { image: unknown }) => v.image)).toEqual([
        { name: "color-0.jpg", type: null, uploaded: true },
        { name: "color-1.jpg", type: null, uploaded: true },
    ]);
});

it.each([0, Number.NaN, 2000])("C03 before_price=%sの初期価格", (beforePrice) => {
    const props = formProps(); props.itemEditing.before_price = beforePrice;
    render(<Form {...props} />);
    expect(screen.getByDisplayValue(beforePrice === 2000 ? "2,000" : "1,000")).toBeInTheDocument();
});

it("Q07 入力HTMLを値として扱いscript要素へ展開しない", () => {
    const props = formProps(); props.itemEditing.name = '<script>alert("x")</script>';
    const view = render(<Form {...props} />);
    expect(screen.getByDisplayValue(props.itemEditing.name)).toBeInTheDocument();
    expect(view.container.querySelector("script")).toBeNull();
});


it("C03 nullable応答の空文字・既定在庫への展開", async () => {
    const props = formProps();
    // 実APIのnullable応答と現行型の差を再現する入力境界。
    props.itemEditing = JSON.parse(JSON.stringify({ ...props.itemEditing,
        name: null, detail: null, title: null, summary: null, thumbnail_url: null,
        original_url: null, converted_url: null, image_url: null, before_price: null,
        Category: null, Brand: null, ItemConditionOption: null, ShippingDayOption: null,
        ShippingServiceOption: null, TodouhukenOption: null, attributes: {},
    }));
    const reached = vi.fn();
    server.use(http.post(`${API}/item-draft`, async ({ request }) => { reached(await request.json()); return HttpResponse.json(emptySigned()); }));
    const view = render(<Form {...props} />);
    expect(view.container.querySelector("video")).toBeNull();
    expect(screen.getByAltText("サムネイル")).toHaveAttribute("src", "/no-image(1x1).png");
    await userEvent.click(screen.getByRole("button", { name: "下書き保存する" }));
    await waitFor(() => expect(reached).toHaveBeenCalledTimes(1));
    expect(reached.mock.calls[0][0]).toMatchObject({
        itemMeta: { name: "", detail: "" }, videoMeta: { title: "", summary: "" },
        video: { uploaded: false }, thumbnail: { uploaded: false }, itemImages: [],
        attributes: { allInventory: 1, colorVariants: [], materials: [] },
    });
});

it("C08 中間の商品画像削除後に新規画像だけを末尾へ追加", async () => {
    const props = formProps(); props.itemEditing.image_url = ["a", "b", "c"].map((x) => `https://media.test/${x}.jpg`);
    const reached = vi.fn();
    server.use(http.put(`${API}/item-editing/123`, async ({ request }) => { reached(await request.json()); return HttpResponse.json(emptySigned()); }));
    const view = render(<Form {...props} />);
    // 現行の削除アイコンにはrole/ラベルがないためアイコンを特定する。
    const icons = view.container.querySelectorAll('svg[data-icon="trash-can"]');
    fireEvent.click(icons[1]);
    fireEvent.change(screen.getByPlaceholderText("商品画像をアップロード"), { target: { files: [new File(["new"], "d.jpg", { type: "image/jpeg" })] } });
    await userEvent.click(screen.getByRole("button", { name: "出品する" }));
    await waitFor(() => expect(reached).toHaveBeenCalledTimes(1));
    expect(reached.mock.calls[0][0].itemImages).toEqual([
        { name: "a.jpg", type: null, uploaded: true }, { name: "c.jpg", type: null, uploaded: true },
        { name: "d.jpg", type: "image/jpeg", uploaded: false },
    ]);
});

it("C04 成功通知後1500ms経過してから確認へ遷移", async () => {
    let startTimer!: () => void;
    runtime.sleep.mockImplementation((ms) => new Promise((done) => { startTimer = () => { setTimeout(done, ms); }; }));
    server.use(http.put(`${API}/item-editing/123`, () => HttpResponse.json(emptySigned())));
    render(<Form {...formProps()} />);
    await userEvent.click(screen.getByRole("button", { name: "出品する" }));
    await waitFor(() => expect(runtime.success).toHaveBeenCalledTimes(1));
    expect(runtime.assign).not.toHaveBeenCalled();
    vi.useFakeTimers(); startTimer();
    await act(async () => { await vi.advanceTimersByTimeAsync(1499); });
    expect(runtime.assign).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(runtime.assign).toHaveBeenCalledExactlyOnceWith("/item/confirm/123");
});

it.each(["network", "json", 401] as const)("C01 C05 C06 下書き%s失敗で停止", async (failure) => {
    server.use(http.post(`${API}/item-draft`, () => {
        if (failure === "network") return HttpResponse.error();
        if (failure === "json") return new HttpResponse("invalid", { status: 500 });
        return HttpResponse.json({ code: "UNAUTHORIZED" }, { status: failure });
    }));
    render(<Form {...formProps()} />);
    await userEvent.click(screen.getByRole("button", { name: "下書き保存する" }));
    if (typeof failure === "number") await waitFor(() => expect(runtime.error).toHaveBeenCalledExactlyOnceWith("下書き保存に失敗しました"));
    else await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "下書き保存する" })).toBeEnabled();
    expect(runtime.assign).not.toHaveBeenCalled();
    expect(runtime.success).not.toHaveBeenCalled();
});

it("Q02 観測: 下書き処理中も出品を送信できる", async () => {
    const gate = deferred<void>(); const events: string[] = [];
    server.use(
        http.post(`${API}/item-draft`, async () => { events.push("draft"); await gate.promise; return HttpResponse.json({ code: "FAIL" }, { status: 500 }); }),
        http.put(`${API}/item-editing/123`, () => { events.push("main"); return HttpResponse.json(emptySigned()); }),
    );
    render(<Form {...formProps()} />);
    await userEvent.click(screen.getByRole("button", { name: "下書き保存する" }));
    await waitFor(() => expect(events).toEqual(["draft"]));
    expect(screen.getByRole("button", { name: "出品する" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "出品する" }));
    await waitFor(() => expect(runtime.assign).toHaveBeenCalledWith("/item/confirm/123"));
    expect(events).toEqual(["draft", "main"]);
    gate.resolve();
    await waitFor(() => expect(runtime.error).toHaveBeenCalledTimes(1));
});

it("U16 UploadUIの戻るアイコンが実TitleAndBackを通じてrouter.backを要求", async () => {
    const view = render(<Form {...formProps()} />);
    // 現行の戻るsvgにはrole/ラベルがない。アクセシビリティはO03で別途確認。
    const back = view.container.querySelector('svg[data-icon="angle-left"]');
    expect(back).not.toBeNull();
    fireEvent.click(back!);
    expect(runtime.back).toHaveBeenCalledExactlyOnceWith();
    expect(runtime.assign).not.toHaveBeenCalled();
});
