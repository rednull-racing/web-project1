import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import useSWR from "swr";
import { TrashItemList } from "../trashItemList";
import { TrashItem } from "../trashItem";
import { Pagination } from "../../_components/pagination";
import { SearchField } from "../../_components/searchField";
const state = vi.hoisted(() => ({
    data: undefined as
        | undefined
        | {
              itemTrashList: { itemTrash: { id: number } }[];
              totalPages: number;
          },
    error: undefined as Error | undefined,
    mutate: vi.fn(),
}));
vi.mock("swr", () => ({ default: vi.fn(() => state) }));
vi.mock("../trashItem", () => ({
    TrashItem: vi.fn(
        ({
            itemTrash,
        }: {
            itemTrash: {
                id: number;
            };
        }) => <p>{itemTrash.id}</p>,
    ),
}));
vi.mock("../../_components/pagination", () => ({
    Pagination: vi.fn((p: ComponentProps<typeof Pagination>) => (
        <button onClick={() => p.onPageChange(3)}>移動</button>
    )),
}));
vi.mock("../../_components/searchField", () => ({
    SearchField: vi.fn((p: ComponentProps<typeof SearchField>) => (
        <>
            <input
                placeholder="検索"
                value={p.searchValue}
                onChange={p.onChange}
                onKeyDown={(e) => {
                    if (e.key === "Enter") p.onSubmit();
                }}
            />
            <button onClick={p.onSubmit}>送信</button>
        </>
    )),
}));
const change = async (value: string) => {
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("検索");
    await user.click(input);
    await user.keyboard("{Control>}a{/Control}");
    await user.keyboard(value || "{Backspace}");
};
const key = () => vi.mocked(useSWR).mock.calls.at(-1)?.[0];
beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost/api");
    state.data = { itemTrashList: [{ itemTrash: { id: 101 } }, { itemTrash: { id: 102 } }], totalPages: 3 };
    state.error = undefined;
});
describe("一覧状態", () => {
    it.each([0, 1, 3])("U-L01 総数%sの順序とmutateを保持", (totalPages) => {
        state.data!.totalPages = totalPages;
        render(<TrashItemList />);
        expect(screen.getAllByText(/10[12]/).map((e) => e.textContent)).toEqual(["101", "102"]);
        expect(vi.mocked(TrashItem).mock.calls.map((c) => c[0].mutate)).toEqual([state.mutate, state.mutate]);
        expect(vi.mocked(Pagination).mock.calls[0][0]).toMatchObject({ currentPage: 1, totalPages });
    });
    it.each(["empty", "pending"])("U-L01 %sは行とページなし", (kind) => {
        state.data = kind === "empty" ? { itemTrashList: [], totalPages: 0 } : undefined;
        render(<TrashItemList />);
        expect(screen.getByPlaceholderText("検索")).toBeInTheDocument();
        expect(TrashItem).not.toHaveBeenCalled();
        expect(Pagination).not.toHaveBeenCalled();
        expect(screen.queryAllByText("商品が見つかりません")).toHaveLength(kind === "empty" ? 1 : 0);
    });
    it("U-L02 非空入力でページだけ戻る", async () => {
        render(<TrashItemList />);
        await change("旧");
        await userEvent.setup().click(screen.getByText("送信"));
        await userEvent.setup().click(screen.getByText("移動"));
        expect(String(key())).toContain("page=3");
        await userEvent.setup().type(screen.getByPlaceholderText("検索"), "新");
        expect(key()).toBe("http://localhost/api/item-trash/list?page=1&keyword=%E6%97%A7");
        expect(screen.getByPlaceholderText("検索")).toHaveValue("旧新");
    });
    it.each(["Enter", "icon"])("U-L03 %sで確定する", async (action) => {
        render(<TrashItemList />);
        await userEvent.setup().click(screen.getByText("移動"));
        await change(" シャツ ");
        expect(String(key())).not.toContain("keyword");
        if (action === "Enter") await userEvent.setup().type(screen.getByPlaceholderText("検索"), "{Enter}");
        else await userEvent.setup().click(screen.getByText("送信"));
        expect(key()).toBe("http://localhost/api/item-trash/list?page=1&keyword=%E3%82%B7%E3%83%A3%E3%83%84");
    });
    it.each(["", " ", "　"])("U-L04 空白%jで解除", async (value) => {
        render(<TrashItemList />);
        await change("語");
        await userEvent.setup().click(screen.getByText("送信"));
        await userEvent.setup().click(screen.getByText("移動"));
        await change(value);
        expect(key()).toBe("http://localhost/api/item-trash/list?page=1");
        expect(screen.getByPlaceholderText("検索")).toHaveValue(value);
    });
    it.each([true, false])("U-L05 error時のdata有無%s", (hasData) => {
        state.error = new Error("fail");
        if (!hasData) state.data = undefined;
        render(<TrashItemList />);
        expect(screen.queryAllByText("101")).toHaveLength(hasData ? 1 : 0);
        expect(screen.queryByText(/エラー|Loading/)).not.toBeInTheDocument();
    });
});
