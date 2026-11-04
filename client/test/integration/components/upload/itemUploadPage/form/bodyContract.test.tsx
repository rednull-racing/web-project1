import { API, runtime } from "@/../test/fixtures/upload/itemUploadPage/setup";
import { emptySigned, formProps } from "@/../test/fixtures/upload/itemUploadPage/fixtures";
import { server } from "@/../test/fixtures/server";
import { normalizeUploadPage } from "@/app/upload/api/server";
import { Form } from "@/app/upload/form";
import { updateItemEditingConfirmBodySchema } from "@/../../server/src/validators/body/itemEditing";
import { createItemDraftBodySchema } from "@/../../server/src/validators/body/itemDraft";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";
vi.mock("@/lib/api/server", () => ({ apiFetchServer: vi.fn() }));

it.each(["normal", "edit", "draft"] as const)("AF-F10 数値IDのGET初期値→%s送信が本番schemaに適合", async (action) => {
    const props = formProps(action === "edit" ? "edit" : "normal");
    const data = normalizeUploadPage({
        ...props,
        itemEditing: {
            ...props.itemEditing,
            id: 123,
            Category: { ...props.category[0], id: 10, level: 2, parent_id: 5 },
            Brand: { id: 20, name: "Brand" },
            ItemConditionOption: { id: 1, name: "未使用" },
            ShippingDayOption: { id: 2, name: "翌日" },
            ShippingServiceOption: { id: 3, name: "宅配" },
            TodouhukenOption: { id: 4, name: "東京" },
        },
    });
    let body: unknown;
    const method = action === "draft" ? http.post : http.put;
    server.use(
        method(`${API}/${action === "draft" ? "item-draft" : "item-editing/123"}`, async ({ request }) => {
            body = await request.json();
            return HttpResponse.json(emptySigned());
        }),
    );
    // 第2階層初期化の親一覧を合わせ、子候補取得だけを置き換える。
    const category = [{ ...data.category[0], id: "5" }];
    server.use(http.get(`${API}/categories/5/level2`, () => HttpResponse.json({ category2: [] })));
    render(<Form {...props} {...data} category={category} />);
    await userEvent.click(screen.getByRole("button", { name: action === "draft" ? "下書き保存する" : "出品する" }));
    await waitFor(() => expect(runtime.assign).toHaveBeenCalledTimes(1));
    const schema = action === "draft" ? createItemDraftBodySchema : updateItemEditingConfirmBodySchema;
    expect(schema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
        category: { id: "10", parent_id: "5", level: 2 },
        brand: { id: "20" },
        condition: { id: "1" },
        shipping: { day: "2", service: "3", place: "4" },
    });
});
