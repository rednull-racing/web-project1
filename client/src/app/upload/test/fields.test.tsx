import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ItemNameDetail } from "../itemNameDetail";
import { MaterialInput, type MaterialValue } from "../material";
import { ConditionInput } from "../condition";
import { ShippingInput } from "../shipping";
import { PriceInput } from "../price";

describe("入力部品", () => {
    it.each([[49, 499], [50, 500], [51, 501]])("U07 商品名/詳細 %d/%d文字", async (nameLength, detailLength) => {
        function Host() { const [value, onChange] = useState({ name: "", detail: "" }); return <ItemNameDetail value={value} onChange={onChange} />; }
        render(<Host />);
        fireEvent.change(screen.getByPlaceholderText("商品名（50文字以内）"), { target: { value: "あ".repeat(48) } });
        await userEvent.type(screen.getByPlaceholderText("商品名（50文字以内）"), "あ".repeat(nameLength - 48));
        fireEvent.change(screen.getByPlaceholderText("詳細な商品情報（最大500文字まで）"), { target: { value: "い".repeat(498) } });
        await userEvent.type(screen.getByPlaceholderText("詳細な商品情報（最大500文字まで）"), "い".repeat(detailLength - 498));
        expect(screen.getByPlaceholderText("商品名（50文字以内）")).toHaveValue("あ".repeat(Math.min(nameLength, 50)));
        expect(screen.getByPlaceholderText("詳細な商品情報（最大500文字まで）")).toHaveValue("い".repeat(Math.min(detailLength, 500)));
    });
    it("U13 素材追加/変更/中間削除は他行保持", async () => {
        const change = vi.fn();
        function Host() { const [value, setValue] = useState<MaterialValue>({ materials: [{ name: "綿", ratio: 60 }, { name: "麻", ratio: 40 }] }); return <MaterialInput value={value} onChange={(v) => { change(v); setValue(v); }} />; }
        const { container } = render(<Host />);
        await userEvent.click(screen.getByRole("button", { name: "+ 素材追加（自由入力）" }));
        expect(change).toHaveBeenLastCalledWith({ materials: [{ name: "綿", ratio: 60 }, { name: "麻", ratio: 40 }, { name: "", ratio: 1 }] });
        await userEvent.type(screen.getAllByPlaceholderText("例：綿")[2], "絹");
        fireEvent.change(screen.getAllByPlaceholderText("100")[2], { target: { value: "10" } });
        expect(screen.getAllByPlaceholderText("100")[2]).toHaveAttribute("max", "100");
        await userEvent.click(container.querySelectorAll("svg")[1]);
        expect(change).toHaveBeenLastCalledWith({ materials: [{ name: "綿", ratio: 60 }, { name: "絹", ratio: 10 }] });
    });
    it("U14 状態初期値/同値抑止/変更/空一覧", async () => {
        const change = vi.fn();
        const props = { allCondition: [{ id: "1", name: "新品" }, { id: "2", name: "中古" }], value: { id: "1", name: "新品" }, onChange: change };
        const { rerender } = render(<ConditionInput {...props} />);
        expect(screen.getByPlaceholderText("商品の状態を選択")).toHaveValue("新品");
        await userEvent.click(screen.getByPlaceholderText("商品の状態を選択"));
        await userEvent.click(screen.getByText("新品"));
        expect(change).not.toHaveBeenCalled();
        await userEvent.click(screen.getByPlaceholderText("商品の状態を選択"));
        await userEvent.click(screen.getByText("中古"));
        expect(change).toHaveBeenCalledExactlyOnceWith({ id: "2", name: "中古" });
        rerender(<ConditionInput {...props} allCondition={[]} />);
        await userEvent.click(screen.getByPlaceholderText("商品の状態を選択"));
        expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    });
    it("U14 配送選択は他値保持・備考nullは空", async () => {
        const change = vi.fn();
        function Host() {
            const [value, setValue] = useState<Parameters<typeof ShippingInput>[0]["value"]>({ day_id: "1", day_name: "翌日", service_id: "1", service_name: "宅配", place_id: "1", place_name: "東京", free_text: null as string | null });
            return <ShippingInput allDay={[{ id: "1", name: "翌日" }, { id: "2", name: "翌週" }]} allService={[{ id: "1", name: "宅配" }, { id: "2", name: "郵便" }]} allPlace={[{ id: "1", name: "東京" }, { id: "2", name: "大阪" }]} value={value} onChange={(v) => { change(v); setValue(v); }} />;
        }
        render(<Host />);
        const note = screen.getByPlaceholderText("配送方法や梱包、開封方法、対応可能時間など自由入力");
        expect(note).toHaveValue("");
        await userEvent.click(screen.getByRole("radio", { name: "翌日" }));
        expect(change).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole("radio", { name: "翌週" }));
        await userEvent.click(screen.getByPlaceholderText("配送方法を選択"));
        await userEvent.click(screen.getByText("郵便"));
        await userEvent.click(screen.getByPlaceholderText("発送元地域を選択"));
        await userEvent.click(screen.getByText("大阪"));
        await userEvent.type(note, "丁寧に梱包");
        expect(change).toHaveBeenLastCalledWith({ day_id: "2", day_name: "翌週", service_id: "2", service_name: "郵便", place_id: "2", place_name: "大阪", free_text: "丁寧に梱包" });
    });
    it.each([499, 500, 501])("U07 配送備考%d文字上限", async (length) => {
        function Host() { const [value, onChange] = useState({ day_id: null, day_name: null, service_id: null, service_name: null, place_id: null, place_name: null, free_text: "" } as Parameters<typeof ShippingInput>[0]["value"]); return <ShippingInput allDay={[]} allService={[]} allPlace={[]} value={value} onChange={onChange} />; }
        render(<Host />);
        const input = screen.getByPlaceholderText("配送方法や梱包、開封方法、対応可能時間など自由入力");
        fireEvent.change(input, { target: { value: "あ".repeat(498) } });
        await userEvent.type(input, "あ".repeat(length - 498));
        expect(input).toHaveValue("あ".repeat(Math.min(length, 500)));
    });
    it.each([["1,000", 1000], ["", 0], ["abc", NaN]])("U15 価格入力%sを数値へ", (text, expected) => {
        const change = vi.fn();
        render(<PriceInput value={{ price: 999 }} onChange={change} />);
        fireEvent.change(screen.getByPlaceholderText("例：30,000"), { target: { value: text } });
        expect(change).toHaveBeenLastCalledWith({ price: expected });
    });
    it("AF-F8 propsを0へ変えると派生金額も0へ更新", () => {
        const { rerender } = render(<PriceInput value={{ price: 1000 }} onChange={vi.fn()} />);
        rerender(<PriceInput value={{ price: 0 }} onChange={vi.fn()} />);
        expect(screen.getByPlaceholderText("例：30,000")).toHaveValue("");
        expect(screen.getAllByText("￥0")).toHaveLength(2);
    });
});
