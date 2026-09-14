import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    createBankAccount: vi.fn(),
    getBankOne: vi.fn(),
    getBranchOne: vi.fn(),
    getMyShopSignup: vi.fn(),
    updateShopSignupBankAccount: vi.fn(),
}));

vi.mock("../../../src/db.js", () => ({
    default: {
        transaction: mocks.transaction,
    },
}));

vi.mock("../../../src/services/bankAccount.js", () => ({
    createBankAccount: mocks.createBankAccount,
}));

vi.mock("../../../src/services/banks.js", () => ({
    getBankOne: mocks.getBankOne,
}));

vi.mock("../../../src/services/branches.js", () => ({
    getBranchOne: mocks.getBranchOne,
}));

vi.mock("../../../src/services/shopSignup.js", () => ({
    getMyShopSignup: mocks.getMyShopSignup,
    updateShopSignupBankAccount: mocks.updateShopSignupBankAccount,
}));

import { updateShopSignup2UseCase } from "../../../src/usecases/shopSignup/edit/signup2.js";

const transaction = { id: "transaction" };
const shopSignup = { id: 11 };

const body = {
    bankName: "テスト銀行",
    branch: "テスト支店",
    accountType: "ordinary" as const,
    accountNumber: "1234567",
    meigi: "テスト タロウ",
};

const expectAppError = async (promise: Promise<unknown>, code: string, statusCode: number) => {
    await expect(promise).rejects.toMatchObject({ code, statusCode });
};

describe("createShopSignupAccount", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mocks.transaction.mockImplementation(async (callback: (t: typeof transaction) => Promise<void>) =>
            callback(transaction),
        );
        mocks.getMyShopSignup.mockResolvedValue(shopSignup);
        mocks.getBankOne.mockResolvedValue({
            code: "0001",
            name: "テスト銀行",
            normalize: { name: "正規化テスト銀行" },
        });
        mocks.getBranchOne.mockResolvedValue({
            code: "001",
            name: "テスト支店",
            normalize: { name: "正規化テスト支店" },
        });
        mocks.createBankAccount.mockResolvedValue({ id: 21 });
        mocks.updateShopSignupBankAccount.mockResolvedValue(undefined);
    });

    it("ユーザーのショップ申込が存在しない場合はSHOP_SIGNUP_NOT_FOUNDになる", async () => {
        mocks.getMyShopSignup.mockResolvedValueOnce(null);

        await expectAppError(
            updateShopSignup2UseCase({ shopSignupId: 11, userId: 7, body }),
            "SHOP_SIGNUP_NOT_FOUND",
            404,
        );

        expect(mocks.getMyShopSignup).toHaveBeenCalledWith({ shopSignupId: 11, userId: 7 });
        expect(mocks.getBankOne).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("入力された銀行が存在しない場合はINVALID_BANKになる", async () => {
        mocks.getBankOne.mockResolvedValueOnce(null);

        await expectAppError(updateShopSignup2UseCase({ shopSignupId: 11, userId: 7, body }), "INVALID_BANK", 400);

        expect(mocks.getBankOne).toHaveBeenCalledWith({ bankName: "テスト銀行" });
        expect(mocks.getBranchOne).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("入力された支店が銀行に存在しない場合はINVALID_BRANCHになる", async () => {
        mocks.getBranchOne.mockResolvedValueOnce(null);

        await expectAppError(updateShopSignup2UseCase({ shopSignupId: 11, userId: 7, body }), "INVALID_BRANCH", 400);

        expect(mocks.getBranchOne).toHaveBeenCalledWith({ bankCode: "0001", branch: "テスト支店" });
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("正規化された銀行名と支店名で口座を作成し、ショップ申込へ設定する", async () => {
        const result = await updateShopSignup2UseCase({ shopSignupId: 11, userId: 7, body });

        expect(result).toBeUndefined();
        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.createBankAccount).toHaveBeenCalledWith({
            data: {
                bank_code: "0001",
                bank_name: "正規化テスト銀行",
                branch_code: "001",
                branch: "正規化テスト支店",
                account_number: "1234567",
                meigi: "テスト タロウ",
                account_type: "ordinary",
            },
            transaction,
        });
        expect(mocks.updateShopSignupBankAccount).toHaveBeenCalledWith({
            shopSignup,
            data: { account_id: 21 },
            transaction,
        });
    });

    it("正規化名がない場合は元の銀行名と支店名で口座を作成する", async () => {
        mocks.getBankOne.mockResolvedValueOnce({ code: "0002", name: "元銀行", normalize: null });
        mocks.getBranchOne.mockResolvedValueOnce({ code: "002", name: "元支店", normalize: null });

        await updateShopSignup2UseCase({ shopSignupId: 11, userId: 7, body });

        expect(mocks.createBankAccount).toHaveBeenCalledWith({
            data: expect.objectContaining({
                bank_code: "0002",
                bank_name: "元銀行",
                branch_code: "002",
                branch: "元支店",
            }),
            transaction,
        });
    });
});
