import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpload, type UploadParams } from "../useUpload";
import { params } from "./fixtures";
let validateUpload: ReturnType<typeof useUpload>["validateUpload"];
let validateForDraft: ReturnType<typeof useUpload>["validateForDraft"];
let createBody: ReturnType<typeof useUpload>["createBody"];
beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    ({ validateUpload, validateForDraft, createBody } = renderHook(useUpload).result.current);
});
const required: [string, (p: UploadParams) => void, string][] = [
    ["video", p => { p.videoInput.videoUploaded = false; }, "動画ファイルを選択してください"],
    ["thumbnail", p => { p.videoInput.thumbnailUploaded = false; }, "サムネイルを選択してください"],
    ["title", p => { p.videoInput.title = "  "; }, "動画タイトルを入力してください"],
    ["images", p => { p.itemImages = []; }, "商品画像を選択してください"],
    ["name", p => { p.itemNameDetail.name = "  "; }, "商品名を入力してください"],
    ["category", p => { p.categoryValue.id = null; }, "カテゴリーを選択してください"],
    ["gender", p => { p.genderAgeValue.gender_type = null; }, "着用対象（性別）を選択してください"],
    ["age", p => { p.genderAgeValue.age_type = null; }, "着用対象（年齢）を選択してください"],
    ["inventory", p => { p.attributesValue = { all_inventory: 0, colorVariants: [] }; }, "出品点数を1点以上入力してください"],
    ["condition", p => { p.conditionValue.id = ""; }, "商品の状態を選択してください"],
    ["day", p => { p.shippingValue.day_id = null; }, "発送までの日数を選択してください"],
    ["service", p => { p.shippingValue.service_id = null; }, "配送方法を選択してください"],
    ["place", p => { p.shippingValue.place_id = null; }, "発送元地域を選択してください"],
];
describe("upload検証とbody", () => {
    it.each(required)("U01 必須 %s", (_, change, message) => { const p = params(); change(p); expect(validateUpload(p)).toEqual({ ok: false, message }); });
    it("U01 複数欠落は動画を先に通知", () => { const p = params(); p.videoInput.videoUploaded = false; p.videoInput.title = ""; expect(validateUpload(p).message).toBe("動画ファイルを選択してください"); });
    it.each([[299, false], [300, true], [1000000, true], [1000001, false], [NaN, false]])("U02 価格 %s", (price, ok) => { const p = params(); p.priceValue.price = price; expect(validateUpload(p).ok).toBe(ok); });
    it.each([0, 99, 100, 101])("U02 素材合計 %s", ratio => { const p = params(); p.materialValue.materials = [{ name: "綿", ratio }]; expect(validateUpload(p).ok).toBe(ratio <= 100); expect(validateForDraft(p).ok).toBe(ratio <= 100); });
    it.each([0, 1, 2, 3])("U03 色合計 %s", total => { const p = params(); p.attributesValue.colorVariants[0].inventory = total; p.attributesValue.colorVariants[0].sizes = []; expect(validateUpload(p).ok).toBe(total < 2 || total === 2); });
    it.each([0, 1, 2, 3])("U03 サイズ合計 %s", total => { const p = params(); p.attributesValue.colorVariants[0].sizes[0].inventory = total; expect(validateUpload(p).ok).toBe(total < 2 || total === 2); });
    it("U03 素材→色→サイズの検証順", () => { const p = params(); p.materialValue.materials[0].ratio = 101; p.attributesValue.all_inventory = 4; expect(validateUpload(p).message).toContain("素材"); p.materialValue.materials = []; expect(validateUpload(p).message).toContain("カラー"); });
    it("U04 下書きは必須未入力と価格0を許容", () => { const p = params(); required.forEach(([, change]) => change(p)); p.priceValue.price = 0; expect(validateForDraft(p)).toEqual({ ok: true }); });
    it.each([[2, 3, true], [2, 2, true], [3, 2, false], [1, 3, true]])("U04 AF-F3 色%s 全%s", (total, all, ok) => { const p = params(); p.attributesValue.all_inventory = all; p.attributesValue.colorVariants[0].inventory = total; p.attributesValue.colorVariants[0].sizes = []; expect(validateForDraft(p).ok).toBe(ok); });
    it.each([[2, 3, true], [2, 2, true], [3, 2, false], [1, 3, true]])("U04 サイズ%s 全%s", (total, all, ok) => { const p = params(); p.attributesValue.all_inventory = all; p.attributesValue.colorVariants[0].inventory = 1; p.attributesValue.colorVariants[0].sizes[0].inventory = total; expect(validateForDraft(p).ok).toBe(ok); });
    it("U05 全項目のJSON変換と非破壊", () => {
        const p = params(); const before = structuredClone(p.itemNameDetail);
        expect(createBody(p)).toEqual({
            video: { name: "unknown", type: undefined, uploaded: true }, thumbnail: { name: "unknown", type: undefined, uploaded: true },
            videoMeta: { title: "着用動画", summary: "概要" }, itemImages: [{ name: "old.jpg", type: null, uploaded: true }],
            itemMeta: before, category: { id: "10", name: "シャツ", parent_id: "1", level: 2 }, genderAge: { gender: "unisex", age: "adult" }, brand: { id: "20", name: "ブランド" },
            attributes: { allInventory: 2, colorVariants: [{ uiId: "red", color: "赤", inventory: 2, image: undefined, sizes: [{ size: "M", inventory: 2 }] }], materials: [{ name: "綿", ratio: 60 }, { name: "麻", ratio: 40 }] },
            condition: { id: "1", name: "新品" }, shipping: { day: "2", service: "3", place: "4", freeText: null }, price: 1000,
        }); expect(p.itemNameDetail).toEqual(before);
    });
    it("U05 新規/既存/末尾空の画像、属性resolver", () => { const p = params(); const file = new File(["new"], "new.png", { type: "image/png" }); p.videoInput.videoFile = new File(["v"], "video.mp4", { type: "video/mp4" }); p.videoInput.videoUploaded = false; p.videoInput.thumbnailFile = file; p.videoInput.thumbnailUploaded = false; p.itemImages.push({ id: "new", file, preview: "blob:new", uploaded: false }, { id: "empty", file: null, preview: "", uploaded: true }); p.resolveAttributesImage = vi.fn(() => ({ name: "red.png", type: "image/png", uploaded: false })); const body = createBody(p); expect(body.video).toEqual({ name: "video.mp4", type: "video/mp4", uploaded: false }); expect(body.thumbnail).toEqual({ name: "new.png", type: "image/png", uploaded: false }); expect(body.itemImages).toEqual([{ name: "old.jpg", type: null, uploaded: true }, { name: "new.png", type: "image/png", uploaded: false }, { name: "unknown", type: null, uploaded: true }]); expect(body.attributes.colorVariants[0].image).toEqual({ name: "red.png", type: "image/png", uploaded: false }); expect(p.resolveAttributesImage).toHaveBeenCalledWith(p.attributesValue.colorVariants[0]); expect(JSON.stringify(body)).not.toContain("blob:"); });
    it.each([-1, 1.5])("Q06 観測 素材ratio %sは合計上限以外の検査なし", ratio => { const p = params(); p.materialValue.materials = [{ name: "綿", ratio }]; expect(validateUpload(p).ok).toBe(true); });
    it("Q06 観測 小数価格は通過しInfinityは拒否", () => { const p = params(); p.priceValue.price = 300.5; expect(validateUpload(p).ok).toBe(true); p.priceValue.price = Infinity; expect(validateUpload(p).ok).toBe(false); });
});
it("Q06 観測 Hookは文字数・MIME・小数在庫を追加検査しない", () => {
    const p = params(); p.videoInput.title = "x".repeat(51); p.itemNameDetail.name = "x".repeat(51);
    p.videoInput.videoFile = new File(["plain text"], "fake.mp4", { type: "text/plain" });
    p.attributesValue.all_inventory = 1.5; p.attributesValue.colorVariants = [];
    const { result } = renderHook(useUpload); expect(result.current.validateUpload(p).ok).toBe(true);
    expect(result.current.createBody(p).video.type).toBe("text/plain");
});

it("AF-F10 API由来数値IDとnullのメタ情報を送信契約へ正規化", () => {
    const p = params();
    // API応答とUI型の不一致を境界入力で再現する。
    p.categoryValue = JSON.parse('{"id":10,"name":"親","parent_id":2,"level":2}');
    p.brandValue = JSON.parse('{"id":20,"name":"ブランド"}');
    p.conditionValue = JSON.parse('{"id":1,"name":"新品"}');
    p.shippingValue = { ...p.shippingValue, ...JSON.parse('{"day_id":2,"service_id":3,"place_id":4}') };
    p.attributesValue.colorVariants[0].color = null;
    p.attributesValue.colorVariants[0].sizes[0].size = null;
    const body = JSON.parse(JSON.stringify(createBody(p)));
    expect(body.category).toEqual({ id: "10", name: "親", parent_id: "2", level: 2 });
    expect(body.brand.id).toBe("20"); expect(body.condition.id).toBe("1");
    expect(body.shipping).toMatchObject({ day: "2", service: "3", place: "4" });
    expect(body.video).not.toHaveProperty("type"); expect(body.thumbnail).not.toHaveProperty("type");
    expect(body.attributes.colorVariants[0]).not.toHaveProperty("image");
    expect(body.attributes.colorVariants[0]).not.toHaveProperty("color");
    expect(body.attributes.colorVariants[0].sizes[0].size).toBe("");
    p.categoryValue.id = null; p.categoryValue.level = 0;
    expect(createBody(p).category).toMatchObject({ id: null, level: 1 });
});
