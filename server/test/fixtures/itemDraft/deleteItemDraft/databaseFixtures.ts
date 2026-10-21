import "./databaseSetup.js";
import { beforeEach, expect } from "vitest";
import {
    seed as baseSeed,
    protectedRows as baseProtected,
    ItemDraft,
    User,
    snapshot,
} from "../../itemEditing/createItemEditingDraft/databaseFixtures.js";
import { deleteItemDraftUseCase } from "../../../../src/usecases/itemDraft/deleteItemDraft.js";
import { external } from "./databaseSetup.js";

// 同じテーブル・FKを使う既存基盤の全接続ガード、スキーマ検査、ID追跡・cleanupを再利用する。
export {
    sequelize,
    observer,
    competitor,
    snapshot,
    savedEditings,
    editingIds,
    expectCopied,
    ItemDraft,
    ItemEditing,
    expectLockReleased,
} from "../../itemEditing/createItemEditingDraft/databaseFixtures.js";
export { external } from "./databaseSetup.js";
beforeEach(() => {
    external.send.mockClear();
    external.remove.mockClear();
    external.upload.mockClear();
});
export const seed = async () => {
    const f = await baseSeed();
    const admin = await User.create({ email: `${f.prefix}admin@example.test`, password: "unused-test-value" });
    const orphan = await ItemDraft.create({ seller_id: null, name: "所有者未設定" });
    const sharedDraft = await ItemDraft.create({ ...f.values, name: "同じ商品とURLを参照" });
    return { ...f, admin, orphan, sharedDraft };
};
export type DbFixture = Awaited<ReturnType<typeof seed>>;
export const run = (f: DbFixture, itemDraftId = f.draft.id, userId = f.owner.id) =>
    deleteItemDraftUseCase({ itemDraftId, userId });
export const protectedRows = async (f: DbFixture, excluded: readonly number[] = []) => [
    ...(await baseProtected(f, excluded)),
    ...(await Promise.all(
        [f.orphan, f.sharedDraft]
            .filter((row) => !excluded.includes(row.id))
            .map((row) => snapshot("item_draft", row.id)),
    )),
    await snapshot("user", f.admin.id),
];
export const expectNoExternal = () => {
    expect(external.send).not.toHaveBeenCalled();
    expect(external.remove).not.toHaveBeenCalled();
    expect(external.upload).not.toHaveBeenCalled();
};
export const absentId = async () => {
    // 既存行を消して不存在を作らず、事前SELECTで範囲内の空きを確認する。
    for (let id = 2147483647; id > 2147483000; id--) if ((await snapshot("item_draft", id)) === null) return id;
    throw new Error("fixture用の不存在IDを確認できませんでした");
};
