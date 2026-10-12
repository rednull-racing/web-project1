import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../../src/errors.js";
import { validateBody } from "../../../../src/middleware/validate/validateBody.js";
import { validateParams } from "../../../../src/middleware/validate/validateParams.js";
import { createItemDraftBodySchema as schema } from "../../../../src/validators/body/itemDraft.js";
import { idParamSchema } from "../../../../src/validators/params/id.js";
import { makeBody, makeDuplicateUiIdBody, variantImageStates } from "./fixtures.js";

// 型不正・欠落をschemaへ渡すためのfixture操作。実装の変換処理は再現しない。
const change = (path: string, value: unknown, omit = false) => {
    const body = makeBody();
    body.video = { name: "動画", type: "video/mp4", uploaded: false };
    body.thumbnail = { name: "サムネイル", type: "image/png", uploaded: false };
    body.attributes.colorVariants[0].image = { name: "色画像", type: "image/png", uploaded: false };
    const keys = path.split(".");
    let target = body as unknown as Record<string, unknown>;
    for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
    if (omit) delete target[keys.at(-1)!];
    else target[keys.at(-1)!] = value;
    return body;
};
const parse = (path: string, value: unknown) => schema.safeParse(change(path, value));
beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
    vi.restoreAllMocks();
});

describe("P0: schemaの必須項目と数値境界", () => {
    it.each([
        [299, false],
        [300, true],
        [301, true],
        [999999, true],
        [1000000, true],
        [1000001, false],
    ] as const)("V02: 価格%sの受理=%s", (value, accepted) => {
        expect(parse("price", value).success).toBe(accepted);
    });
    it.each([0, -1, 300.5, "300", null, undefined, NaN, Infinity])("V03: 価格%sは拒否する", (value) => {
        expect(parse("price", value).success).toBe(false);
    });
    describe.each([
        "attributes.allInventory",
        "attributes.colorVariants.0.inventory",
        "attributes.colorVariants.0.sizes.0.inventory",
    ])("V04: %s", (path) => {
        it.each([-1, 0, 1, 1.5, "1", null, undefined])("在庫%sの整数・下限を検証する", (value) => {
            expect(parse(path, value).success).toBe(value === 0 || value === 1);
        });
    });
    it.each([-0.01, 0, 0.01, 99.99, 100, 100.01, null, undefined, "50"])("V05: 素材比率%sの境界を検証する", (value) => {
        expect(parse("attributes.materials.0.ratio", value).success).toBe(
            typeof value === "number" && value >= 0 && value <= 100,
        );
    });
    it.each([0, 1, 2, 1.5, "1", null, undefined])("V06: カテゴリlevel=%sの整数・下限を検証する", (value) => {
        expect(parse("category.level", value).success).toBe(value === 1 || value === 2);
    });
    const required = [
        "itemEditingId",
        "videoMeta",
        "videoMeta.title",
        "videoMeta.summary",
        "itemMeta",
        "itemMeta.name",
        "itemMeta.detail",
        "itemImages",
        "itemImages.0.name",
        "itemImages.0.type",
        "itemImages.0.uploaded",
        "category",
        "category.id",
        "category.name",
        "category.parent_id",
        "category.level",
        "genderAge",
        "genderAge.gender",
        "genderAge.age",
        "brand",
        "brand.id",
        "brand.name",
        "attributes",
        "attributes.allInventory",
        "attributes.colorVariants",
        "attributes.colorVariants.0.uiId",
        "attributes.colorVariants.0.inventory",
        "attributes.colorVariants.0.sizes",
        "attributes.colorVariants.0.sizes.0.size",
        "attributes.colorVariants.0.sizes.0.inventory",
        "attributes.colorVariants.0.image.name",
        "attributes.colorVariants.0.image.uploaded",
        "attributes.materials",
        "attributes.materials.0.name",
        "attributes.materials.0.ratio",
        "condition",
        "condition.id",
        "condition.name",
        "shipping",
        "shipping.day",
        "shipping.service",
        "shipping.place",
        "shipping.freeText",
        "price",
    ];
    describe.each(required)("V07: 必須フィールド%s", (path) => {
        it("欠落を拒否する", () => {
            expect(schema.safeParse(change(path, undefined, true)).success).toBe(false);
        });
        it("booleanへの型違いを拒否する（boolean項目には文字列を指定）", () => {
            expect(parse(path, path.endsWith("uploaded") ? "false" : false).success).toBe(false);
        });
        it("nullはnullableのフィールドだけ受理する", () => {
            const nullable = [
                "videoMeta.summary", "itemMeta.detail", "itemImages.0.type", "category.id", "category.parent_id",
                "genderAge.gender", "genderAge.age", "brand.id", "brand.name", "shipping.day", "shipping.service",
                "shipping.place", "shipping.freeText",
            ];
            expect(parse(path, null).success).toBe(nullable.includes(path));
        });
    });
});

describe("P1: optional・nullableとschemaが制限しない入力", () => {
    describe.each(["video", "thumbnail"])("V09: %s", (field) => {
        it.each(["", ".name", ".type"])("%sの省略を受理する", (suffix) => {
            expect(schema.safeParse(change(`${field}${suffix}`, undefined, true)).success).toBe(true);
        });
        it("uploaded省略は拒否する", () => {
            expect(schema.safeParse(change(`${field}.uploaded`, undefined, true)).success).toBe(false);
        });
    });
    it.each([
        "category.id",
        "category.parent_id",
        "brand.id",
        "brand.name",
        "shipping.day",
        "shipping.service",
        "shipping.place",
        "shipping.freeText",
        "videoMeta.summary",
        "itemMeta.detail",
    ])("V08: %sのnullを受理する", (path) => {
        expect(parse(path, null).success).toBe(true);
    });
    it.each([
        [null, false],
        ["", true],
    ] as const)("V08: condition.id=%sの受理=%s", (value, accepted) => {
        expect(parse("condition.id", value).success).toBe(accepted);
    });
    describe.each(["genderAge.gender", "genderAge.age"])("V15: %s", (path) => {
        it.each(["unisex", "both", null, "任意文字列"])("%sはschemaでは受理する（DB制約は対象外）", (value) => {
            expect(parse(path, value).success).toBe(true);
        });
    });
    it.each([0, 1, 10, 11])("V12: 商品画像%s件をschemaでは受理する", (count) => {
        const body = makeBody();
        body.itemImages = Array.from({ length: count }, () => ({ name: "画像", type: "image/png", uploaded: false }));
        expect(schema.safeParse(body).success).toBe(true);
    });
    describe.each(["itemMeta.name", "videoMeta.title", "shipping.freeText", "brand.name"])("V16: %s", (path) => {
        it.each([0, 1, 2, 254, 255, 256])("日本語%s文字をschemaでは受理する", (length) => {
            expect(parse(path, "あ".repeat(length)).success).toBe(true);
        });
    });
    it.each(["attributes.colorVariants", "attributes.colorVariants.0.sizes", "attributes.materials"])(
        "V12: %sの空配列を受理する",
        (path) => {
            expect(parse(path, []).success).toBe(true);
        },
    );
    it("V12: 素材合計100以外と単独の空uiIdを受理する", () => {
        const body = makeBody();
        body.attributes.materials = [{ name: "綿", ratio: 0.1 }];
        body.attributes.colorVariants[0].uiId = "";
        expect(schema.safeParse(body).success).toBe(true);
    });
    it.each([null, "", "application/unknown"])("V10: 商品画像type=%sを受理する", (value) => {
        expect(parse("itemImages.0.type", value).success).toBe(true);
    });
    it.each(["video.type", "thumbnail.type", "attributes.colorVariants.0.image.type"])(
        "V10: %sの任意MIME文字列を受理する",
        (path) => {
            expect(parse(path, "application/unknown").success).toBe(true);
        },
    );
    it("V18: 未知キーはトップレベルも入れ子も除去する", () => {
        const body = makeBody();
        Object.assign(body, { seller_id: 999, status: "published" });
        Object.assign(body.itemMeta, { owner: 999 });
        const result = schema.parse(body);
        expect(result).not.toHaveProperty("seller_id");
        expect(result).not.toHaveProperty("status");
        expect(result.itemMeta).not.toHaveProperty("owner");
    });
    it("V17: 大きな整数・長文・多数の色サイズを受理して保持する", () => {
        const body = makeBody();
        body.attributes.allInventory = Number.MAX_SAFE_INTEGER;
        body.itemMeta.detail = "説明".repeat(10000);
        body.attributes.colorVariants = Array.from({ length: 20 }, (_, index) => ({
            uiId: String(index),
            inventory: 100000,
            sizes: Array.from({ length: 20 }, (_, size) => ({ size: String(size), inventory: 100000 })),
        }));
        expect(schema.parse(body)).toEqual(body);
    });
});

describe("V20 V19: middlewareの引渡しと失敗", () => {
    it("V19 V18: parse済みbodyを格納してnextを1回呼ぶ", () => {
        const body = { ...makeBody(), seller_id: 99 };
        const req = { body } as Request;
        const next = vi.fn();
        validateBody(schema)(req, {} as Response, next);
        expect(req.validatedBody).toEqual(makeBody());
        expect(req.validatedBody).not.toBe(req.body);
        expect(next).toHaveBeenCalledExactlyOnceWith();
    });
    it("V19: 失敗時はINVALID_BODYをthrowしnextを呼ばない", () => {
        const req = { body: {} } as Request;
        const next = vi.fn();
        const run = () => validateBody(schema)(req, {} as Response, next);
        expect(run).toThrow(AppError);
        expect(run).toThrow(expect.objectContaining({ code: "INVALID_BODY", statusCode: 400 }));
        expect(next).not.toHaveBeenCalled();
        expect(req.validatedBody).toBeUndefined();
    });
    it.each(["1", "0", "-1", "1.5", "abc"])("V20: params.id=%sを検証する", (id) => {
        const req = { params: { id } } as unknown as Request;
        const next = vi.fn();
        const run = () => validateParams(idParamSchema)(req, {} as Response, next);
        if (id === "1") {
            run();
            expect(req.validatedParams).toEqual({ id: 1 });
            expect(next).toHaveBeenCalledOnce();
        } else {
            expect(run).toThrow(AppError);
            expect(run).toThrow(expect.objectContaining({ code: "INVALID_PARAMS", statusCode: 400 }));
            expect(next).not.toHaveBeenCalled();
            expect(req.validatedParams).toBeUndefined();
        }
    });
});

describe("P0: colorVariantsのuiId一意性", () => {
    describe.each(variantImageStates)("V13: 先頭画像=%s", (first) => {
        it.each(variantImageStates)("後続画像=%sでも重複uiIdを拒否し該当位置へエラーを付ける", (second) => {
            const body = makeDuplicateUiIdBody(first, second);
            const parsed = schema.safeParse(body);
            expect(parsed.success).toBe(false);
            if (parsed.success) throw new Error("重複uiIdが受理された");
            expect(parsed.error.issues).toMatchObject([
                { code: "custom", path: ["attributes", "colorVariants", 1, "uiId"] },
            ]);
            const req = { body } as Request;
            const next = vi.fn();
            const run = () => validateBody(schema)(req, {} as Response, next);
            expect(run).toThrow(AppError);
            expect(run).toThrow(expect.objectContaining({ code: "INVALID_BODY", statusCode: 400 }));
            expect(next).not.toHaveBeenCalled();
            expect(req.validatedBody).toBeUndefined();
        });
    });
    it.each([{ ids: [] }, { ids: ["red"] }, { ids: ["blue", "red"] }, { ids: ["red", "blue"] }])(
        "V13: 一意uiId=$idsを値と順序の変更なく受理する",
        ({ ids }) => {
            const body = makeBody();
            body.attributes.colorVariants = ids.map((uiId) => ({ uiId, inventory: 1, sizes: [] }));
            expect(schema.parse(body)).toEqual(body);
        },
    );
    it.each([
        [[""], true, []],
        [["", ""], false, [1]],
        [["red", "blue", "red"], false, [2]],
        [["red", "red", "red"], false, [1, 2]],
        [["red", " red", "RED"], true, []],
    ] as const)("V14: uiId=%jの受理=%s、重複位置=%j", (ids, accepted, indices) => {
        const body = makeBody();
        body.attributes.colorVariants = ids.map((uiId) => ({ uiId, inventory: 1, sizes: [] }));
        const result = schema.safeParse(body);
        expect(result.success).toBe(accepted);
        if (result.success) expect(result.data).toEqual(body);
        else
            expect(result.error.issues.map((issue) => issue.path)).toEqual(
                indices.map((index) => ["attributes", "colorVariants", index, "uiId"]),
            );
    });
});

describe("P0/P1: 設計書にある追加の入力条件", () => {
    it.each([-1, 0, 1, 2, 1.5, "1", null, undefined])("V01: itemEditingId=%sは正の整数numberだけ受理", value => {
        expect(parse("itemEditingId", value).success).toBe(value === 1 || value === 2);
    });
    it.each(["video", "thumbnail"])("V09: file=%sのnullは拒否", field => {
        expect(parse(field, null).success).toBe(false);
    });
    describe.each(["video", "thumbnail"])("V09: %sの内部フィールド", field => {
        it.each(["name", "type", "uploaded"])("%sのnullを拒否", key => {
            expect(parse(`${field}.${key}`, null).success).toBe(false);
        });
        it.each(["false", 0])("uploaded=%sのboolean以外を拒否", value => {
            expect(parse(`${field}.uploaded`, value).success).toBe(false);
        });
    });
    it.each(["attributes.colorVariants.0.color", "attributes.colorVariants.0.image", "attributes.colorVariants.0.image.type"])(
        "V11: optionalな%sは省略を受理してnullを拒否", path => {
            expect(schema.safeParse(change(path, undefined, true)).success).toBe(true);
            expect(parse(path, null).success).toBe(false);
        });
    it("V11: sizes省略は拒否し空サイズ名は保持", () => {
        expect(schema.safeParse(change("attributes.colorVariants.0.sizes", undefined, true)).success).toBe(false);
        const result = schema.parse(change("attributes.colorVariants.0.sizes.0.size", ""));
        expect(result.attributes.colorVariants[0].sizes[0].size).toBe("");
    });
    it("V10: 商品画像nameは空文字を受理、欠落は拒否", () => {
        expect(parse("itemImages.0.name", "").success).toBe(true);
        expect(schema.safeParse(change("itemImages.0.name", undefined, true)).success).toBe(false);
    });
    it.each(["genderAge.gender", "genderAge.age"])("V08 V15: %sの全定義値・空・nullをschemaで受理", path => {
        for (const value of path.endsWith("gender") ? ["men", "women", "unisex", "", null] : ["adult", "kids", "both", "", null]) {
            expect(parse(path, value).success, `入力=${String(value)}`).toBe(true);
        }
    });
    it.each(["itemMeta.name", "videoMeta.title", "category.name", "condition.name", "attributes.colorVariants.0.uiId",
        "attributes.colorVariants.0.sizes.0.size", "attributes.materials.0.name"])("V07 V08: %sのnullは拒否", path => {
        expect(parse(path, null).success).toBe(false);
    });
    it.each(["videoMeta", "itemMeta", "itemImages", "category", "genderAge", "brand", "attributes",
        "attributes.colorVariants", "attributes.colorVariants.0.sizes", "attributes.materials", "condition", "shipping"])(
        "V07: 必須オブジェクト・配列%sのnullを拒否", path => {
            expect(parse(path, null).success).toBe(false);
        });
    it("V18: userId/item_idを含む未知キーを各階層から除去", () => {
        const body = makeBody(); Object.assign(body, { userId: 999, seller_id: 999, item_id: 777, status: "active" });
        Object.assign(body.attributes.colorVariants[0], { ignored: "color" });
        Object.assign(body.attributes.colorVariants[0].sizes[0], { ignored: "size" });
        Object.assign(body.attributes.materials[0], { ignored: "material" });
        expect(schema.parse(body)).toEqual(makeBody());
    });
    it("V20: params.id=01を数値1へ変換してnextへ進む", () => {
        const req = { params: { id: "01" } } as unknown as Request, next = vi.fn();
        validateParams(idParamSchema)(req, {} as Response, next);
        expect(req.validatedParams).toEqual({ id: 1 }); expect(next).toHaveBeenCalledExactlyOnceWith();
    });
    it("V20: params.id欠落はINVALID_PARAMSで検証済み値もnextも設定しない", () => {
        const req = { params: {} } as Request, next = vi.fn();
        expect(() => validateParams(idParamSchema)(req, {} as Response, next)).toThrow(
            expect.objectContaining({ code: "INVALID_PARAMS", statusCode: 400 }),
        );
        expect(req.validatedParams).toBeUndefined(); expect(next).not.toHaveBeenCalled();
    });
});
