import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeMetadataRow } from "../../../../test/fixtures/itemEditing/getItemConfirmPageMetadata/fixtures.js";
const mocks = vi.hoisted(() => ({ findOne: vi.fn() }));
vi.mock("../../../models/index.js", () => ({ ItemEditing: { findOne: mocks.findOne } }));
import { getMyItemConfirmPageMetadata } from "../query.js";
beforeEach(() => vi.resetAllMocks());
describe("P0/P1 getMyItemConfirmPageMetadata", () => {
    it("S01 id/nameと所有者whereだけを完全一致で指定し同じ参照を返す", async () => {
        const row = makeMetadataRow();
        mocks.findOne.mockResolvedValue(row);
        expect(await getMyItemConfirmPageMetadata({ itemEditingId: 101, userId: 7 })).toBe(row);
        expect(mocks.findOne).toHaveBeenCalledExactlyOnceWith({
            attributes: ["id", "name"],
            where: { id: 101, seller_id: 7 },
        });
    });
    it("S02 nullを返す", async () => {
        mocks.findOne.mockResolvedValue(null);
        expect(await getMyItemConfirmPageMetadata({ itemEditingId: 101, userId: 7 })).toBeNull();
        expect(mocks.findOne).toHaveBeenCalledOnce();
    });
    it("S02 元例外を伝播する", async () => {
        const error = new Error("db");
        mocks.findOne.mockRejectedValue(error);
        await expect(getMyItemConfirmPageMetadata({ itemEditingId: 101, userId: 7 })).rejects.toBe(error);
        expect(mocks.findOne).toHaveBeenCalledOnce();
    });
});
