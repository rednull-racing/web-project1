import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttributesInput, type AttributesValue } from "../attributes";
const colored = (): AttributesValue => ({
    all_inventory: 2,
    colorVariants: [
        {
            _uiId: "red",
            color: "赤",
            inventory: 2,
            image: null,
            image_uploaded: true,
            sizes: [{ size: "M", inventory: 2 }],
        },
    ],
});
function setup(initial: AttributesValue = { all_inventory: 1, colorVariants: [] }) {
    const change = vi.fn();
    function Host() {
        const [value, set] = useState(initial);
        return (
            <AttributesInput
                value={value}
                onChange={(next) => {
                    change(next);
                    set(next);
                }}
                imageUrlMap={new Map([["red", "https://example.test/red.png"]])}
            />
        );
    }
    return { ...render(<Host />), change };
}
beforeEach(() => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:attribute-preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
describe("AttributesInput", () => {
    it.each([0, 2])("U12 全在庫%dで補正・色生成", (quantity) => {
        const { change } = setup();
        fireEvent.change(screen.getByRole("spinbutton"), { target: { value: String(quantity) } });
        expect(change).toHaveBeenLastCalledWith(
            quantity === 2
                ? {
                      all_inventory: 2,
                      colorVariants: [
                          {
                              _uiId: expect.any(String),
                              color: null,
                              inventory: 1,
                              image: null,
                              image_uploaded: true,
                              sizes: [],
                          },
                      ],
                  }
                : { all_inventory: 1, colorVariants: [] },
        );
    });
    it("U12 全在庫1へ変更すると既存色削除", () => {
        const { change } = setup(colored());
        fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "1" } });
        expect(change).toHaveBeenLastCalledWith({ all_inventory: 1, colorVariants: [] });
        expect(screen.queryByPlaceholderText("カラーを入力してください")).not.toBeInTheDocument();
    });
    it("U12 色/サイズ追加変更削除・他色保持", async () => {
        const { change, container } = setup(colored());
        await userEvent.click(screen.getByText("追加する"));
        expect(screen.getAllByPlaceholderText("カラーを入力してください")).toHaveLength(2);
        await userEvent.type(screen.getAllByPlaceholderText("カラーを入力してください")[1], "青");
        await userEvent.click(screen.getAllByRole("button", { name: "+ サイズ追加" })[1]);
        await userEvent.type(screen.getAllByPlaceholderText("S")[1], "L");
        const latest = () => change.mock.calls.at(-1)![0] as AttributesValue;
        expect(latest().colorVariants[0]).toEqual(colored().colorVariants[0]);
        expect(latest().colorVariants[1].sizes).toEqual([{ size: "L", inventory: 1 }]);
        fireEvent.change(screen.getAllByRole("spinbutton").at(-1)!, { target: { value: "0" } });
        expect(latest().colorVariants[1].sizes[0].inventory).toBe(1);
        await userEvent.click(container.querySelectorAll('svg[data-icon="trash"]')[1]);
        expect(latest().colorVariants[1].sizes).toEqual([]);
        await userEvent.click(screen.getByText("追加する"));
        expect(screen.getAllByPlaceholderText("カラーを入力してください")).toHaveLength(2);
        fireEvent.change(screen.getAllByRole("spinbutton")[1], { target: { value: "0" } });
        expect(latest().colorVariants[0].inventory).toBe(1);
        await userEvent.click(container.querySelectorAll("svg.lucide-x")[0]);
        expect(latest().colorVariants).toHaveLength(1);
        expect(latest().colorVariants[0].color).toBe("青");
    });
    it("U12 画像差替え・プレビュー解放・既存map", async () => {
        const { change, unmount } = setup(colored());
        expect(screen.getByAltText("attributes_preview").getAttribute("src")).toContain("red.png");
        const file = new File(["blue"], "blue.png", { type: "image/png" });
        await userEvent.upload(screen.getByPlaceholderText("画像をアップロード"), file);
        expect(change).toHaveBeenLastCalledWith(
            expect.objectContaining({
                colorVariants: [expect.objectContaining({ image: file, image_uploaded: false })],
            }),
        );
        expect(screen.getByAltText("attributes_preview")).toHaveAttribute("src", "blob:attribute-preview");
        unmount();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:attribute-preview");
    });
    it("Q06 小数在庫は整数へ補正されない（観測）", () => {
        const { change } = setup(colored());
        fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "1.5" } });
        expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ all_inventory: 1.5 }));
    });
});
