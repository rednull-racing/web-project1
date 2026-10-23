import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemAttributes } from "../../../../types/itemAttributes.js";
import type { createItemEditingCopy } from "../../../../services/itemEditing/command.js";
import {
    editingResult,
    expectedAttributes,
    expectAppError,
    freezeDeep,
    makeItem,
    sourceResult,
    transactionFixture,
} from "./fixtures.js";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    get: vi.fn(),
    create: vi.fn<typeof createItemEditingCopy>(),
}));
vi.mock("../../../../db.js", () => ({ default: { transaction: mocks.transaction } }));
vi.mock("../../../../services/items/index.js", () => ({ getMyItemWithVideoSaleShipping: mocks.get }));
vi.mock("../../../../services/itemEditing/command.js", () => ({ createItemEditingCopy: mocks.create }));
import { createItemEditingCopyUseCase } from "../createItemEditingCopy.js";

let item: ReturnType<typeof makeItem>;
beforeEach(() => {
    vi.resetAllMocks();
    item = makeItem();
    mocks.transaction.mockImplementation((callback: (transaction: Transaction) => Promise<number>) =>
        callback(transactionFixture()),
    );
    mocks.get.mockImplementation(async () => sourceResult(item));
    mocks.create.mockResolvedValue(editingResult());
});
const run = async () => {
    await createItemEditingCopyUseCase({ userId: 7, itemId: 101, status: "normal" });
    return mocks.create.mock.calls[0][0].data.attributes;
};
const inventoryCases = [
    ["商品", (a: ItemAttributes) => a.inventory!],
    ["色", (a: ItemAttributes) => a.colorVariants![0].inventory!],
    ["サイズ", (a: ItemAttributes) => a.colorVariants![0].sizes![0].inventory],
] as const;

describe("P0/P1 在庫復元と複製（実usecase経由）", () => {
    it("I01 I08: 各階層のinitialへ戻し順序・識別子・他属性をすべて保持する", async () => {
        const before = structuredClone(item.attributes);
        expect(await run()).toEqual(expectedAttributes());
        expect(item.attributes).toEqual(before);
    });
    describe.each(inventoryCases)("I02 I03: %s階層", (_name, select) => {
        it.each([
            { initial: 0, current: 0 },
            { initial: 0, current: 4 },
            { initial: 1, current: 0 },
            { initial: 1, current: 5 },
        ])("initial=$initial/current=$currentを同じinitialへ戻す", async ({ initial, current }) => {
            Object.assign(select(item.attributes), { initial, current, low_stock_ratio: 0 });
            const before = structuredClone(item.attributes);
            const result = await run();
            expect(select(result)).toEqual({ initial, current: initial, low_stock_ratio: 0 });
            expect(item.attributes).toEqual(before);
        });
        it.each([2, 10, 20])("initial=10/current=%sの大小にかかわらず10へ戻す", async (current) => {
            Object.assign(select(item.attributes), { initial: 10, current });
            const ratio = select(item.attributes).low_stock_ratio;
            expect(select(await run())).toEqual({ initial: 10, current: 10, low_stock_ratio: ratio });
        });
    });
    it.each([
        ["空オブジェクト", {}],
        ["商品inventoryだけ", { inventory: { initial: 3, current: 1, low_stock_ratio: 0.7 } }],
        ["色空配列", { colorVariants: [] }],
        ["色在庫なし・sizes欠落", { colorVariants: [{ uiId: "red", color: "赤" }] }],
        ["色在庫なし・sizes空", { colorVariants: [{ uiId: "red", sizes: [] }] }],
    ] satisfies Array<[string, ItemAttributes]>)("I04 I05: %sで欠落キーを追加しない", async (_label, attributes) => {
        item.attributes = structuredClone(attributes);
        const expected =
            _label === "商品inventoryだけ"
                ? { inventory: { initial: 3, current: 3, low_stock_ratio: 0.7 } }
                : attributes;
        expect(await run()).toEqual(expected);
    });
    it("I05 I06: 色在庫なしでもサイズ在庫を復元する", async () => {
        item.attributes = {
            colorVariants: [
                {
                    uiId: "only-size",
                    sizes: [{ size: "M", inventory: { initial: 9, current: 1, low_stock_ratio: 0.8 } }],
                },
            ],
        };
        expect(await run()).toEqual({
            colorVariants: [
                {
                    uiId: "only-size",
                    sizes: [{ size: "M", inventory: { initial: 9, current: 9, low_stock_ratio: 0.8 } }],
                },
            ],
        });
    });
    it("I06: 商品在庫とsizesがなくても色在庫を復元する", async () => {
        item.attributes = {
            colorVariants: [{ uiId: "only-color", inventory: { initial: 7, current: 2, low_stock_ratio: 0.6 } }],
        };
        expect(await run()).toEqual({
            colorVariants: [{ uiId: "only-color", inventory: { initial: 7, current: 7, low_stock_ratio: 0.6 } }],
        });
    });
    it("I07: 入れ子は別参照でコピー先の変更が元へ伝播しない", async () => {
        const before = structuredClone(item.attributes);
        const copied = await run();
        expect(copied).not.toBe(item.attributes);
        expect(copied.inventory).not.toBe(item.attributes.inventory);
        expect(copied.colorVariants).not.toBe(item.attributes.colorVariants);
        expect(copied.materials).not.toBe(item.attributes.materials);
        for (const [index, color] of copied.colorVariants!.entries()) {
            const source = item.attributes.colorVariants![index];
            expect(color).not.toBe(source);
            expect(color.inventory).not.toBe(source.inventory);
            expect(color.sizes).not.toBe(source.sizes);
            for (const [sizeIndex, size] of color.sizes!.entries()) {
                expect(size).not.toBe(source.sizes![sizeIndex]);
                expect(size.inventory).not.toBe(source.sizes![sizeIndex].inventory);
                size.inventory.current = 999;
                size.size = "変更";
            }
            color.inventory!.current = 999;
            color.uiId = "変更";
            color.image_url = "changed";
        }
        expect(copied.materials![0]).not.toBe(item.attributes.materials![0]);
        copied.materials![0].name = "変更";
        copied.inventory!.current = 999;
        expect(item.attributes).toEqual(before);
    });
    it("I09: 深くfreezeされた元attributesも書き換えず複製できる", async () => {
        freezeDeep(item.attributes);
        const result = await run();
        expect(result).toEqual(expectedAttributes());
        expect(Object.isFrozen(result)).toBe(false);
        expect(Object.isFrozen(result.colorVariants![0].sizes![0].inventory)).toBe(false);
    });
    it("I10: 保存済みJSONBの追加キーをcurrent以外は保持する", async () => {
        const attributes = {
            ...item.attributes,
            future: { label: "追加情報" },
            inventory: { ...item.attributes.inventory!, reserved: 2 },
        };
        item.attributes = attributes;
        expect(await run()).toEqual({
            ...expectedAttributes(),
            future: { label: "追加情報" },
            inventory: { initial: 20, current: 20, low_stock_ratio: 0.15, reserved: 2 },
        });
        expect(attributes.inventory.current).toBe(6);
    });
    it.each([undefined, null])(
        "O01 AF-INV01: size.inventory=%sの破損JSONはAppErrorで作成前に停止する",
        async (inventory) => {
            // 型に反する保存済みJSONBを意図的に再現する。
            item.attributes = { colorVariants: [{ sizes: [{ size: "M", inventory }] }] } as unknown as ItemAttributes;
            await expectAppError(
                createItemEditingCopyUseCase({ userId: 7, itemId: 101, status: "normal" }),
                "ITEM_ATTRIBUTES_INVALID",
                500,
            );
            expect(mocks.create).not.toHaveBeenCalled();
        },
    );
});

describe("P1 AF-INV01 保存済み在庫構造の防御", () => {
    it.each([
        ["属性null", null],
        ["属性配列", []],
        ["商品在庫null", { inventory: null }],
        ["商品initial欠落", { inventory: { current: 1, low_stock_ratio: 0.2 } }],
        ["商品initial文字列", { inventory: { initial: "3", current: 1, low_stock_ratio: 0.2 } }],
        ["商品current不正", { inventory: { initial: 3, current: null, low_stock_ratio: 0.2 } }],
        ["商品ratio不正", { inventory: { initial: 3, current: 1, low_stock_ratio: "0.2" } }],
        ["商品initial非有限", { inventory: { initial: Infinity, current: 1, low_stock_ratio: 0.2 } }],
        ["色配列不正", { colorVariants: {} }],
        ["色null", { colorVariants: [null] }],
        ["色在庫不正", { colorVariants: [{ inventory: {} }] }],
        ["サイズ配列不正", { colorVariants: [{ sizes: {} }] }],
        ["サイズnull", { colorVariants: [{ sizes: [null] }] }],
        ["サイズ在庫不正", { colorVariants: [{ sizes: [{ inventory: {} }] }] }],
    ])("%sをAppErrorで拒否し元データも作成も変更しない", async (_label, attributes) => {
        item.attributes = attributes as unknown as ItemAttributes;
        const before = structuredClone(item.attributes);
        await expectAppError(createItemEditingCopyUseCase({ userId: 7, itemId: 101, status: "normal" }), "ITEM_ATTRIBUTES_INVALID", 500);
        expect(mocks.create).not.toHaveBeenCalled();
        expect(item.attributes).toEqual(before);
    });
});
