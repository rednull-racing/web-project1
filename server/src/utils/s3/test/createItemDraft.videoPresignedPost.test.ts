import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectAppError } from "../../../../test/fixtures/itemDraft/createItemDraft/fixtures.js";

const mocks = vi.hoisted(() => ({
    createPresignedPost: vi.fn(),
    buckets: { public: undefined as string | undefined },
    s3: {},
}));
vi.mock("@aws-sdk/s3-presigned-post", () => ({ createPresignedPost: mocks.createPresignedPost }));
vi.mock("../../../infra/aws/s3.js", () => ({ buckets: mocks.buckets, s3: mocks.s3 }));
import { createVideoPresignedPost } from "../videoPresignedPost.js";

const params = { key: "video/original/7/test", contentType: "video/mp4", contentLengthRange: 500 * 1024 * 1024 };
beforeEach(() => {
    vi.resetAllMocks();
    mocks.buckets.public = "test-public-bucket";
});

describe("P0/P1: F5の動画署名utility境界（AWS通信なし）", () => {
    it.each([undefined, ""])("AF-SIGN04: bucket=%sなら500、AWS呼出しなし", async (bucket) => {
        mocks.buckets.public = bucket;
        await expectAppError(createVideoPresignedPost(params), "VIDEO_SIGNED_URL_UNAVAILABLE", 500);
        expect(mocks.createPresignedPost).not.toHaveBeenCalled();
    });
    it("AF-SIGN03: 正常署名の引数・制約・返却参照を維持する", async () => {
        const post = { url: "https://upload.test", fields: { key: params.key } };
        mocks.createPresignedPost.mockResolvedValue(post);
        expect(await createVideoPresignedPost(params)).toBe(post);
        expect(mocks.createPresignedPost).toHaveBeenCalledExactlyOnceWith(mocks.s3, {
            Bucket: "test-public-bucket",
            Key: params.key,
            Conditions: [
                ["content-length-range", 0, params.contentLengthRange],
                ["starts-with", "$Content-Type", "video/mp4"],
            ],
            Fields: { "Content-Type": "video/mp4" },
            Expires: 60,
        });
    });
    it("AF-SIGN03: AWS側の例外は同一オブジェクトで伝播する", async () => {
        const error = new Error("署名処理失敗");
        mocks.createPresignedPost.mockRejectedValue(error);
        await expect(createVideoPresignedPost(params)).rejects.toBe(error);
        expect(mocks.createPresignedPost).toHaveBeenCalledOnce();
    });
});
