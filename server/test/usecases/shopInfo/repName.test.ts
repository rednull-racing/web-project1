import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { parseMultipartBody } from "../../../src/middleware/multipart.js";
import { validateBody } from "../../../src/middleware/validate/validateBody.js";
import { repNameBodySchema, updateRepNameBodySchema } from "../../../src/validators/body/shopInfo.js";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    uploadS3Object: vi.fn(),
    deleteS3Object: vi.fn(),
    createIdCard: vi.fn(),
    updateIdCardS3Metadata: vi.fn(),
    createS3Metadata: vi.fn(),
    deleteS3Metadata: vi.fn(),
    getMyShopHasRepName: vi.fn(),
    updateShopIdCard: vi.fn(),
    updateName: vi.fn(),
}));
vi.mock("../../../src/db.js", () => ({ default: { transaction: mocks.transaction } }));
vi.mock("../../../src/infra/aws/deleteS3Object.js", () => ({ deleteS3Object: mocks.deleteS3Object }));
vi.mock("../../../src/infra/aws/s3.js", () => ({ buckets: { verificationDocuments: "verification-documents" } }));
vi.mock("../../../src/infra/aws/uploadS3Object.js", () => ({ uploadS3Object: mocks.uploadS3Object }));
vi.mock("../../../src/services/idCard.js", () => ({
    createIdCard: mocks.createIdCard,
    updateIdCardS3Metadata: mocks.updateIdCardS3Metadata,
}));
vi.mock("../../../src/services/s3Metadata.js", () => ({
    createS3Metadata: mocks.createS3Metadata,
    deleteS3Metadata: mocks.deleteS3Metadata,
}));
vi.mock("../../../src/services/shopInfo/query.js", () => ({ getMyShopHasRepName: mocks.getMyShopHasRepName }));
vi.mock("../../../src/services/shopInfo/command.js", () => ({ updateShopIdCard: mocks.updateShopIdCard }));
vi.mock("../../../src/services/name.js", () => ({ updateName: mocks.updateName }));

import { updateRepNameUseCase } from "../../../src/usecases/shopInfo/edit/repName.js";

const name = { sei: "山田", mei: "太郎", seiKana: "ヤマダ", meiKana: "タロウ" };
const file = { fileName: "id.jpg", contentType: "image/jpeg", size: 5, buffer: Buffer.from("image") };
const transaction = { id: "transaction" };
const shop = {
    RepresentativeName: { id: 10 },
    IdCard: { id: 20, FrontIdCard: { id: 30 }, RearIdCard: { id: 40 } },
};
const existingBody = { ...name, frontS3MetadataId: "30", rearS3MetadataId: "40" };
const run = (body: unknown) =>
    updateRepNameUseCase({
        shopId: 1,
        userId: 2,
        body: updateRepNameBodySchema.parse(body),
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
    mocks.createS3Metadata.mockResolvedValueOnce({ id: 50 }).mockResolvedValueOnce({ id: 60 });
    mocks.createIdCard.mockResolvedValue({ id: 70 });
});

describe("代表者氏名の身分証アップロード", () => {
    it("multipartの表裏ファイルが検証を通り、氏名と同じtransactionで保存される", async () => {
        const app = express();
        app.patch(
            "/",
            ...parseMultipartBody([
                { name: "frontIdCard", maxCount: 1 },
                { name: "rearIdCard", maxCount: 1 },
            ]),
            validateBody(updateRepNameBodySchema),
            async (req, res) => {
                await run(req.validatedBody);
                res.sendStatus(200);
            },
        );
        await request(app)
            .patch("/")
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
        expect(mocks.updateIdCardS3Metadata).toHaveBeenCalledWith({
            idCard: shop.IdCard,
            data: { front_s3_metadata_id: 50, rear_s3_metadata_id: 60 },
            transaction,
        });
        expect(mocks.updateName).toHaveBeenCalledWith({
            name: shop.RepresentativeName,
            data: { sei: name.sei, mei: name.mei, sei_kana: name.seiKana, mei_kana: name.meiKana },
            transaction,
        });
        expect(mocks.deleteS3Object).not.toHaveBeenCalled();
    });

    it("既存画像を維持したまま氏名を更新する", async () => {
        await run(existingBody);
        expect(mocks.getMyShopHasRepName).toHaveBeenCalledWith({ shopId: 1, userId: 2 });
        expect(mocks.uploadS3Object).not.toHaveBeenCalled();
        expect(mocks.updateIdCardS3Metadata).not.toHaveBeenCalled();
        expect(mocks.deleteS3Metadata).not.toHaveBeenCalled();
        expect(mocks.updateName).toHaveBeenCalledOnce();
    });

    it("表面だけを差し替え、裏面を維持する", async () => {
        await run({ ...existingBody, frontIdCard: file });
        expect(mocks.updateIdCardS3Metadata).toHaveBeenCalledWith({
            idCard: shop.IdCard,
            data: { front_s3_metadata_id: 50, rear_s3_metadata_id: 40 },
            transaction,
        });
        expect(mocks.deleteS3Metadata).toHaveBeenCalledExactlyOnceWith({
            s3Metadata: shop.IdCard.FrontIdCard,
            transaction,
        });
    });

    it("身分証未登録の場合は作成してショップへ紐付ける", async () => {
        mocks.getMyShopHasRepName.mockResolvedValueOnce({ RepresentativeName: shop.RepresentativeName });
        await run({ ...name, frontIdCard: file, rearIdCard: file });
        expect(mocks.updateShopIdCard).toHaveBeenCalledWith(
            expect.objectContaining({ data: { idcard_id: 70 }, transaction }),
        );
    });

    it("所有しないショップ・画像はアップロード前に拒否する", async () => {
        mocks.getMyShopHasRepName.mockResolvedValueOnce(null);
        await expect(run(existingBody)).rejects.toMatchObject({ code: "SHOP_NOT_FOUND" });
        await expect(run({ ...existingBody, frontS3MetadataId: "999" })).rejects.toMatchObject({
            code: "S3_METADATA_NOT_FOUND",
        });
        expect(mocks.uploadS3Object).not.toHaveBeenCalled();
        expect(mocks.updateName).not.toHaveBeenCalled();
    });

    it("裏面のアップロード失敗時はアップロード済みの表面を補償削除する", async () => {
        const error = new Error("upload failed");
        mocks.uploadS3Object
            .mockResolvedValueOnce({
                bucketName: "verification-documents",
                objectKey: "front",
                versionId: "v1",
                etag: null,
            })
            .mockRejectedValueOnce(error);
        await expect(run({ ...name, frontIdCard: file, rearIdCard: file })).rejects.toBe(error);
        expect(mocks.deleteS3Object).toHaveBeenCalledExactlyOnceWith({
            bucketName: "verification-documents",
            objectKey: "front",
            versionId: "v1",
        });
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("氏名のDB更新失敗時は新しいS3オブジェクトを両方削除する", async () => {
        const error = new Error("DB failed");
        mocks.updateName.mockRejectedValueOnce(error);
        await expect(run({ ...name, frontIdCard: file, rearIdCard: file })).rejects.toBe(error);
        expect(mocks.deleteS3Object).toHaveBeenCalledTimes(2);
    });

    it("画像不足・不正IDを拒否し、別APIの旧入力形式を維持する", () => {
        for (const body of [
            name,
            { ...existingBody, frontS3MetadataId: "0" },
            { ...existingBody, rearS3MetadataId: "1.5" },
        ]) {
            expect(updateRepNameBodySchema.safeParse(body).success).toBe(false);
        }
        expect(repNameBodySchema.safeParse({ ...name, frontFileName: "front.jpg", idFrontUpload: true }).success).toBe(
            true,
        );
    });
});
