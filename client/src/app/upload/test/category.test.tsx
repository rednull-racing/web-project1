import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import toast from "react-hot-toast";
import { server } from "../../../../test/fixtures/server";
import { Category, type CategoryValue } from "../category";
import type { Categories } from "../types/types";
const parent: Categories = {
    id: "1",
    name: "トップス",
    parent_id: 0,
    level: 1,
    body_category: "top",
    lifestyle_category: "casual",
    layer: "middle",
    allowed_gender: "men",
    allowed_age: "adult",
};
const child: Categories = { ...parent, id: "11", parent_id: 1, level: 2, name: "シャツ", allowed_gender: "women" };
function setup(value: CategoryValue = { id: null, name: "", level: 0, parent_id: null }) {
    const change = vi.fn();
    const constraint = vi.fn();
    function Host() {
        const [v, set] = useState(value);
        return (
            <Category
                value={v}
                onChange={(next) => {
                    change(next);
                    set(next);
                }}
                onConstraintChange={constraint}
                level1List={[parent, { ...parent, id: "2", name: "ボトムス" }]}
            />
        );
    }
    return { ...render(<Host />), change, constraint };
}
beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.test");
});
describe("Category", () => {
    it("U09 初期level1は親制約を通知する", () => {
        const { constraint } = setup(parent);
        expect(screen.getAllByPlaceholderText("カテゴリーを選択してください")[0]).toHaveValue("トップス");
        expect(constraint).toHaveBeenCalledWith({ allowed_gender: "men", allowed_age: "adult" });
    });
    it("U09 初期level2は親と子を表示しGETする", async () => {
        const get = vi.fn();
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        server.use(
            http.get("https://api.test/categories/1/level2", ({ request }) => {
                get(request.cache);
                return HttpResponse.json({ category2: [child] });
            }),
        );
        setup(child);
        await waitFor(() => expect(get).toHaveBeenCalledOnce());
        expect(fetchSpy).toHaveBeenCalledWith("https://api.test/categories/1/level2", { cache: "no-store" });
        expect(screen.getAllByPlaceholderText("カテゴリーを選択してください")[0]).toHaveValue("トップス");
        expect(screen.getAllByPlaceholderText("カテゴリーを選択してください")[1]).toHaveValue("シャツ");
    });
    it("U09 親/子選択と選択しないで親へ戻す", async () => {
        server.use(http.get("https://api.test/categories/1/level2", () => HttpResponse.json({ category2: [child] })));
        const { change, constraint } = setup();
        await userEvent.click(screen.getByPlaceholderText("カテゴリーを選択してください"));
        await userEvent.click(screen.getByText("トップス"));
        await userEvent.click(screen.getAllByPlaceholderText("カテゴリーを選択してください")[1]);
        await userEvent.click(await screen.findByText("シャツ"));
        expect(change).toHaveBeenLastCalledWith({ id: "11", name: "シャツ", level: 2, parent_id: 1 });
        expect(constraint).toHaveBeenLastCalledWith({ allowed_gender: "women", allowed_age: "adult" });
        await userEvent.click(screen.getAllByPlaceholderText("カテゴリーを選択してください")[1]);
        await userEvent.click(screen.getByText("選択しない"));
        expect(change).toHaveBeenLastCalledWith({ id: "1", name: "トップス", level: 1, parent_id: null });
    });
    it.each(["empty", "http", "network", "json"])("U09 候補取得%sでも例外を外に出さない", async (kind) => {
        const error = vi.spyOn(toast, "error");
        vi.spyOn(console, "error").mockImplementation(() => {});
        server.use(
            http.get("https://api.test/categories/1/level2", () =>
                kind === "network"
                    ? HttpResponse.error()
                    : kind === "json"
                      ? new HttpResponse("invalid")
                      : HttpResponse.json(kind === "http" ? { message: "failed" } : { category2: [] }, {
                            status: kind === "http" ? 500 : 200,
                        }),
            ),
        );
        setup();
        await userEvent.click(screen.getByPlaceholderText("カテゴリーを選択してください"));
        await userEvent.click(screen.getByText("トップス"));
        await userEvent.click(screen.getAllByPlaceholderText("カテゴリーを選択してください")[1]);
        if (kind === "empty") expect(await screen.findByText("選択しない")).toBeInTheDocument();
        else await waitFor(() => expect(error).toHaveBeenCalledWith("詳細カテゴリーの取得に失敗しました。"));
    });
    it.each([false, true])("AF-F7 初期選択%sで親Aの遅い応答はB選択後の候補を上書きしない", async (initialSelection) => {
        let resolveA!: () => void;
        const delayed = new Promise<void>((resolve) => {
            resolveA = resolve;
        });
        const originalFetch = globalThis.fetch;
        let oldParsed = false;
        vi.spyOn(globalThis, "fetch").mockImplementation(async (...args) => {
            const response = await originalFetch(...args);
            if (String(args[0]).includes("/categories/1/level2")) {
                const parse = response.json.bind(response);
                response.json = async () => {
                    const data = await parse();
                    oldParsed = true;
                    return data;
                };
            }
            return response;
        });
        let requested = false;
        server.use(
            http.get("https://api.test/categories/:id/level2", async ({ params }) => {
                if (params.id === "1") {
                    requested = true;
                    await delayed;
                    return HttpResponse.json({ category2: [child] });
                }
                return HttpResponse.json({ category2: [{ ...child, id: "21", parent_id: 2, name: "ズボン" }] });
            }),
        );
        setup(initialSelection ? child : undefined);
        const choose = async (name: string) => {
            fireEvent.focus(screen.getAllByPlaceholderText("カテゴリーを選択してください")[0]);
            await userEvent.click(screen.getByText(name));
        };
        if (!initialSelection) await choose("トップス");
        await waitFor(() => expect(requested).toBe(true));
        await choose("ボトムス");
        fireEvent.focus(screen.getAllByPlaceholderText("カテゴリーを選択してください")[1]);
        expect(await screen.findByText("ズボン")).toBeInTheDocument();
        resolveA();
        await waitFor(() => expect(oldParsed).toBe(true));
        await waitFor(() => expect(screen.getByText("ズボン")).toBeInTheDocument());
        expect(screen.queryByText("シャツ")).not.toBeInTheDocument();
        expect(screen.getAllByPlaceholderText("カテゴリーを選択してください")[0]).toHaveValue("ボトムス");
    });
});

it("AF-F7 unmount後のカテゴリー取得失敗は通知しない", async () => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
        finish = resolve;
    });
    const originalFetch = globalThis.fetch;
    let parsed = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (...args) => {
        const response = await originalFetch(...args);
        const parse = response.json.bind(response);
        response.json = async () => {
            const data = await parse();
            parsed = true;
            return data;
        };
        return response;
    });
    let requested = false;
    const error = vi.spyOn(toast, "error");
    server.use(
        http.get("https://api.test/categories/1/level2", async () => {
            requested = true;
            await gate;
            return HttpResponse.json({ message: "failed" }, { status: 500 });
        }),
    );
    const { unmount } = setup();
    await userEvent.click(screen.getByPlaceholderText("カテゴリーを選択してください"));
    await userEvent.click(screen.getByText("トップス"));
    await waitFor(() => expect(requested).toBe(true));
    unmount();
    finish();
    await waitFor(() => expect(parsed).toBe(true));
    expect(error).not.toHaveBeenCalled();
});
