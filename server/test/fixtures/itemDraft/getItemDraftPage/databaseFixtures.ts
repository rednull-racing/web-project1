import "../../itemEditing/createItemEditingDraft/databaseSetup.js";
import { beforeAll, expect } from "vitest";
import { QueryTypes } from "sequelize";
import {
    seed as baseSeed,
    protectedRows as baseProtectedRows,
    observer,
    snapshot,
    ItemDraft,
} from "../../itemEditing/createItemEditingDraft/databaseFixtures.js";
import {
    Categories,
    Brands,
    ItemConditionOption,
    ShippingDayOption,
    ShippingServiceOption,
    TodouhukenOption,
} from "../../../../src/models/index.js";
import { getItemDraftPageUseCase } from "../../../../src/usecases/itemDraft/getItemDraftPage.js";

// 再利用基盤の全4接続ガード、下書き列/FK検査に加え、今回includeするマスターをseed前に確認する。
beforeAll(async () => {
    for (const model of [
        Categories,
        Brands,
        ItemConditionOption,
        ShippingDayOption,
        ShippingServiceOption,
        TodouhukenOption,
    ]) {
        const rows = await observer.query<{
            column_name: string;
            data_type: string;
            is_nullable: string;
            character_maximum_length: number | null;
        }>(
            `SELECT column_name, data_type, is_nullable, character_maximum_length
             FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=:table`,
            { replacements: { table: model.getTableName() }, type: QueryTypes.SELECT },
        );
        for (const [name, attribute] of Object.entries(model.getAttributes())) {
            const column = rows.find((row) => row.column_name === name);
            if (
                !column ||
                (attribute.allowNull === false && column.is_nullable !== "NO") ||
                (attribute.allowNull === true && column.is_nullable !== "YES")
            ) {
                throw new Error(`DB_TEST_STOP: related schema mismatch ${model.getTableName()}.${name}`);
            }
            const type = String(attribute.type);
            if (type === "INTEGER") expect(column.data_type).toBe("integer");
            const length = /^VARCHAR\((\d+)\)$/.exec(type);
            if (length) expect(column.character_maximum_length).toBe(Number(length[1]));
        }
    }
    const rows = await observer.query<{ target: string; delete_action: string; update_action: string }>(
        `SELECT target.relname AS target, c.confdeltype AS delete_action, c.confupdtype AS update_action
         FROM pg_constraint c JOIN pg_class source ON source.oid=c.conrelid
         JOIN pg_namespace n ON n.oid=source.relnamespace JOIN pg_class target ON target.oid=c.confrelid
         JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
         WHERE c.contype='f' AND source.relname='categories' AND a.attname='parent_id' AND n.nspname=current_schema()`,
        { type: QueryTypes.SELECT },
    );
    expect(rows).toEqual([{ target: "categories", delete_action: "c", update_action: "a" }]);
});

export const seed = async () => {
    const f = await baseSeed();
    const parent = await Categories.create({
        name: `${f.prefix}親`,
        path: `${f.prefix}/parent`,
        level: 0,
        layer: "middle",
    });
    await f.category.update({ parent_id: parent.id });
    const childA = await Categories.create({
        name: `${f.prefix}子A`,
        path: `${f.prefix}/a`,
        level: 2,
        parent_id: f.category.id,
        layer: "middle",
    });
    const childB = await Categories.create({
        name: `${f.prefix}子B`,
        path: `${f.prefix}/b`,
        level: 2,
        parent_id: f.category.id,
        layer: "middle",
    });
    const orphan = await ItemDraft.create({ seller_id: null });
    // Sequelize.createのtimestamps処理に依存せず、日時の公開契約を既知の保存値で検証する。
    await observer.query('UPDATE item_draft SET "updatedAt"=:time WHERE id=:id', {
        replacements: { time: new Date("2020-01-02T00:00:00Z"), id: f.draft.id },
    });
    return { ...f, parent, childA, childB, orphan };
};
export type Fixture = Awaited<ReturnType<typeof seed>>;
export const run = (f: Fixture, itemDraftId = f.draft.id, userId = f.owner.id) =>
    getItemDraftPageUseCase({ itemDraftId, userId });
export const snapshotAll = async (f: Fixture) => [
    await snapshot("item_draft", f.draft.id),
    ...(await baseProtectedRows(f)),
    await snapshot("item_draft", f.orphan.id),
    ...(await Promise.all([f.parent, f.childA, f.childB].map((row) => snapshot("categories", row.id)))),
];
export const absentId = async () => {
    for (let id = 2147483647; id > 2147483000; id--) if ((await snapshot("item_draft", id)) === null) return id;
    throw new Error("DB_TEST_STOP: no unused fixture id");
};
export { ItemDraft, snapshot };
