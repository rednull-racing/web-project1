import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../../src/errors.js";
import { validateBody } from "../../../../src/middleware/validate/validateBody.js";
import { validateParams } from "../../../../src/middleware/validate/validateParams.js";
import { updateItemEditingConfirmBodySchema as schema } from "../../../../src/validators/body/itemEditing.js";
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
    ] as const)("V01: 価格%sの受理=%s", (value, accepted) => {
        expect(parse("price", value).success).toBe(accepted);
    });
    it.each([0, -1, 300.5, "300", null, undefined])("V02: 価格%sは拒否する", (value) => {
        expect(parse("price", value).success).toBe(false);
    });
    describe.each([
        "attributes.allInventory",
        "attributes.colorVariants.0.inventory",
        "attributes.colorVariants.0.sizes.0.inventory",
    ])("V03: %s", (path) => {
        it.each([-1, 0, 1, 1.5, "1", null, undefined])("在庫%sの整数・下限を検証する", (value) => {
            expect(parse(path, value).success).toBe(value === 0 || value === 1);
        });
    });
    it.each([-0.01, 0, 0.01, 99.99, 100, 100.01, null, undefined, "50"])("V04: 素材比率%sの境界を検証する", (value) => {
        expect(parse("attributes.materials.0.ratio", value).success).toBe(
            typeof value === "number" && value >= 0 && value <= 100,
        );
    });
    it.each([0, 1, 2, 1.5, "1"])("V05: カテゴリlevel=%sの整数・下限を検証する", (value) => {
        expect(parse("category.level", value).success).toBe(value === 1 || value === 2);
    });
    const required = [
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
    describe.each(required)("V06: 必須フィールド%s", (path) => {
        it("欠落を拒否する", () => {
            expect(schema.safeParse(change(path, undefined, true)).success).toBe(false);
        });
        it("booleanへの型違いを拒否する（boolean項目には文字列を指定）", () => {
            expect(parse(path, path.endsWith("uploaded") ? "false" : false).success).toBe(false);
        });
    });
});

describe("P1: optional・nullableとschemaが制限しない入力", () => {
    describe.each(["video", "thumbnail"])("V07: %s", (field) => {
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
    describe.each(["genderAge.gender", "genderAge.age"])("V09: %s", (path) => {
        it.each(["unisex", "both", null, "任意文字列"])("%sはschemaでは受理する（DB制約は対象外）", (value) => {
            expect(parse(path, value).success).toBe(true);
        });
    });
    it.each([0, 1, 10, 11])("V10: 商品画像%s件をschemaでは受理する", (count) => {
        const body = makeBody();
        body.itemImages = Array.from({ length: count }, () => ({ name: "画像", type: "image/png", uploaded: false }));
        expect(schema.safeParse(body).success).toBe(true);
    });
    describe.each(["itemMeta.name", "videoMeta.title", "shipping.freeText"])("V11: %s", (path) => {
        it.each([0, 255, 256])("日本語%s文字をschemaでは受理する", (length) => {
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
    it.each([null, "", "application/unknown"])("V13: 商品画像type=%sを受理する", (value) => {
        expect(parse("itemImages.0.type", value).success).toBe(true);
    });
    it.each(["video.type", "thumbnail.type", "attributes.colorVariants.0.image.type"])(
        "V13: %sの任意MIME文字列を受理する",
        (path) => {
            expect(parse(path, "application/unknown").success).toBe(true);
        },
    );
    it("V14: 未知キーはトップレベルも入れ子も除去する", () => {
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

describe("V15 V16: middlewareの引渡しと失敗", () => {
    it("V16 V14: parse済みbodyを格納してnextを1回呼ぶ", () => {
        const body = { ...makeBody(), seller_id: 99 };
        const req = { body } as Request;
        const next = vi.fn();
        validateBody(schema)(req, {} as Response, next);
        expect(req.validatedBody).toEqual(makeBody());
        expect(req.validatedBody).not.toBe(req.body);
        expect(next).toHaveBeenCalledExactlyOnceWith();
    });
    it("V16: 失敗時はINVALID_BODYをthrowしnextを呼ばない", () => {
        const req = { body: {} } as Request;
        const next = vi.fn();
        const run = () => validateBody(schema)(req, {} as Response, next);
        expect(run).toThrow(AppError);
        expect(run).toThrow(expect.objectContaining({ code: "INVALID_BODY", statusCode: 400 }));
        expect(next).not.toHaveBeenCalled();
        expect(req.validatedBody).toBeUndefined();
    });
    it.each(["1", "0", "-1", "1.5", "abc"])("V15: params.id=%sを検証する", (id) => {
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
        }
    });
});

describe("F4: colorVariantsのuiId一意性", () => {
    describe.each(variantImageStates)("AF-V01 P07 O04: 先頭画像=%s", (first) => {
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
        "AF-V02: 一意uiId=$idsを値と順序の変更なく受理する",
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
    ] as const)("AF-V03: uiId=%jの受理=%s、重複位置=%j", (ids, accepted, indices) => {
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
