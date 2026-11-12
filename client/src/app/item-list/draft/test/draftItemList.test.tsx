import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import useSWR from "swr";
import { DraftItemList } from "../draftItemList";
import { DraftItem } from "../draftItem";
import { Pagination } from "../../_components/pagination";
import { SearchField } from "../../_components/searchField";
const state = vi.hoisted(() => ({
    data: undefined as
        | undefined
        | {
              itemDraftList: { itemDraft: { id: number } }[];
              totalPages: number;
          },
    error: undefined as Error | undefined,
    mutate: vi.fn(),
}));
vi.mock("swr", () => ({ default: vi.fn(() => state) }));
vi.mock("../draftItem", () => ({
    DraftItem: vi.fn(
        ({
            itemDraft,
        }: {
            itemDraft: {
                id: number;
            };
        }) => <p>{itemDraft.id}</p>,
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
const change = (value: string) => fireEvent.change(screen.getByPlaceholderText("検索"), { target: { value } });
const key = () => vi.mocked(useSWR).mock.calls.at(-1)?.[0];
beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost/api");
    state.data = { itemDraftList: [{ itemDraft: { id: 101 } }, { itemDraft: { id: 102 } }], totalPages: 3 };
    state.error = undefined;
});
describe("一覧状態", () => {
    it.each([0, 1, 3])("U-L01 総数%sの順序とmutateを保持", (totalPages) => {
        state.data!.totalPages = totalPages;
        render(<DraftItemList />);
        expect(screen.getAllByText(/10[12]/).map((e) => e.textContent)).toEqual(["101", "102"]);
        expect(vi.mocked(DraftItem).mock.calls.map((c) => c[0].mutate)).toEqual([state.mutate, state.mutate]);
        expect(vi.mocked(Pagination).mock.calls[0][0]).toMatchObject({ currentPage: 1, totalPages });
    });
    it.each(["empty", "pending"])("U-L01 %sは行とページなし", (kind) => {
        state.data = kind === "empty" ? { itemDraftList: [], totalPages: 0 } : undefined;
        render(<DraftItemList />);
        expect(screen.getByPlaceholderText("検索")).toBeInTheDocument();
        expect(DraftItem).not.toHaveBeenCalled();
        expect(Pagination).not.toHaveBeenCalled();
        expect(screen.queryAllByText("商品が見つかりません")).toHaveLength(kind === "empty" ? 1 : 0);
    });
    it("U-L02 非空入力でページだけ戻る", () => {
        render(<DraftItemList />);
        change("旧");
        fireEvent.click(screen.getByText("送信"));
        fireEvent.click(screen.getByText("移動"));
        change("新");
        expect(key()).toBe("http://localhost/api/item-draft/list?page=1&keyword=%E6%97%A7");
        expect(screen.getByPlaceholderText("検索")).toHaveValue("新");
    });
    it.each(["Enter", "icon"])("U-L03 %sで確定する", (action) => {
        render(<DraftItemList />);
        change(" シャツ ");
        expect(String(key())).not.toContain("keyword");
        if (action === "Enter") fireEvent.keyDown(screen.getByPlaceholderText("検索"), { key: "Enter" });
        else fireEvent.click(screen.getByText("送信"));
        expect(key()).toBe("http://localhost/api/item-draft/list?page=1&keyword=%E3%82%B7%E3%83%A3%E3%83%84");
    });
    it.each(["", " ", "　"])("U-L04 空白%jで解除", (value) => {
        render(<DraftItemList />);
        change("語");
        fireEvent.click(screen.getByText("送信"));
        fireEvent.click(screen.getByText("移動"));
        change(value);
        expect(key()).toBe("http://localhost/api/item-draft/list?page=1");
        expect(screen.getByPlaceholderText("検索")).toHaveValue(value);
    });
    it.each([true, false])("U-L05 error時のdata有無%s", (hasData) => {
        state.error = new Error("fail");
        if (!hasData) state.data = undefined;
        render(<DraftItemList />);
        expect(screen.queryAllByText("101")).toHaveLength(hasData ? 1 : 0);
        expect(screen.queryByText(/エラー|Loading/)).not.toBeInTheDocument();
    });
});
