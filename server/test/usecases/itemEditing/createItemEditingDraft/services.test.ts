import { ValidationError } from "sequelize";
import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copyColumns, deferred, makeData, makeDraft } from "./fixtures.js";

const mocks = vi.hoisted(() => ({ findOne: vi.fn(), create: vi.fn(), itemCreate: vi.fn(), destroy: vi.fn() }));
vi.mock("../../../../src/models/index.js", () => ({
    ItemDraft: { findOne: mocks.findOne },
    ItemEditing: { create: mocks.create },
    Item: { create: mocks.itemCreate },
}));
import { getMyItemDraft } from "../../../../src/services/itemDraft/query.js";
import { deleteItemDraft } from "../../../../src/services/itemDraft/command.js";
import { createItemEditingDraft } from "../../../../src/services/itemEditing/command.js";

const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
const draft = () =>
    ({ ...makeDraft(), destroy: mocks.destroy }) as unknown as Parameters<typeof deleteItemDraft>[0]["itemDraft"];
beforeEach(() => vi.resetAllMocks());
describe("P1: DB非接続の取得・作成・削除service契約", () => {
    it.each([7, 8])("S01 S02 E02: userId=%sとID・全取得列・UPDATEロックをfindOneへ渡す", async (userId) => {
        const row = userId === 7 ? draft() : null;
        mocks.findOne.mockResolvedValue(row);
        expect(await getMyItemDraft({ itemDraftId: 11, userId, transaction })).toBe(row);
        expect(mocks.findOne).toHaveBeenCalledExactlyOnceWith({
            attributes: ["id", ...copyColumns],
            where: { id: 11, seller_id: userId },
            transaction,
            lock: "UPDATE",
        });
        expect(mocks.findOne.mock.calls[0][0].transaction).toBe(transaction);
    });
    it("S03: 同じdata/tをItemEditing.createへ渡して生成インスタンスを返す", async () => {
        const data = makeData(),
            row = { id: 456 };
        mocks.create.mockResolvedValue(row);
        expect(await createItemEditingDraft({ data, transaction })).toBe(row);
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith(data, { transaction });
        expect(mocks.create.mock.calls[0][0]).toBe(data);
        expect(mocks.create.mock.calls[0][1].transaction).toBe(transaction);
        expect(mocks.itemCreate).not.toHaveBeenCalled();
    });
    it("S04: 取得インスタンスのdestroyへ同じtを渡しundefinedを返す", async () => {
        mocks.destroy.mockResolvedValue(undefined);
        expect(await deleteItemDraft({ itemDraft: draft(), transaction })).toBeUndefined();
        expect(mocks.destroy).toHaveBeenCalledExactlyOnceWith({ transaction });
        expect(mocks.destroy.mock.calls[0][0].transaction).toBe(transaction);
    });
    it("E08 AF-S01: 画像11件を同じdata/tでモデルへ渡しValidationErrorを同じ参照で伝播する", async () => {
        const images = Array.from({ length: 11 }, (_, i) => `https://media.test/overflow-${i}`);
        const data = makeData({ image_url: images });
        // 件数の拒否は実モデルを使うDケースで検証し、ここではservice境界だけを確認する。
        const error = new ValidationError("image_url exceeds 10", []);
        mocks.create.mockRejectedValue(error);
        await expect(createItemEditingDraft({ data, transaction })).rejects.toBe(error);
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith(data, { transaction });
        expect(mocks.create.mock.calls[0][0]).toBe(data);
        expect(mocks.create.mock.calls[0][0].image_url).toBe(images);
        expect(images).toHaveLength(11);
        expect(mocks.create.mock.calls[0][1].transaction).toBe(transaction);
        expect(mocks.itemCreate).not.toHaveBeenCalled();
    });
    const operations = {
        findOne: () => getMyItemDraft({ userId: 7, itemDraftId: 11, transaction }),
        create: () => createItemEditingDraft({ data: makeData(), transaction }),
        destroy: () => deleteItemDraft({ itemDraft: draft(), transaction }),
    };
    it.each(["findOne", "create", "destroy"] as const)("S05: %sの元例外を伝播する", async (step) => {
        const error = new Error(step);
        mocks[step].mockRejectedValue(error);
        await expect(operations[step]()).rejects.toBe(error);
    });
    it.each(["findOne", "create", "destroy"] as const)("S05: %sのPromise完了を待機する", async (step) => {
        const gate = deferred<unknown>();
        mocks[step].mockReturnValue(gate.promise);
        let completed = false;
        const pending = operations[step]().then((result: unknown) => {
            completed = true;
            return result;
        });
        const settled = Promise.allSettled([pending]);
        try {
            await Promise.resolve();
            expect(mocks[step]).toHaveBeenCalledOnce();
            expect(completed).toBe(false);
        } finally {
            gate.resolve(step === "destroy" ? undefined : { id: 456 });
            await settled;
        }
        expect(completed).toBe(true);
    });
});
