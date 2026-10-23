import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UpdateItemDraftVideoData, UpdateItemDraftVideoParams } from "../../../types/serviceType/itemDraft.js";

const mocks = vi.hoisted(() => ({ findOne: vi.fn() }));
vi.mock("../../../models/index.js", () => ({ ItemDraft: { findOne: mocks.findOne } }));
import { updateItemDraftVideo } from "../command.js";
import { getMyItemDraft } from "../query.js";

beforeEach(() => vi.resetAllMocks());

describe("動画変換のservice契約（実DBなし）", () => {
    it.each<UpdateItemDraftVideoData>([
        { video_status: "processing" },
        { video_status: "converted", converted_url: "https://media.test/new/index.m3u8", duration: 0 },
        { video_status: "failed", converted_url: null },
    ])("S01: $video_status のDTOと同じtransactionだけをインスタンス更新へ渡す", async (data) => {
        const update = vi.fn().mockResolvedValue({});
        const itemDraft = { update } as unknown as UpdateItemDraftVideoParams["itemDraft"];
        const transaction = { id: "video-transaction" } as unknown as Transaction;
        expect(await updateItemDraftVideo({ itemDraft, data, transaction })).toBeUndefined();
        expect(update).toHaveBeenCalledExactlyOnceWith(data, { transaction });
        expect(update.mock.calls[0][0]).toBe(data);
        expect(update.mock.calls[0][1].transaction).toBe(transaction);
        expect(mocks.findOne).not.toHaveBeenCalled();
    });

    it("S02: インスタンス更新が完了するまで待ち、元例外をそのまま伝播する", async () => {
        let rejectUpdate!: (error: Error) => void;
        const update = vi.fn(
            () =>
                new Promise<void>((_resolve, reject) => {
                    rejectUpdate = reject;
                }),
        );
        const itemDraft = { update } as unknown as UpdateItemDraftVideoParams["itemDraft"];
        const transaction = { id: "video-transaction" } as unknown as Transaction;
        const error = new Error("video persistence failed");
        let settled = false;
        const task = updateItemDraftVideo({ itemDraft, data: { video_status: "processing" }, transaction });
        const assertion = expect(task).rejects.toBe(error);
        const observed = task.then(
            () => {
                settled = true;
            },
            () => {
                settled = true;
            },
        );
        try {
            await Promise.resolve();
            expect(settled).toBe(false);
        } finally {
            rejectUpdate(error);
            await Promise.all([assertion, observed]);
        }
    });

    it("S03: 所有者と対象IDで絞り込み、必須transactionのUPDATEロックで動画列を取得する", async () => {
        const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
        const row = { id: 19 };
        mocks.findOne.mockResolvedValue(row);
        expect(await getMyItemDraft({ itemDraftId: 19, userId: 31, transaction })).toBe(row);
        expect(mocks.findOne).toHaveBeenCalledExactlyOnceWith({
            attributes: [
                "id",
                "name",
                "detail",
                "image_url",
                "price",
                "item_condition_id",
                "first_image_url",
                "gender_type",
                "age_type",
                "recommend",
                "category_id",
                "brand_id",
                "brand_aliases_id",
                "attributes",
                "thumbnail_url",
                "title",
                "summary",
                "duration",
                "original_url",
                "converted_url",
                "video_status",
                "before_price",
                "discount_rate",
                "discount_amount",
                "sale_flag",
                "shipping_day_id",
                "shipping_service_id",
                "shipping_place_id",
                "shipping_service_free_text",
            ],
            where: { id: 19, seller_id: 31 },
            transaction,
            lock: "UPDATE",
        });
        expect(mocks.findOne.mock.calls[0][0].transaction).toBe(transaction);
    });

    it("S04: 所有者限定検索のnullと元DB例外をそのまま返す", async () => {
        const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
        mocks.findOne.mockResolvedValueOnce(null);
        expect(await getMyItemDraft({ itemDraftId: 19, userId: 31, transaction })).toBeNull();
        const error = new Error("lookup failed");
        mocks.findOne.mockRejectedValueOnce(error);
        await expect(getMyItemDraft({ itemDraftId: 19, userId: 31, transaction })).rejects.toBe(error);
    });
});
