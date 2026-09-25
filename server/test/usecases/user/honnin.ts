import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    uploadS3Object: vi.fn(),
    deleteS3Object: vi.fn(),
    updateAddress: vi.fn(),
    createIdCard: vi.fn(),
    deleteIdCard: vi.fn(),
    updateName: vi.fn(),
    createNotification: vi.fn(),
    createS3Metadata: vi.fn(),
    deleteS3Metadata: vi.fn(),
    getS3Metadata: vi.fn(),
    getTodouhukenOne: vi.fn(),
    updateHonninUser: vi.fn(),
    updateIdCardIdUser: vi.fn(),
    getUserHasAddressNameId: vi.fn(),
}));

vi.mock("../../../src/db.js", () => ({
    default: { transaction: mocks.transaction },
}));

vi.mock("../../../src/infra/aws/deleteS3Object.js", () => ({
    deleteS3Object: mocks.deleteS3Object,
}));

vi.mock("../../../src/infra/aws/s3.js", () => ({
    buckets: { verificationDocuments: "verification-documents" },
}));

vi.mock("../../../src/infra/aws/uploadS3Object.js", () => ({
    uploadS3Object: mocks.uploadS3Object,
}));

vi.mock("../../../src/services/address.js", () => ({
    updateAddress: mocks.updateAddress,
}));

vi.mock("../../../src/services/idCard.js", () => ({
    createIdCard: mocks.createIdCard,
    deleteIdCard: mocks.deleteIdCard,
}));

vi.mock("../../../src/services/name.js", () => ({
    updateName: mocks.updateName,
}));

vi.mock("../../../src/services/notification.js", () => ({
    createNotification: mocks.createNotification,
}));

vi.mock("../../../src/services/s3Metadata.js", () => ({
    createS3Metadata: mocks.createS3Metadata,
    deleteS3Metadata: mocks.deleteS3Metadata,
    getS3Metadata: mocks.getS3Metadata,
}));

vi.mock("../../../src/services/todouhuken.js", () => ({
    getTodouhukenOne: mocks.getTodouhukenOne,
}));

vi.mock("../../../src/services/users/command.js", () => ({
    updateHonninUser: mocks.updateHonninUser,
    updateIdCardIdUser: mocks.updateIdCardIdUser,
}));

vi.mock("../../../src/services/users/query.js", () => ({
    getUserHasAddressNameId: mocks.getUserHasAddressNameId,
}));

import { editHonninUserUseCase } from "../../../src/usecases/users/edit/honnin.js";

const transaction = { id: "transaction" };
const now = 1_700_000_000_000;
const birthday = new Date("1990-01-02T00:00:00.000Z");

const frontIdCard = {
    fileName: "front.jpg",
    contentType: "image/jpeg",
    size: 101,
    buffer: Buffer.from("front"),
};

const rearIdCard = {
    fileName: "rear.png",
    contentType: "image/png",
    size: 102,
    buffer: Buffer.from("rear"),
};

const body = {
    sei: "山田",
    mei: "太郎",
    seiKana: "ヤマダ",
    meiKana: "タロウ",
    birthday,
    postNumber: "1000001",
    todouhuken: "東京都",
    shikutyouson: "千代田区",
    banchi: "千代田1-1",
    building: "テストビル101",
    phoneNumber: "09012345678",
    selectedGender: 1,
    idFrontUpload: true,
    idRearUpload: true,
    frontIdCard,
    rearIdCard,
};

const address = { id: 21 };
const name = { id: 22 };
const user = {
    id: 7,
    Address: address,
    Name: name,
    IdCard: null,
};

const uploadedObject = (objectKey: string) => ({
    bucketName: "verification-documents",
    objectKey,
    etag: `etag:${objectKey}`,
    versionId: `version:${objectKey}`,
});

describe("editHonninUserUseCase", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(Date, "now").mockReturnValue(now);

        mocks.transaction.mockImplementation(async (callback: (t: typeof transaction) => Promise<void>) =>
            callback(transaction),
        );
        mocks.getUserHasAddressNameId.mockResolvedValue(user);
        mocks.getTodouhukenOne.mockResolvedValue({ id: 13 });
        mocks.getS3Metadata.mockResolvedValue(null);
        mocks.uploadS3Object.mockImplementation(async ({ objectKey }: { objectKey: string }) =>
            uploadedObject(objectKey),
        );
        mocks.createS3Metadata.mockImplementation(async ({ data }: { data: { original_file_name: string } }) => ({
            id: data.original_file_name === "front.jpg" ? 101 : 102,
        }));
        mocks.createIdCard.mockResolvedValue({ id: 201 });
        mocks.deleteIdCard.mockResolvedValue(undefined);
        mocks.updateAddress.mockResolvedValue(undefined);
        mocks.updateName.mockResolvedValue(undefined);
        mocks.updateHonninUser.mockResolvedValue(undefined);
        mocks.updateIdCardIdUser.mockResolvedValue(undefined);
        mocks.deleteS3Metadata.mockResolvedValue(undefined);
        mocks.deleteS3Object.mockResolvedValue(undefined);
        mocks.createNotification.mockResolvedValue(undefined);
    });

    it("必須項目が空の場合はINVALID_BODYになり、外部処理を行わない", async () => {
        await expect(editHonninUserUseCase({ userId: 7, body: { ...body, sei: "" } })).rejects.toMatchObject({
            code: "INVALID_BODY",
            statusCode: 400,
        });

        expect(mocks.getUserHasAddressNameId).not.toHaveBeenCalled();
        expect(mocks.uploadS3Object).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("ユーザーが存在しない場合はUSER_NOT_FOUNDになる", async () => {
        mocks.getUserHasAddressNameId.mockResolvedValueOnce(null);

        await expect(editHonninUserUseCase({ userId: 7, body })).rejects.toMatchObject({
            code: "USER_NOT_FOUND",
            statusCode: 404,
        });

        expect(mocks.getUserHasAddressNameId).toHaveBeenCalledWith({ userId: 7 });
        expect(mocks.getTodouhukenOne).not.toHaveBeenCalled();
        expect(mocks.uploadS3Object).not.toHaveBeenCalled();
    });

    it("都道府県が存在しない場合はTODOUHUKEN_NOT_FOUNDになる", async () => {
        mocks.getTodouhukenOne.mockResolvedValueOnce(null);

        await expect(editHonninUserUseCase({ userId: 7, body })).rejects.toMatchObject({
            code: "TODOUHUKEN_NOT_FOUND",
            statusCode: 404,
        });

        expect(mocks.getTodouhukenOne).toHaveBeenCalledWith({ todouhuken: "東京都" });
        expect(mocks.uploadS3Object).not.toHaveBeenCalled();
    });

    it("都道府県IDが範囲外の場合はINVALID_TODOUHUKENになる", async () => {
        mocks.getTodouhukenOne.mockResolvedValueOnce({ id: 48 });

        await expect(editHonninUserUseCase({ userId: 7, body })).rejects.toMatchObject({
            code: "INVALID_TODOUHUKEN",
            statusCode: 400,
        });

        expect(mocks.uploadS3Object).not.toHaveBeenCalled();
    });

    it("身分証をアップロードし、本人確認情報を同一transactionで更新する", async () => {
        await expect(editHonninUserUseCase({ userId: 7, body })).resolves.toBeUndefined();

        expect(mocks.uploadS3Object).toHaveBeenCalledTimes(2);
        expect(mocks.uploadS3Object).toHaveBeenCalledWith({
            bucketName: "verification-documents",
            objectKey: `idcard/front/7/${now}_front.jpg`,
            body: frontIdCard.buffer,
            contentType: "image/jpeg",
        });
        expect(mocks.uploadS3Object).toHaveBeenCalledWith({
            bucketName: "verification-documents",
            objectKey: `idcard/rear/7/${now}_rear.png`,
            body: rearIdCard.buffer,
            contentType: "image/png",
        });
        expect(mocks.createS3Metadata).toHaveBeenCalledTimes(2);
        expect(mocks.createIdCard).toHaveBeenCalledWith({
            data: { front_s3_metadata_id: 101, rear_s3_metadata_id: 102 },
            transaction,
        });
        expect(mocks.updateIdCardIdUser).toHaveBeenCalledWith({
            user,
            data: { idcard_id: 201 },
            transaction,
        });
        expect(mocks.updateAddress).toHaveBeenCalledWith({
            address,
            data: {
                post_number: "1000001",
                todouhuken_id: 13,
                shikutyouson: "千代田区",
                banchi: "千代田1-1",
                building: "テストビル101",
            },
            transaction,
        });
        expect(mocks.updateName).toHaveBeenCalledWith({
            name,
            data: { sei: "山田", mei: "太郎", sei_kana: "ヤマダ", mei_kana: "タロウ" },
            transaction,
        });
        expect(mocks.updateHonninUser).toHaveBeenCalledWith({
            user,
            data: {
                honnin_verify_request: true,
                honnin_verified: false,
                birthday,
                phone_number: "09012345678",
                gender_id: 1,
            },
            transaction,
        });
        expect(mocks.deleteS3Object).not.toHaveBeenCalled();
        expect(mocks.createNotification).toHaveBeenCalledWith({
            data: {
                read_user_id: 7,
                message:
                    "本人確認を開始しました。本人確認の完了には1~2週間程度お時間を要する場合がございます。完了までしばらくお待ちください。",
                type: "USER_EDIT",
            },
        });
    });

    it("画像アップロードに失敗した場合はアップロード済みS3オブジェクトを補償削除する", async () => {
        mocks.uploadS3Object.mockImplementation(async ({ objectKey }: { objectKey: string }) => {
            if (objectKey.includes("rear.png")) throw new Error("rear upload failed");
            return uploadedObject(objectKey);
        });

        await expect(editHonninUserUseCase({ userId: 7, body })).rejects.toThrow("rear upload failed");

        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.deleteS3Object).toHaveBeenCalledTimes(1);
        expect(mocks.deleteS3Object).toHaveBeenCalledWith({
            bucketName: "verification-documents",
            objectKey: `idcard/front/7/${now}_front.jpg`,
            versionId: `version:idcard/front/7/${now}_front.jpg`,
        });
    });

    it("DB更新に失敗した場合は今回アップロードしたS3オブジェクトを補償削除する", async () => {
        mocks.updateHonninUser.mockRejectedValueOnce(new Error("database failed"));

        await expect(editHonninUserUseCase({ userId: 7, body })).rejects.toThrow("database failed");

        expect(mocks.deleteS3Object).toHaveBeenCalledTimes(2);
        expect(mocks.createNotification).not.toHaveBeenCalled();
    });

    it("更新前の身分証とS3データをcommit後に削除する", async () => {
        const oldIdCard = { id: 301, front_s3_metadata_id: 401, rear_s3_metadata_id: 402 };
        const oldFrontS3Metadata = {
            id: 401,
            bucket_name: "old-bucket",
            object_key: "old/front.jpg",
            version_id: "old-front-version",
        };
        const oldRearS3Metadata = {
            id: 402,
            bucket_name: "old-bucket",
            object_key: "old/rear.jpg",
            version_id: "old-rear-version",
        };
        const userWithOldIdCard = { ...user, IdCard: oldIdCard };
        mocks.getUserHasAddressNameId.mockResolvedValueOnce(userWithOldIdCard);
        mocks.getS3Metadata.mockResolvedValueOnce(oldFrontS3Metadata).mockResolvedValueOnce(oldRearS3Metadata);

        await editHonninUserUseCase({ userId: 7, body });

        expect(mocks.getS3Metadata).toHaveBeenCalledWith({ s3MetadataId: 401 });
        expect(mocks.getS3Metadata).toHaveBeenCalledWith({ s3MetadataId: 402 });
        expect(mocks.deleteIdCard).toHaveBeenCalledWith({ idCard: oldIdCard, transaction });
        expect(mocks.transaction).toHaveBeenCalledTimes(2);
        expect(mocks.deleteS3Metadata).toHaveBeenCalledTimes(2);
        for (const s3Metadata of [oldFrontS3Metadata, oldRearS3Metadata]) {
            expect(mocks.deleteS3Metadata).toHaveBeenCalledWith({ s3Metadata, transaction });
            expect(mocks.deleteS3Object).toHaveBeenCalledWith({
                bucketName: s3Metadata.bucket_name,
                objectKey: s3Metadata.object_key,
                versionId: s3Metadata.version_id,
            });
        }
    });
});
