import { describe, expect, it } from "vitest";
import {
    seed,
    run,
    snapshotAll,
    absentId,
    ItemDraft,
    snapshot,
} from "../../../../fixtures/itemDraft/getItemDraftPageMetadata/databaseFixtures.js";
import { AppError } from "../../../../../src/errors.js";

const assertNotFound = async (pending: Promise<unknown>) => {
    await expect(pending).rejects.toBeInstanceOf(AppError);
    await expect(pending).rejects.toMatchObject({ code: "ITEM_DRAFT_NOT_FOUND", statusCode: 404 });
};

describe("getItemDraftPageMetadata 実DB取得・所有権・副作用なし", () => {
    it("D01 所有者のid/nameのみを返し、下書き・関連マスター・非対象行を変更しない", async () => {
        const f = await seed();
        const before = await snapshotAll(f);
        expect(await run(f)).toEqual({ id: f.draft.id, name: "下書きの商品名" });
        expect(await snapshotAll(f)).toEqual(before);
    });

    it.each([null, "", "  ", "名".repeat(255)])("D02 保存済みname %jを加工せず返す", async (name) => {
        const f = await seed();
        await f.sameOwnerDraft.update({ name });
        const before = await snapshotAll(f);
        expect(await run(f, f.sameOwnerDraft.id)).toEqual({ id: f.sameOwnerDraft.id, name });
        expect(await snapshotAll(f)).toEqual(before);
    });

    it.each(["他人", "不存在", "所有者null"] as const)("D03 %sは同じ404でDBを変更しない", async (kind) => {
        const f = await seed();
        const id = kind === "他人" ? f.otherDraft.id : kind === "所有者null" ? f.orphan.id : await absentId();
        const before = await snapshotAll(f);
        await assertNotFound(run(f, id));
        expect(await snapshotAll(f)).toEqual(before);
    });

    it("D04 逐次再取得は保存値を返しDBを変更しない", async () => {
        const f = await seed();
        const before = await snapshotAll(f);
        expect(await run(f)).toEqual({ id: f.draft.id, name: "下書きの商品名" });
        expect(await run(f)).toEqual({ id: f.draft.id, name: "下書きの商品名" });
        expect(await snapshotAll(f)).toEqual(before);
    });

    it("D04 別所有者・別対象の並行取得で結果を混同しない", async () => {
        const f = await seed();
        const before = await snapshotAll(f);
        // 読取の同時実行であり、更新との直列化やロック待機を保証しない。
        const results = await Promise.allSettled([run(f), run(f, f.otherDraft.id, f.other.id)]);
        expect(results).toEqual([
            { status: "fulfilled", value: { id: f.draft.id, name: "下書きの商品名" } },
            { status: "fulfilled", value: { id: f.otherDraft.id, name: "他人の商品" } },
        ]);
        expect(await snapshotAll(f)).toEqual(before);
    });

    it("D05 取得後に自作下書きを削除すると再取得は404", async () => {
        const f = await seed();
        expect(await run(f)).toEqual({ id: f.draft.id, name: "下書きの商品名" });
        await ItemDraft.destroy({ where: { id: f.draft.id } });
        const before = await snapshotAll(f);
        await assertNotFound(run(f));
        expect(await snapshot("item_draft", f.draft.id)).toBeNull();
        expect(await snapshotAll(f)).toEqual(before);
    });
});
