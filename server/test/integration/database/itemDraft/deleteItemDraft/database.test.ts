import "../../../../fixtures/itemDraft/deleteItemDraft/databaseSetup.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { seed, run, snapshot, protectedRows, savedEditings, absentId, expectNoExternal } from "../../../../fixtures/itemDraft/deleteItemDraft/databaseFixtures.js";
import type { DbFixture } from "../../../../fixtures/itemDraft/deleteItemDraft/databaseFixtures.js";
import { expectNotFound } from "../../../../fixtures/itemDraft/deleteItemDraft/fixtures.js";
import { nullableData } from "../../../../../src/usecases/itemEditing/test/createItemEditingDraft.fixtures.js";
import * as command from "../../../../../src/services/itemDraft/command.js";
let f: DbFixture;
beforeEach(async () => { f = await seed(); });
describe("P0/P1: 実DBの下書き削除・所有権・非対象行", () => {
    it("D01 D05 D08: 同じitemとURLの別下書きを保持し1行だけ物理削除、再送404", async () => {
        const before = await protectedRows(f), remove = vi.spyOn(command, "deleteItemDraft");
        expect(await run(f)).toBeUndefined();
        expect(await snapshot("item_draft", f.draft.id)).toBeNull();
        expect(await protectedRows(f)).toEqual(before); expect(await savedEditings(f)).toEqual([]); expectNoExternal();
        expect(remove).toHaveBeenCalledOnce();
        await expectNotFound(run(f)); expect(remove).toHaveBeenCalledOnce(); expect(await protectedRows(f)).toEqual(before);
    });
    it.each(["不存在", "他人", "管理者", "所有者未設定A", "所有者未設定B"])("D02 D03 D04: %sは404で削除しない", async mode => {
        const before = await snapshot("item_draft", f.draft.id), protectedBefore = await protectedRows(f);
        const itemDraftId = mode === "不存在" ? await absentId() : mode.startsWith("所有者未設定") ? f.orphan.id : f.draft.id;
        const userId = mode === "他人" || mode === "所有者未設定B" ? f.other.id : mode === "管理者" ? f.admin.id : f.owner.id;
        const remove = vi.spyOn(command, "deleteItemDraft");
        await expectNotFound(run(f, itemDraftId, userId)); expect(remove).not.toHaveBeenCalled();
        expect(await snapshot("item_draft", f.draft.id)).toEqual(before); expect(await protectedRows(f)).toEqual(protectedBefore); expectNoExternal();
    });
    it.each([
        { label: "item_id=null", data: { item_id: null } },
        { label: "全nullable列null", data: { ...nullableData, attributes: {} } },
        { label: "attributes空", data: { attributes: {} } },
        { label: "画像空配列", data: { image_url: [] } },
    ])("D06: $labelでも所有者は削除できる", async ({ data }) => {
        await f.draft.update(data); const before = await protectedRows(f);
        await run(f); expect(await snapshot("item_draft", f.draft.id)).toBeNull();
        expect(await protectedRows(f)).toEqual(before); expectNoExternal();
    });
    it.each([null, "pending", "failed"].flatMap(video_status => [true, false].map(sale_flag => ({ video_status, sale_flag }))))(
        "D07: video_status=$video_status/sale_flag=$sale_flagを条件にしない", async values => {
            await f.draft.update(values); const before = await protectedRows(f); await run(f);
            expect(await snapshot("item_draft", f.draft.id)).toBeNull(); expect(await protectedRows(f)).toEqual(before);
        },
    );
});
