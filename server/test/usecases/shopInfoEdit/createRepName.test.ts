import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { parseMultipartBody } from "../../../src/middleware/multipart.js";
import { validateBody } from "../../../src/middleware/validate/validateBody.js";
import { createShopEditRepNameBodySchema } from "../../../src/validators/body/shopInfoEdit.js";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    uploadS3Object: vi.fn(),
    getS3Object: vi.fn(),
    deleteS3Object: vi.fn(),
    createIdCard: vi.fn(),
    createS3Metadata: vi.fn(),
    getMyShopHasRepName: vi.fn(),
    createNameShop: vi.fn(),
    createShopEditWithIdCard: vi.fn(),
    createNotification: vi.fn(),
}));
vi.mock("../../../src/db.js", () => ({ default: { transaction: mocks.transaction } }));
vi.mock("../../../src/infra/aws/deleteS3Object.js", () => ({ deleteS3Object: mocks.deleteS3Object }));
vi.mock("../../../src/infra/aws/getS3Object.js", () => ({ getS3Object: mocks.getS3Object }));
vi.mock("../../../src/infra/aws/s3.js", () => ({ buckets: { verificationDocuments: "verification-documents" } }));
vi.mock("../../../src/infra/aws/uploadS3Object.js", () => ({ uploadS3Object: mocks.uploadS3Object }));
vi.mock("../../../src/services/idCard.js", () => ({ createIdCard: mocks.createIdCard }));
vi.mock("../../../src/services/s3Metadata.js", () => ({ createS3Metadata: mocks.createS3Metadata }));
vi.mock("../../../src/services/shopInfo/query.js", () => ({ getMyShopHasRepName: mocks.getMyShopHasRepName }));
vi.mock("../../../src/services/shopInfoEdit/command.js", () => ({
    createShopEditWithIdCard: mocks.createShopEditWithIdCard,
}));
vi.mock("../../../src/services/name.js", () => ({ createNameShop: mocks.createNameShop }));
vi.mock("../../../src/services/notification.js", () => ({ createNotification: mocks.createNotification }));

import { createShopEditRepNameUseCase } from "../../../src/usecases/shopInfoEdit/create/createRepName.js";

const name = { sei: "山田", mei: "太郎", seiKana: "ヤマダ", meiKana: "タロウ" };
const file = { fileName: "id.jpg", contentType: "image/jpeg", size: 5, buffer: Buffer.from("image") };
const transaction = { id: "transaction" };
const metadata = {
    bucket_name: "verification-documents",
    version_id: "old-version",
    content_type: "image/jpeg",
    original_file_name: "old.jpg",
};
const shop = {
    IdCard: {
        id: 20,
        FrontIdCard: { ...metadata, id: 30, object_key: "old-front" },
        RearIdCard: { ...metadata, id: 40, object_key: "old-rear" },
    },
};
const existingBody = { ...name, frontS3MetadataId: "30", rearS3MetadataId: "40" };
const run = (body: unknown) =>
    createShopEditRepNameUseCase({
        shopId: 1,
        userId: 2,
        body: createShopEditRepNameBodySchema.parse(body),
    });

beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (callback: (t: typeof transaction) => Promise<void>) =>
        callback(transaction),
    );
    mocks.getMyShopHasRepName.mockResolvedValue(shop);
    mocks.uploadS3Object.mockImplementation(async ({ bucketName, objectKey }) => ({
        bucketName,
        objectKey,
        versionId: "v1",
        etag: "etag",
    }));
    mocks.getS3Object.mockImplementation(async () => ({ body: Readable.from([file.buffer]) }));
    mocks.createS3Metadata.mockResolvedValueOnce({ id: 50 }).mockResolvedValueOnce({ id: 60 });
    mocks.createIdCard.mockResolvedValue({ id: 70 });
    mocks.createNameShop.mockResolvedValue({ id: 80 });
    mocks.createNotification.mockResolvedValue(undefined);
});

describe("代表者氏名変更申請の身分証アップロード", () => {
    it("multipartの画像をアップロードし、身分証・氏名・変更申請を同じtransactionで作成する", async () => {
        const app = express();
        app.post(
            "/",
            ...parseMultipartBody([
                { name: "frontIdCard", maxCount: 1 },
                { name: "rearIdCard", maxCount: 1 },
            ]),
            validateBody(createShopEditRepNameBodySchema),
            async (req, res) => {
                await run(req.validatedBody);
                res.sendStatus(200);
            },
        );
        await request(app)
            .post("/")
            .field(name)
            .attach("frontIdCard", file.buffer, "front.jpg")
            .attach("rearIdCard", file.buffer, "rear.jpg")
            .expect(200);
        expect(mocks.uploadS3Object).toHaveBeenCalledTimes(2);
        expect(mocks.uploadS3Object).toHaveBeenCalledWith(
            expect.objectContaining({
                bucketName: "verification-documents",
                body: file.buffer,
                contentType: "image/jpeg",
            }),
        );
        expect(mocks.createS3Metadata).toHaveBeenCalledWith({
            data: {
                bucket_name: "verification-documents",
                object_key: expect.stringContaining("idcard/shop-edit/front/1/"),
                version_id: "v1",
                original_file_name: "front.jpg",
                content_type: "image/jpeg",
                file_size: 5,
                etag: "etag",
            },
            transaction,
        });
        expect(mocks.createIdCard).toHaveBeenCalledWith({
            data: { front_s3_metadata_id: 50, rear_s3_metadata_id: 60 },
            transaction,
        });
        expect(mocks.createNameShop).toHaveBeenCalledWith({
            data: {
                sei: name.sei,
                mei: name.mei,
                sei_kana: name.seiKana,
                mei_kana: name.meiKana,
                shop_type: "representative",
            },
            transaction,
        });
        expect(mocks.createShopEditWithIdCard).toHaveBeenCalledWith({
            data: { user_id: 2, shop_info_id: 1, idcard_id: 70, name_representative_id: 80 },
            transaction,
        });
        expect(mocks.deleteS3Object).not.toHaveBeenCalled();
        expect(mocks.createNotification).toHaveBeenCalledOnce();
    });

    it("既存画像を申請専用に複製し、既存データは保持する", async () => {
        await run(existingBody);
        expect(mocks.getMyShopHasRepName).toHaveBeenCalledWith({ shopId: 1, userId: 2 });
        expect(mocks.getS3Object).toHaveBeenCalledTimes(2);
        expect(mocks.getS3Object).toHaveBeenCalledWith({
            bucketName: metadata.bucket_name,
            objectKey: "old-front",
            versionId: "old-version",
        });
        expect(mocks.uploadS3Object).toHaveBeenCalledTimes(2);
        expect(mocks.createIdCard).toHaveBeenCalledWith({
            data: { front_s3_metadata_id: 50, rear_s3_metadata_id: 60 },
            transaction,
        });
        expect(mocks.deleteS3Object).not.toHaveBeenCalled();
    });

    it("表面だけを新規アップロードし、裏面は既存画像から複製する", async () => {
        await run({ ...existingBody, frontIdCard: file });
        expect(mocks.getS3Object).toHaveBeenCalledExactlyOnceWith({
            bucketName: metadata.bucket_name,
            objectKey: "old-rear",
            versionId: "old-version",
        });
        expect(mocks.uploadS3Object).toHaveBeenCalledTimes(2);
    });

    it("既存の身分証がなくても表裏ファイルから申請できる", async () => {
        mocks.getMyShopHasRepName.mockResolvedValueOnce({});
        await run({ ...name, frontIdCard: file, rearIdCard: file });
        expect(mocks.getS3Object).not.toHaveBeenCalled();
        expect(mocks.createShopEditWithIdCard).toHaveBeenCalledOnce();
    });

    it("所有しないショップ・画像をS3アクセス前に拒否する", async () => {
        mocks.getMyShopHasRepName.mockResolvedValueOnce(null);
        await expect(run(existingBody)).rejects.toMatchObject({ code: "SHOP_NOT_FOUND" });
        for (const body of [
            { ...existingBody, frontS3MetadataId: "999" },
            { ...existingBody, rearS3MetadataId: "999" },
        ]) {
            await expect(run(body)).rejects.toMatchObject({ code: "S3_METADATA_NOT_FOUND" });
        }
        expect(mocks.uploadS3Object).not.toHaveBeenCalled();
        expect(mocks.getS3Object).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("裏面アップロード失敗時は表面の新規オブジェクトを補償削除する", async () => {
        const error = new Error("upload failed");
        mocks.uploadS3Object
            .mockResolvedValueOnce({
                bucketName: "verification-documents",
                objectKey: "new-front",
                versionId: "v1",
                etag: null,
            })
            .mockRejectedValueOnce(error);
        await expect(run({ ...name, frontIdCard: file, rearIdCard: file })).rejects.toBe(error);
        expect(mocks.deleteS3Object).toHaveBeenCalledExactlyOnceWith({
            bucketName: "verification-documents",
            objectKey: "new-front",
            versionId: "v1",
        });
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.createNotification).not.toHaveBeenCalled();
    });

    it("変更申請のDB保存失敗時は新しいS3オブジェクトだけを削除する", async () => {
        const error = new Error("DB failed");
        mocks.createShopEditWithIdCard.mockRejectedValueOnce(error);
        await expect(run(existingBody)).rejects.toBe(error);
        expect(mocks.deleteS3Object).toHaveBeenCalledTimes(2);
        for (const [params] of mocks.deleteS3Object.mock.calls) {
            expect(params.objectKey).toMatch(/^idcard\/shop-edit\/(front|rear)\/1\//);
            expect(params.versionId).toBe("v1");
        }
        expect(mocks.createNotification).not.toHaveBeenCalled();
    });

    it("画像不足・不正ID・旧署名付きURL用入力を拒否する", () => {
        for (const body of [
            name,
            { ...existingBody, frontS3MetadataId: "0" },
            { ...existingBody, rearS3MetadataId: "1.5" },
            { ...name, frontFileName: "front.jpg", idFrontUpload: true },
        ]) {
            expect(createShopEditRepNameBodySchema.safeParse(body).success).toBe(false);
        }
    });
});
