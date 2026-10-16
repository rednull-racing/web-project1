import "../../../../usecases/itemEditing/createItemEditingDraft/databaseSetup.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseError, ValidationError } from "sequelize";
import * as query from "../../../../../src/services/itemDraft/query.js";
import * as editingCommand from "../../../../../src/services/itemEditing/command.js";
import * as draftCommand from "../../../../../src/services/itemDraft/command.js";
import {
    seed,
    run,
    snapshot,
    savedEditings,
    protectedRows,
    expectUnchanged,
    expectCopied,
    expectLockReleased,
    editingIds,
} from "../../../../usecases/itemEditing/createItemEditingDraft/databaseFixtures.js";
import type { DbFixture } from "../../../../usecases/itemEditing/createItemEditingDraft/databaseFixtures.js";
import { deferred, stringColumns, waitForGate } from "../../../../../src/usecases/itemEditing/test/createItemEditingDraft.fixtures.js";

let f: DbFixture;
beforeEach(async () => {
    f = await seed();
});
describe("P0: 実DBでの失敗・rollback・再試行", () => {
    it.each(["取得", "作成前", "実INSERT後", "削除前", "実DELETE後"] as const)(
        "E04 E05 E06 T03 T04 T06 T07 ST02 ST05 ST06: %sで失敗し部分保存を戻して再試行できる",
        async (step) => {
            const original = (await snapshot("item_draft", f.draft.id))!,
                protectedBefore = await protectedRows(f);
            const error = new Error(`injected ${step}`);
            const realGet = query.getMyItemDraft,
                realCreate = editingCommand.createItemEditingDraft,
                realDelete = draftCommand.deleteItemDraft;
            const remove = vi.spyOn(draftCommand, "deleteItemDraft");
            const create = vi.spyOn(editingCommand, "createItemEditingDraft");
            if (step === "取得") vi.spyOn(query, "getMyItemDraft").mockRejectedValue(error);
            if (step === "作成前" || step === "実INSERT後")
                create.mockImplementation(async (params) => {
                    if (step === "実INSERT後") {
                        const row = await realCreate(params);
                        expect(await snapshot("item_editing", row.id, params.transaction)).not.toBeNull();
                    }
                    throw error;
                });
            if (step === "削除前" || step === "実DELETE後")
                remove.mockImplementation(async (params) => {
                    expect(editingIds()).toHaveLength(2); // fixtureの既存編集＋実INSERT済み新規編集
                    if (step === "実DELETE後") {
                        await realDelete(params);
                        expect(await snapshot("item_draft", f.draft.id, params.transaction)).toBeNull();
                    }
                    throw error;
                });
            await expect(run(f)).rejects.toBe(error);
            if (step === "取得") expect(create).not.toHaveBeenCalled();
            if (step === "取得" || step === "作成前" || step === "実INSERT後") expect(remove).not.toHaveBeenCalled();
            await expectUnchanged(f, original, protectedBefore);
            for (const id of editingIds().filter((id) => id !== f.editing.id))
                expect(await snapshot("item_editing", id)).toBeNull();
            await expectLockReleased(f.draft.id);
            vi.restoreAllMocks();
            // 正常経路へ戻す。次回も同じ入力を使い、失敗回の採番値は巻き戻さない。
            expect(query.getMyItemDraft).toBe(realGet);
            const id = await run(f);
            expectCopied(await snapshot("item_editing", id), original, f.owner.id);
            expect(await savedEditings(f)).toHaveLength(1);
            expect(await snapshot("item_draft", f.draft.id)).toBeNull();
            expect(await protectedRows(f)).toEqual(protectedBefore);
        },
    );
    it("T05: INSERT/DELETE完了後のcommit前後を別接続から確認する", async () => {
        const original = (await snapshot("item_draft", f.draft.id))!;
        const entered = deferred<void>(),
            release = deferred<void>();
        const real = draftCommand.deleteItemDraft;
        vi.spyOn(draftCommand, "deleteItemDraft").mockImplementation(async (params) => {
            await real(params);
            expect(await snapshot("item_draft", f.draft.id, params.transaction)).toBeNull();
            const id = editingIds().find((id) => id !== f.editing.id)!;
            expectCopied(await snapshot("item_editing", id, params.transaction), original, f.owner.id);
            entered.resolve();
            await release.promise;
        });
        const pending = run(f),
            settled = Promise.allSettled([pending]);
        try {
            await waitForGate(entered.promise, pending);
            expect(await snapshot("item_draft", f.draft.id)).toEqual(original);
            expect(await savedEditings(f)).toEqual([]);
        } finally {
            release.resolve();
            await settled;
        }
        const id = await pending;
        expectCopied(await snapshot("item_editing", id), original, f.owner.id);
        expect(await snapshot("item_draft", f.draft.id)).toBeNull();
    });
});

describe("P1: 永続化済み下書きにはない境界外値を作成境界へ注入", () => {
    it.each(stringColumns)("E07: %sを256文字にしてSQL/モデル制約例外とrollbackを確認する", async (column) => {
        const original = (await snapshot("item_draft", f.draft.id))!,
            protectedBefore = await protectedRows(f);
        const real = editingCommand.createItemEditingDraft;
        vi.spyOn(editingCommand, "createItemEditingDraft").mockImplementation((params) =>
            real({ ...params, data: { ...params.data, [column]: "あ".repeat(256) } }),
        );
        const remove = vi.spyOn(draftCommand, "deleteItemDraft");
        const pending = run(f);
        await expect(pending).rejects.toBeInstanceOf(DatabaseError);
        await expect(pending).rejects.toMatchObject({ original: { code: "22001" } });
        expect(remove).not.toHaveBeenCalled();
        await expectUnchanged(f, original, protectedBefore);
    });
    it("E08: 画像11件は編集モデルvalidationで拒否し下書き・DBを保持する", async () => {
        const original = (await snapshot("item_draft", f.draft.id))!,
            protectedBefore = await protectedRows(f);
        const real = editingCommand.createItemEditingDraft;
        vi.spyOn(editingCommand, "createItemEditingDraft").mockImplementation((params) =>
            real({
                ...params,
                data: { ...params.data, image_url: Array.from({ length: 11 }, (_, i) => `https://media.test/${i}`) },
            }),
        );
        const remove = vi.spyOn(draftCommand, "deleteItemDraft");
        const pending = run(f);
        await expect(pending).rejects.toBeInstanceOf(ValidationError);
        await expect(pending).rejects.toMatchObject({
            errors: [expect.objectContaining({ path: "image_url", message: "画像は最大10枚までです。" })],
        });
        expect(remove).not.toHaveBeenCalled();
        await expectUnchanged(f, original, protectedBefore);
    });
});
