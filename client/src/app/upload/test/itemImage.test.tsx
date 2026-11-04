import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ItemImage } from "../itemImage";

const images = (count: number) => Array.from({ length: count }, (_, id) => ({ id: String(id), file: null, uploaded: true, preview: `https://example.test/${id}.png` }));
describe("ItemImage", () => {
    it.each([0, 9, 10])("U08 %d枚で追加可否と元順序", (count) => {
        render(<ItemImage images={images(count)} onAdd={vi.fn()} onRemove={vi.fn()} />);
        expect(screen.getByPlaceholderText("商品画像をアップロード").hasAttribute("disabled")).toBe(count === 10);
        expect(screen.queryAllByRole("img")).toHaveLength(count);
        screen.queryAllByRole("img").forEach((img, index) => expect(img).toHaveAttribute("alt", `商品画像-${index}`));
    });
    it("U08 複数追加を親へ渡し同一ファイルを再選択可能", async () => {
        const add = vi.fn();
        render(<ItemImage images={[]} onAdd={add} onRemove={vi.fn()} />);
        const file = new File(["img"], "image.png", { type: "image/png" });
        const input = screen.getByPlaceholderText("商品画像をアップロード");
        await userEvent.upload(input, [file, file]);
        expect(Array.from(add.mock.calls[0][0] as FileList)).toEqual([file, file]);
        expect(input).toHaveValue("");
        await userEvent.upload(input, file);
        expect(add).toHaveBeenCalledTimes(2);
    });
    it.each([0, 1, 2])("U08 削除対象index=%dを親へ渡す", async (index) => {
        const remove = vi.fn();
        const { container } = render(<ItemImage images={images(3)} onAdd={vi.fn()} onRemove={remove} />);
        // 現行の削除アイコンはrole/labelを持たないためsvgを取得する。
        await userEvent.click(container.querySelectorAll("svg")[index]);
        expect(remove).toHaveBeenCalledExactlyOnceWith(index);
    });
});
