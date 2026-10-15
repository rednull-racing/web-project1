import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Signup1Body } from "../../../src/usecases/shopSignup/edit/signup1/body.js";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    createAddress: vi.fn(),
    createNameShop: vi.fn(),
    createShopSignup: vi.fn(),
    fetchAddressFromZipUseCase: vi.fn(),
}));

vi.mock("../../../src/db.js", () => ({
    default: {
        transaction: mocks.transaction,
    },
}));

vi.mock("../../../src/services/address.js", () => ({
    createAddress: mocks.createAddress,
}));

vi.mock("../../../src/services/name.js", () => ({
    createNameShop: mocks.createNameShop,
}));

vi.mock("../../../src/services/shopSignup/command.js", () => ({
    createShopSignup: mocks.createShopSignup,
}));

vi.mock("../../../src/usecases/address/zipUseCase.js", () => ({
    fetchAddressFromZipUseCase: mocks.fetchAddressFromZipUseCase,
}));

import { createShopSignup1 } from "../../../src/usecases/shopSignup/edit/signup1/signup1.js";

const transaction = { id: "transaction" };
const foundedDate = new Date("2020-04-01T00:00:00.000Z");

const createBody = () => ({
    selectOption: 1,
    companyName: "株式会社テスト",
    shopName: "テストショップ",
    phoneNumber: " 03-1234-5678 ",
    email: " shop@example.com ",
    openDateTime: " 10:00-19:00 ",
    foundedDate,
    memberCount: 10,
    homepage: "https://example.com",
    repSei: " 代表 ",
    repMei: " 太郎 ",
    repSeiKana: " ダイヒョウ ",
    repMeiKana: " タロウ ",
    conSei: " 担当 ",
    conMei: " 花子 ",
    conSeiKana: " タントウ ",
    conMeiKana: " ハナコ ",
    postNumber: " 1000001 ",
    todouhuken: " 東京都 ",
    shikutyouson: " 千代田区千代田 ",
    banchi: " 1-1 ",
    building: "テストビル",
    companyNumber: "1234567890123",
    capital: 1_000_000,
});

const expectAppError = async (promise: Promise<unknown>, code: string) => {
    await expect(promise).rejects.toMatchObject({
        code,
        statusCode: 400,
    });
};

describe("createShopSignup1", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mocks.transaction.mockImplementation(async (callback: (t: typeof transaction) => Promise<number>) =>
            callback(transaction),
        );
        mocks.fetchAddressFromZipUseCase.mockResolvedValue({
            todouhuken_id: 13,
            todouhuken_name: "東京都",
            shikutyouson: "千代田区千代田",
            banchi: "",
        });
        mocks.createNameShop.mockResolvedValueOnce({ id: 101 }).mockResolvedValueOnce({ id: 102 });
        mocks.createAddress.mockResolvedValue({ id: 201 });
        mocks.createShopSignup.mockResolvedValue({ id: 301 });
    });

    it.each([
        ["法人番号", { companyNumber: undefined }],
        ["資本金", { capital: undefined }],
        ["0円の資本金", { capital: 0 }],
    ])("法人を選択し%sがない場合はINVALID_BODYになる", async (_label, override) => {
        await expectAppError(
            createShopSignup1({
                userId: 1,
                body: { ...createBody(), ...override },
            }),
            "INVALID_BODY",
        );

        expect(mocks.fetchAddressFromZipUseCase).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("郵便番号から住所を取得できない場合はINVALID_POSTNUMBERになる", async () => {
        mocks.fetchAddressFromZipUseCase.mockResolvedValueOnce(undefined);

        await expectAppError(createShopSignup1({ userId: 1, body: createBody() }), "INVALID_POSTNUMBER");

        expect(mocks.fetchAddressFromZipUseCase).toHaveBeenCalledWith({ zipcode: "1000001" });
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("郵便番号の都道府県が入力値と一致しない場合はエラーになる", async () => {
        const body = { ...createBody(), todouhuken: " 大阪府 " };

        await expectAppError(createShopSignup1({ userId: 1, body }), "NOT_SAME_POSTNUMBER_TODOUHUKEN");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("郵便番号の市区町村が入力値と一致しない場合はエラーになる", async () => {
        const body = { ...createBody(), shikutyouson: " 新宿区 " };

        await expectAppError(createShopSignup1({ userId: 1, body }), "NOT_SAME_POSTNUMBER_SHIKUTYOUSON");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("入力値を整形して関連データを同一トランザクションで作成し、IDを返す", async () => {
        const result = await createShopSignup1({ userId: 7, body: createBody() });

        expect(result).toBe(301);
        expect(mocks.createNameShop).toHaveBeenNthCalledWith(1, {
            data: {
                sei: "代表",
                mei: "太郎",
                sei_kana: "ダイヒョウ",
                mei_kana: "タロウ",
                shop_type: "representative",
            },
            transaction,
        });
        expect(mocks.createNameShop).toHaveBeenNthCalledWith(2, {
            data: {
                sei: "担当",
                mei: "花子",
                sei_kana: "タントウ",
                mei_kana: "ハナコ",
                shop_type: "contact",
            },
            transaction,
        });
        expect(mocks.createAddress).toHaveBeenCalledWith({
            data: {
                post_number: "1000001",
                todouhuken_id: 13,
                shikutyouson: "千代田区千代田",
                banchi: "1-1",
                building: "テストビル",
            },
            transaction,
        });
        expect(mocks.createShopSignup).toHaveBeenCalledWith({
            data: {
                company_name: "株式会社テスト",
                shop_name: "テストショップ",
                phone_number: "03-1234-5678",
                email: "shop@example.com",
                homepage_url: "https://example.com",
                open_date_time: "10:00-19:00",
                company_number: "1234567890123",
                capital: 1_000_000,
                member_count: 10,
                user_id: 7,
                address_id: 201,
                com_or_free_id: 1,
                founded_date: foundedDate,
                name_representative_id: 101,
                name_contact_id: 102,
            },
            transaction,
        });
    });

    it("任意項目を省略した個人事業主では既定値を設定する", async () => {
        const body: Signup1Body = createBody();
        delete body.homepage;
        delete body.building;
        delete body.companyNumber;
        delete body.capital;

        await createShopSignup1({
            userId: 7,
            body: { ...body, selectOption: 2 },
        });

        expect(mocks.createAddress).toHaveBeenCalledWith({
            data: expect.objectContaining({ building: undefined }),
            transaction,
        });
        expect(mocks.createShopSignup).toHaveBeenCalledWith({
            data: expect.objectContaining({
                homepage_url: null,
                company_number: null,
                capital: 0,
                com_or_free_id: 2,
            }),
            transaction,
        });
    });
});
