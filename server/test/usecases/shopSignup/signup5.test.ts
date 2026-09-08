import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    getMyShopSignup: vi.fn(),
    getOldShopSignupAll: vi.fn(),
    updateShopSignupRequestAll: vi.fn(),
    deleteOldShopSignup: vi.fn(),
}));

vi.mock("../../../src/db.js", () => ({
    default: {
        transaction: mocks.transaction,
    },
}));

vi.mock("../../../src/services/shopSignup.js", () => ({
    getMyShopSignup: mocks.getMyShopSignup,
    getOldShopSignupAll: mocks.getOldShopSignupAll,
    updateShopSignupRequestAll: mocks.updateShopSignupRequestAll,
}));

vi.mock("../../../src/usecases/shopSignup/signup5/oldShopSignup.js", () => ({
    deleteOldShopSignup: mocks.deleteOldShopSignup,
}));

import { updateShopSignup5UseCase } from "../../../src/usecases/shopSignup/signup5/signup5.js";

const transaction = { id: "transaction" };
const shopSignup = { id: 11 };
const oldShopSignup = [{ id: 10 }];

describe("updateShopSignup5UseCase", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mocks.transaction.mockImplementation(async (callback: (t: typeof transaction) => Promise<void>) =>
            callback(transaction),
        );
        mocks.getMyShopSignup.mockResolvedValue(shopSignup);
        mocks.getOldShopSignupAll.mockResolvedValue([]);
        mocks.deleteOldShopSignup.mockResolvedValue(undefined);
        mocks.updateShopSignupRequestAll.mockResolvedValue(undefined);
    });

    it("ユーザーが所有するショップ申込がない場合はSHOP_SIGNUP_NOT_FOUNDになる", async () => {
        mocks.getMyShopSignup.mockResolvedValueOnce(null);

        await expect(updateShopSignup5UseCase({ shopSignupId: 11, userId: 7 })).rejects.toMatchObject({
            code: "SHOP_SIGNUP_NOT_FOUND",
            statusCode: 404,
        });

        expect(mocks.getMyShopSignup).toHaveBeenCalledWith({ shopSignupId: 11, userId: 7 });
        expect(mocks.getOldShopSignupAll).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("過去の承認待ち申込がない場合は削除せず、現在の申込を同一transactionで確定する", async () => {
        await expect(updateShopSignup5UseCase({ shopSignupId: 11, userId: 7 })).resolves.toBeUndefined();

        expect(mocks.getOldShopSignupAll).toHaveBeenCalledWith({ userId: 7, shopSignupId: 11 });
        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.deleteOldShopSignup).not.toHaveBeenCalled();
        expect(mocks.updateShopSignupRequestAll).toHaveBeenCalledWith({
            shopSignup,
            data: { request_all: true },
            transaction,
        });
    });

    it("過去の承認待ち申込がある場合は削除してから現在の申込を確定する", async () => {
        mocks.getOldShopSignupAll.mockResolvedValueOnce(oldShopSignup);

        await updateShopSignup5UseCase({ shopSignupId: 11, userId: 7 });

        expect(mocks.deleteOldShopSignup).toHaveBeenCalledWith({ oldShopSignup, transaction });
        expect(mocks.updateShopSignupRequestAll).toHaveBeenCalledWith({
            shopSignup,
            data: { request_all: true },
            transaction,
        });
        expect(mocks.deleteOldShopSignup.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.updateShopSignupRequestAll.mock.invocationCallOrder[0],
        );
    });

    it("過去の承認待ち申込の削除に失敗した場合は現在の申込を確定しない", async () => {
        const error = new Error("delete failed");
        mocks.getOldShopSignupAll.mockResolvedValueOnce(oldShopSignup);
        mocks.deleteOldShopSignup.mockRejectedValueOnce(error);

        await expect(updateShopSignup5UseCase({ shopSignupId: 11, userId: 7 })).rejects.toBe(error);

        expect(mocks.updateShopSignupRequestAll).not.toHaveBeenCalled();
    });
});
