import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
    UpdateItemEditingVideoData,
    UpdateItemEditingVideoParams,
} from "../../../types/serviceType/itemEditing.js";

const mocks = vi.hoisted(() => ({ findOne: vi.fn() }));
vi.mock("../../../models/index.js", () => ({ ItemEditing: { findOne: mocks.findOne } }));
import { updateItemEditingVideo } from "../command.js";
import { getMyItemEditing } from "../query.js";

beforeEach(() => vi.resetAllMocks());

describe("動画変換のservice契約（実DBなし）", () => {
    it.each<UpdateItemEditingVideoData>([
        { video_status: "processing" },
        { video_status: "converted", converted_url: "https://media.test/new/index.m3u8", duration: 0 },
        { video_status: "failed", converted_url: null },
    ])("S01: $video_status のDTOと同じtransactionだけをインスタンス更新へ渡す", async (data) => {
        const update = vi.fn().mockResolvedValue({});
        const itemEditing = { update } as unknown as UpdateItemEditingVideoParams["itemEditing"];
        const transaction = { id: "video-transaction" } as unknown as Transaction;
        expect(await updateItemEditingVideo({ itemEditing, data, transaction })).toBeUndefined();
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
        const itemEditing = { update } as unknown as UpdateItemEditingVideoParams["itemEditing"];
        const transaction = { id: "video-transaction" } as unknown as Transaction;
        const error = new Error("video persistence failed");
        let settled = false;
        const task = updateItemEditingVideo({ itemEditing, data: { video_status: "processing" }, transaction });
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

    it.each([false, true])(
        "S03: transaction指定=%sで所有者を同じwhereに含め、指定時だけUPDATEロックを渡す",
        async (locked) => {
            const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
            const row = { id: 19 };
            mocks.findOne.mockResolvedValue(row);
            expect(await getMyItemEditing({ itemEditingId: 19, userId: 31, ...(locked ? { transaction } : {}) })).toBe(
                row,
            );
            expect(mocks.findOne).toHaveBeenCalledExactlyOnceWith({
                where: { id: 19, seller_id: 31 },
                ...(locked ? { transaction, lock: "UPDATE" } : {}),
            });
        },
    );

    it("S04: 所有者限定検索のnullと元DB例外をそのまま返す", async () => {
        mocks.findOne.mockResolvedValueOnce(null);
        expect(await getMyItemEditing({ itemEditingId: 19, userId: 31 })).toBeNull();
        const error = new Error("lookup failed");
        mocks.findOne.mockRejectedValueOnce(error);
        await expect(getMyItemEditing({ itemEditingId: 19, userId: 31 })).rejects.toBe(error);
    });
});
