import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    uploadS3Object: vi.fn(),
    deleteS3Object: vi.fn(),
    createIdCard: vi.fn(),
    createPermit: vi.fn(),
    createPermitFile: vi.fn(),
    createS3Metadata: vi.fn(),
    deleteS3Metadata: vi.fn(),
    getMyShopSignupHasS3Data: vi.fn(),
    updateSignup3: vi.fn(),
}));

vi.mock("../../../src/db.js", () => ({
    default: {
        transaction: mocks.transaction,
    },
}));

vi.mock("../../../src/infra/aws/deleteS3Object.js", () => ({
    deleteS3Object: mocks.deleteS3Object,
}));

vi.mock("../../../src/infra/aws/s3.js", () => ({
    buckets: {
        verificationDocuments: "verification-documents",
    },
}));

vi.mock("../../../src/infra/aws/uploadS3Object.js", () => ({
    uploadS3Object: mocks.uploadS3Object,
}));

vi.mock("../../../src/services/idCard.js", () => ({
    createIdCard: mocks.createIdCard,
}));

vi.mock("../../../src/services/permit.js", () => ({
    createPermit: mocks.createPermit,
}));

vi.mock("../../../src/services/permitFile.js", () => ({
    createPermitFile: mocks.createPermitFile,
}));

vi.mock("../../../src/services/s3Metadata.js", () => ({
    createS3Metadata: mocks.createS3Metadata,
    deleteS3Metadata: mocks.deleteS3Metadata,
}));

vi.mock("../../../src/services/shopSignup.js", () => ({
    getMyShopSignupHasS3Data: mocks.getMyShopSignupHasS3Data,
    updateSignup3: mocks.updateSignup3,
}));

import { updateShopSignup3UseCase } from "../../../src/usecases/shopSignup/signup3/signup3.js";

const transaction = { id: "transaction" };
const now = 1_700_000_000_000;

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

const permitFiles = [
    {
        fileName: "permit-1.pdf",
        contentType: "application/pdf",
        size: 201,
        buffer: Buffer.from("permit-1"),
    },
    {
        fileName: "permit-2.jpg",
        contentType: "image/jpeg",
        size: 202,
        buffer: Buffer.from("permit-2"),
    },
];

const createBody = (permits = permitFiles) => ({
    frontIdCard,
    rearIdCard,
    permitFiles: permits,
});

const shopSignup = {
    id: 11,
    IdCard: null,
    Permit: null,
};

const uploadedObject = (objectKey: string) => ({
    bucketName: "verification-documents",
    objectKey,
    etag: `etag:${objectKey}`,
    versionId: `version:${objectKey}`,
});

describe("updateShopSignup3UseCase", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(Date, "now").mockReturnValue(now);

        mocks.transaction.mockImplementation(async (callback: (t: typeof transaction) => Promise<void>) =>
            callback(transaction),
        );
        mocks.getMyShopSignupHasS3Data.mockResolvedValue(shopSignup);
        mocks.uploadS3Object.mockImplementation(async ({ objectKey }: { objectKey: string }) =>
            uploadedObject(objectKey),
        );
        mocks.createS3Metadata.mockImplementation(async ({ data }: { data: { original_file_name: string } }) => ({
            id: {
                "front.jpg": 101,
                "rear.png": 102,
                "permit-1.pdf": 201,
                "permit-2.jpg": 202,
            }[data.original_file_name],
        }));
        mocks.createIdCard.mockResolvedValue({ id: 301 });
        mocks.createPermit.mockResolvedValue({ id: 401 });
        mocks.createPermitFile.mockResolvedValue(undefined);
        mocks.updateSignup3.mockResolvedValue(undefined);
        mocks.deleteS3Metadata.mockResolvedValue(undefined);
        mocks.deleteS3Object.mockResolvedValue(undefined);
    });

    it("許認可証が10件を超える場合はエラーになり、外部処理を行わない", async () => {
        const overLimitFiles = Array.from({ length: 11 }, (_, index) => ({
            ...permitFiles[0],
            fileName: `permit-${index}.pdf`,
        }));

        await expect(
            updateShopSignup3UseCase({ shopSignupId: 11, userId: 7, body: createBody(overLimitFiles) }),
        ).rejects.toMatchObject({
            code: "OVER_MAX_PERMIT_FILE_COUNT",
            statusCode: 400,
        });

        expect(mocks.getMyShopSignupHasS3Data).not.toHaveBeenCalled();
        expect(mocks.uploadS3Object).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("ユーザーが所有するショップ申込がない場合はSHOP_SIGNUP_NOT_FOUNDになる", async () => {
        mocks.getMyShopSignupHasS3Data.mockResolvedValueOnce(null);

        await expect(
            updateShopSignup3UseCase({ shopSignupId: 11, userId: 7, body: createBody() }),
        ).rejects.toMatchObject({
            code: "SHOP_SIGNUP_NOT_FOUND",
            statusCode: 404,
        });

        expect(mocks.getMyShopSignupHasS3Data).toHaveBeenCalledWith({ shopSignupId: 11, userId: 7 });
        expect(mocks.uploadS3Object).not.toHaveBeenCalled();
    });

    it("身分証と許認可証をアップロードし、関連データを同一transactionで作成する", async () => {
        await expect(
            updateShopSignup3UseCase({ shopSignupId: 11, userId: 7, body: createBody() }),
        ).resolves.toBeUndefined();

        expect(mocks.uploadS3Object).toHaveBeenCalledTimes(4);
        expect(mocks.uploadS3Object).toHaveBeenCalledWith({
            bucketName: "verification-documents",
            objectKey: `idcard/front/11/${now}_front.jpg`,
            body: frontIdCard.buffer,
            contentType: "image/jpeg",
        });
        expect(mocks.uploadS3Object).toHaveBeenCalledWith({
            bucketName: "verification-documents",
            objectKey: `idcard/rear/11/${now}_rear.png`,
            body: rearIdCard.buffer,
            contentType: "image/png",
        });
        expect(mocks.createS3Metadata).toHaveBeenCalledTimes(4);
        expect(mocks.createIdCard).toHaveBeenCalledWith({
            data: {
                front_s3_metadata_id: 101,
                rear_s3_metadata_id: 102,
            },
            transaction,
        });
        expect(mocks.createPermit).toHaveBeenCalledWith({
            data: {
                permit_number: null,
                permit_type: null,
                issued_at: null,
                expired_at: null,
            },
            transaction,
        });
        expect(mocks.createPermitFile).toHaveBeenCalledTimes(2);
        expect(mocks.createPermitFile).toHaveBeenCalledWith({
            data: {
                permit_id: 401,
                s3_metadata_id: 201,
                sort_order: 1,
                document_name: null,
                memo: null,
            },
            transaction,
        });
        expect(mocks.createPermitFile).toHaveBeenCalledWith({
            data: {
                permit_id: 401,
                s3_metadata_id: 202,
                sort_order: 2,
                document_name: null,
                memo: null,
            },
            transaction,
        });
        expect(mocks.updateSignup3).toHaveBeenCalledWith({
            shopSignup,
            data: { idcard_id: 301, permit_id: 401 },
            transaction,
        });
        expect(mocks.deleteS3Object).not.toHaveBeenCalled();
    });

    it("許認可証がない場合はPermitを作成せずpermit_idをnullにする", async () => {
        await updateShopSignup3UseCase({ shopSignupId: 11, userId: 7, body: createBody([]) });

        expect(mocks.uploadS3Object).toHaveBeenCalledTimes(2);
        expect(mocks.createPermit).not.toHaveBeenCalled();
        expect(mocks.createPermitFile).not.toHaveBeenCalled();
        expect(mocks.updateSignup3).toHaveBeenCalledWith({
            shopSignup,
            data: { idcard_id: 301, permit_id: null },
            transaction,
        });
    });

    it("許認可証のアップロードに失敗した場合はアップロード済みS3オブジェクトを補償削除する", async () => {
        mocks.uploadS3Object.mockImplementation(async ({ objectKey }: { objectKey: string }) => {
            if (objectKey.includes("permit-2.jpg")) throw new Error("permit upload failed");
            return uploadedObject(objectKey);
        });

        await expect(updateShopSignup3UseCase({ shopSignupId: 11, userId: 7, body: createBody() })).rejects.toThrow(
            "permit upload failed",
        );

        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.deleteS3Object).toHaveBeenCalledTimes(3);
        expect(mocks.deleteS3Object).toHaveBeenCalledWith(
            expect.objectContaining({ objectKey: `idcard/front/11/${now}_front.jpg` }),
        );
        expect(mocks.deleteS3Object).toHaveBeenCalledWith(
            expect.objectContaining({ objectKey: `idcard/rear/11/${now}_rear.png` }),
        );
        expect(mocks.deleteS3Object).toHaveBeenCalledWith(
            expect.objectContaining({ objectKey: `permit/11/${now}_permit-1.pdf` }),
        );
    });

    it("DB更新に失敗した場合は今回アップロードした全S3オブジェクトを補償削除する", async () => {
        mocks.createIdCard.mockRejectedValueOnce(new Error("database failed"));

        await expect(updateShopSignup3UseCase({ shopSignupId: 11, userId: 7, body: createBody() })).rejects.toThrow(
            "database failed",
        );

        expect(mocks.deleteS3Object).toHaveBeenCalledTimes(4);
        expect(mocks.updateSignup3).not.toHaveBeenCalled();
    });

    it("commit後に旧S3Metadataをtransaction内で削除する", async () => {
        const oldFrontS3Metadata = { id: 501 };
        const oldRearS3Metadata = { id: 502 };
        const oldPermitS3Metadata = [{ id: 503 }, { id: 504 }];
        const shopSignupWithOldData = {
            id: 11,
            IdCard: {
                FrontIdCard: { FrontS3Metadata: oldFrontS3Metadata },
                RearIdCard: { RearS3Metadata: oldRearS3Metadata },
            },
            Permit: {
                Permit: { S3Metadata: oldPermitS3Metadata },
            },
        };
        mocks.getMyShopSignupHasS3Data.mockResolvedValueOnce(shopSignupWithOldData);

        await updateShopSignup3UseCase({ shopSignupId: 11, userId: 7, body: createBody([]) });

        expect(mocks.transaction).toHaveBeenCalledTimes(2);
        expect(mocks.deleteS3Metadata).toHaveBeenCalledTimes(4);
        for (const s3Metadata of [oldFrontS3Metadata, oldRearS3Metadata, ...oldPermitS3Metadata]) {
            expect(mocks.deleteS3Metadata).toHaveBeenCalledWith({ s3Metadata, transaction });
        }
    });
});
