import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { parseMultipartBody } from "../../../src/middleware/multipart.js";
import { shopSignup3BodySchema } from "../../../src/validators/body/shopSignup.js";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    uploadS3Object: vi.fn(),
    deleteS3Object: vi.fn(),
    createIdCard: vi.fn(),
    updateIdCardS3Metadata: vi.fn(),
    createPermit: vi.fn(),
    updatePermit: vi.fn(),
    deletePermit: vi.fn(),
    createS3Metadata: vi.fn(),
    deleteS3Metadata: vi.fn(),
    getMyShopSignupHasS3Data: vi.fn(),
    updateSignup3: vi.fn(),
}));

vi.mock("../../../src/db.js", () => ({ default: { transaction: mocks.transaction } }));
vi.mock("../../../src/infra/aws/deleteS3Object.js", () => ({ deleteS3Object: mocks.deleteS3Object }));
vi.mock("../../../src/infra/aws/s3.js", () => ({ buckets: { verificationDocuments: "verification-documents" } }));
vi.mock("../../../src/infra/aws/uploadS3Object.js", () => ({ uploadS3Object: mocks.uploadS3Object }));
vi.mock("../../../src/services/idCard.js", () => ({
    createIdCard: mocks.createIdCard,
    updateIdCardS3Metadata: mocks.updateIdCardS3Metadata,
}));
vi.mock("../../../src/services/permit.js", () => ({
    createPermit: mocks.createPermit,
    updatePermit: mocks.updatePermit,
    deletePermit: mocks.deletePermit,
}));
vi.mock("../../../src/services/s3Metadata.js", () => ({
    createS3Metadata: mocks.createS3Metadata,
    deleteS3Metadata: mocks.deleteS3Metadata,
}));
vi.mock("../../../src/services/shopSignup.js", () => ({
    getMyShopSignupHasS3Data: mocks.getMyShopSignupHasS3Data,
    updateSignup3: mocks.updateSignup3,
}));

import { updateShopSignup3UseCase } from "../../../src/usecases/shopSignup/edit/signup3/signup3.js";

const transaction = { id: "transaction" };
const file = {
    fileName: "image.jpg",
    contentType: "image/jpeg",
    size: 5,
    buffer: Buffer.from("image"),
};
const existingBody = {
    frontS3MetadataId: "501",
    rearS3MetadataId: "502",
    requiresPermit: "true",
    permits: [{ s3MetadataId: "503" }, { s3MetadataId: "504" }],
};
const makeShopSignup = () => ({
    id: 11,
    IdCard: { id: 301, FrontIdCard: { id: 501 }, RearIdCard: { id: 502 } },
    Permit: [
        { id: 401, S3Metadata: { id: 503 }, document_name: "許可証A" },
        { id: 402, S3Metadata: { id: 504 }, document_name: "許可証B" },
    ],
});
const run = (body: unknown) =>
    updateShopSignup3UseCase({
        shopSignupId: 11,
        userId: 7,
        body: shopSignup3BodySchema.parse(body),
    });

describe("shopSignup3BodySchema", () => {
    it.each([
        existingBody,
        { frontIdCard: file, rearIdCard: file, permitFiles: [file] },
        { ...existingBody, frontIdCard: file, rearIdCard: file },
        { ...existingBody, permitFiles: [file], permits: [{ s3MetadataId: "503" }, { fileIndex: "0" }] },
        { ...existingBody, permitFiles: [file], permits: [{ s3MetadataId: "503", fileIndex: "0" }] },
        { ...existingBody, requiresPermit: "false", permits: [] },
    ])("新規・既存・混在の入力を受け付ける: %j", (body) => {
        expect(shopSignup3BodySchema.safeParse(body).success).toBe(true);
    });

    it.each([
        {},
        { ...existingBody, frontS3MetadataId: undefined },
        { ...existingBody, rearS3MetadataId: undefined },
        { ...existingBody, permits: [] },
        { ...existingBody, permits: [{}] },
        { ...existingBody, permits: [{ s3MetadataId: "-1" }] },
        { ...existingBody, permits: [{ s3MetadataId: "1.5" }] },
        { ...existingBody, permits: [{ fileIndex: "0" }] },
        { ...existingBody, permits: [{ s3MetadataId: "503" }, { s3MetadataId: "503" }] },
        { ...existingBody, permitFiles: [file] },
        { ...existingBody, permitFiles: [file], permits: [{ fileIndex: "0" }, { fileIndex: "0" }] },
        { ...existingBody, permits: Array.from({ length: 11 }, (_, index) => ({ s3MetadataId: String(index + 1) })) },
    ])("不足・不正・重複・上限超過の入力を拒否する: %j", (body) => {
        expect(shopSignup3BodySchema.safeParse(body).success).toBe(false);
    });

    it("multipartで既存IDとファイルの順序を維持して検証できる", async () => {
        const app = express();
        app.patch(
            "/",
            ...parseMultipartBody([
                { name: "frontIdCard", maxCount: 1 },
                { name: "rearIdCard", maxCount: 1 },
                { name: "permitFiles", maxCount: 10 },
            ]),
            (req, res) => {
                const body = shopSignup3BodySchema.parse(req.body);
                res.json({
                    frontId: body.frontS3MetadataId,
                    rearId: body.rearS3MetadataId,
                    fileName: body.permitFiles[0]?.fileName,
                    permits: body.permits,
                });
            },
        );
        const response = await request(app)
            .patch("/")
            .field("frontS3MetadataId", "501")
            .field("rearS3MetadataId", "502")
            .field("requiresPermit", "true")
            .field("permits[0][s3MetadataId]", "503")
            .field("permits[1][fileIndex]", "0")
            .attach("permitFiles", file.buffer, "new.jpg");
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            frontId: 501,
            rearId: 502,
            fileName: "new.jpg",
            permits: [{ s3MetadataId: 503 }, { fileIndex: 0 }],
        });
    });
});

describe("updateShopSignup3UseCase", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.transaction.mockImplementation(async (callback: (t: typeof transaction) => Promise<void>) =>
            callback(transaction),
        );
        mocks.getMyShopSignupHasS3Data.mockResolvedValue(makeShopSignup());
        mocks.uploadS3Object.mockImplementation(async ({ objectKey }: { objectKey: string }) => ({
            bucketName: "verification-documents",
            objectKey,
            etag: null,
            versionId: "version",
        }));
        let metadataId = 1000;
        mocks.createS3Metadata.mockImplementation(async () => ({ id: ++metadataId }));
        mocks.createIdCard.mockResolvedValue({ id: 301 });
    });

    it("既存IDだけで再送信でき、身分証と許認可証を作り直さない", async () => {
        await run(existingBody);
        expect(mocks.getMyShopSignupHasS3Data).toHaveBeenCalledWith({ shopSignupId: 11, userId: 7 });
        expect(mocks.uploadS3Object).not.toHaveBeenCalled();
        expect(mocks.createS3Metadata).not.toHaveBeenCalled();
        expect(mocks.createIdCard).not.toHaveBeenCalled();
        expect(mocks.updateIdCardS3Metadata).not.toHaveBeenCalled();
        expect(mocks.createPermit).not.toHaveBeenCalled();
        expect(mocks.deletePermit).not.toHaveBeenCalled();
        expect(mocks.deleteS3Metadata).not.toHaveBeenCalled();
        expect(mocks.updatePermit).toHaveBeenCalledWith({
            permit: expect.objectContaining({ id: 401, document_name: "許可証A" }),
            data: { s3_metadata_id: 503, sort_order: 1 },
            transaction,
        });
    });

    it("初回は新規ファイルから身分証・許認可証を作成する", async () => {
        mocks.getMyShopSignupHasS3Data.mockResolvedValueOnce({ id: 11, IdCard: null, Permit: [] });
        await run({ frontIdCard: file, rearIdCard: file, permitFiles: [file, file] });
        expect(mocks.uploadS3Object).toHaveBeenCalledTimes(4);
        const objectKeys = mocks.uploadS3Object.mock.calls.map(([args]) => args.objectKey);
        expect(new Set(objectKeys).size).toBe(4);
        expect(mocks.createIdCard).toHaveBeenCalledWith({
            data: { front_s3_metadata_id: 1001, rear_s3_metadata_id: 1002 },
            transaction,
        });
        expect(mocks.createPermit).toHaveBeenCalledTimes(2);
        expect(mocks.updateSignup3).toHaveBeenCalledWith({
            shopSignup: expect.objectContaining({ id: 11 }),
            data: { idcard_id: 301 },
            transaction,
        });
    });

    it.each(["front", "rear"])("既存IDと新規ファイルがある場合は%sの新規ファイルを優先する", async (side) => {
        await run({ ...existingBody, [side === "front" ? "frontIdCard" : "rearIdCard"]: file });
        expect(mocks.uploadS3Object).toHaveBeenCalledTimes(1);
        expect(mocks.updateIdCardS3Metadata).toHaveBeenCalledWith({
            idCard: expect.objectContaining({ id: 301 }),
            data: {
                front_s3_metadata_id: side === "front" ? 1001 : 501,
                rear_s3_metadata_id: side === "rear" ? 1001 : 502,
            },
            transaction,
        });
        expect(mocks.deleteS3Metadata).toHaveBeenCalledExactlyOnceWith({
            s3Metadata: { id: side === "front" ? 501 : 502 },
            transaction,
        });
        expect(mocks.createIdCard).not.toHaveBeenCalled();
        expect(mocks.updateIdCardS3Metadata.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.deleteS3Metadata.mock.invocationCallOrder[0],
        );
    });

    it("許認可証は既存を残しながら追加できる", async () => {
        await run({ ...existingBody, permitFiles: [file], permits: [...existingBody.permits, { fileIndex: "0" }] });
        expect(mocks.uploadS3Object).toHaveBeenCalledTimes(1);
        expect(mocks.createPermit).toHaveBeenCalledExactlyOnceWith({
            data: expect.objectContaining({ s3_metadata_id: 1001, sort_order: 3, shop_signup_id: 11 }),
            transaction,
        });
        expect(mocks.deletePermit).not.toHaveBeenCalled();
        expect(mocks.deleteS3Metadata).not.toHaveBeenCalled();
    });

    it("許認可証の同じ項目に既存IDと新規ファイルがある場合は既存レコードを差し替える", async () => {
        await run({
            ...existingBody,
            permitFiles: [file],
            permits: [{ s3MetadataId: "503", fileIndex: "0" }, { s3MetadataId: "504" }],
        });
        expect(mocks.updatePermit).toHaveBeenCalledWith({
            permit: expect.objectContaining({ id: 401 }),
            data: { s3_metadata_id: 1001, sort_order: 1 },
            transaction,
        });
        expect(mocks.createPermit).not.toHaveBeenCalled();
        expect(mocks.deleteS3Metadata).toHaveBeenCalledExactlyOnceWith({ s3Metadata: { id: 503 }, transaction });
    });

    it("一覧から除いた許認可証だけを削除し、残った画像の順序を更新する", async () => {
        await run({ ...existingBody, permits: [{ s3MetadataId: "504" }] });
        expect(mocks.deletePermit).toHaveBeenCalledExactlyOnceWith({
            permit: expect.objectContaining({ id: 401 }),
            transaction,
        });
        expect(mocks.deleteS3Metadata).toHaveBeenCalledExactlyOnceWith({ s3Metadata: { id: 503 }, transaction });
        expect(mocks.updatePermit).toHaveBeenCalledWith({
            permit: expect.objectContaining({ id: 402 }),
            data: { s3_metadata_id: 504, sort_order: 1 },
            transaction,
        });
        expect(mocks.deletePermit.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.deleteS3Metadata.mock.invocationCallOrder[0],
        );
    });

    it("許認可が不要に変更された場合は既存の許認可証を外す", async () => {
        await run({ ...existingBody, requiresPermit: "false", permits: [] });
        expect(mocks.deletePermit).toHaveBeenCalledTimes(2);
        expect(mocks.deleteS3Metadata).toHaveBeenCalledTimes(2);
        expect(mocks.uploadS3Object).not.toHaveBeenCalled();
    });

    it("申込の所有者ではない場合は拒否する", async () => {
        mocks.getMyShopSignupHasS3Data.mockResolvedValueOnce(null);
        await expect(run(existingBody)).rejects.toMatchObject({ code: "SHOP_SIGNUP_NOT_FOUND" });
        expect(mocks.uploadS3Object).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each([
        { ...existingBody, frontS3MetadataId: "999" },
        { ...existingBody, rearS3MetadataId: "501" },
        { ...existingBody, permits: [{ s3MetadataId: "999" }] },
        { ...existingBody, permits: [{ s3MetadataId: "501" }] },
    ])("別の申込や別の種類の既存IDを拒否する: %j", async (body) => {
        await expect(run(body)).rejects.toMatchObject({ code: "S3_METADATA_NOT_FOUND" });
        expect(mocks.uploadS3Object).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("新規ファイルがあれば、採用しない既存IDを参照に使わない", async () => {
        await run({
            ...existingBody,
            frontIdCard: file,
            frontS3MetadataId: "999",
            permitFiles: [file],
            permits: [...existingBody.permits, { fileIndex: "0", s3MetadataId: "999" }],
        });
        expect(mocks.uploadS3Object).toHaveBeenCalledTimes(2);
        expect(mocks.createPermit).toHaveBeenCalledWith({
            data: expect.objectContaining({ s3_metadata_id: 1002 }),
            transaction,
        });
    });

    it("同じ既存許認可証への差し替えを重複して指定できない", async () => {
        await expect(
            run({
                ...existingBody,
                permitFiles: [file],
                permits: [{ fileIndex: "0", s3MetadataId: "503" }, { s3MetadataId: "503" }],
            }),
        ).rejects.toMatchObject({ code: "INVALID_BODY" });
        expect(mocks.uploadS3Object).not.toHaveBeenCalled();
    });

    it("S3アップロード失敗時は今回成功したアップロードだけを補償削除する", async () => {
        mocks.uploadS3Object
            .mockRejectedValueOnce(new Error("upload failed"))
            .mockResolvedValueOnce({ bucketName: "verification-documents", objectKey: "new-permit", versionId: "v" });
        await expect(
            run({
                ...existingBody,
                permitFiles: [file, file],
                permits: [...existingBody.permits, { fileIndex: "0" }, { fileIndex: "1" }],
            }),
        ).rejects.toThrow("upload failed");
        expect(mocks.deleteS3Object).toHaveBeenCalledExactlyOnceWith({
            bucketName: "verification-documents",
            objectKey: "new-permit",
            versionId: "v",
        });
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.deleteS3Metadata).not.toHaveBeenCalled();
    });

    it("DB更新失敗時は新規S3だけを補償削除する", async () => {
        mocks.updateIdCardS3Metadata.mockRejectedValueOnce(new Error("database failed"));
        await expect(run({ ...existingBody, frontIdCard: file })).rejects.toThrow("database failed");
        expect(mocks.deleteS3Object).toHaveBeenCalledTimes(1);
        expect(mocks.deleteS3Metadata).not.toHaveBeenCalled();
    });

    it("旧メタデータ削除も更新と同じtransactionで失敗させる", async () => {
        mocks.deleteS3Metadata.mockRejectedValueOnce(new Error("cleanup failed"));
        await expect(run({ ...existingBody, frontIdCard: file })).rejects.toThrow("cleanup failed");
        expect(mocks.transaction).toHaveBeenCalledTimes(1);
        expect(mocks.deleteS3Metadata).toHaveBeenCalledWith({ s3Metadata: { id: 501 }, transaction });
        expect(mocks.deleteS3Object).toHaveBeenCalledTimes(1);
    });
});
