import "../../../../fixtures/items/createItem/databaseSetup.js";
import { QueryTypes } from "sequelize";
import sequelize from "../../../../../src/db.js";
import { describe, expect, it, vi } from "vitest";
import { seed, run, snapshot, assertProtected, assertRolledBack, assertPublishedRelations, notification, observer, Item, Video, Sale, ItemShippingProfile, ids } from "../../../../fixtures/items/createItem/databaseFixtures.js";
import { boundary, deferred } from "../../../../fixtures/items/createItem/fixtures.js";
import * as command from "../../../../../src/services/itemEditing/command.js";
describe("D/T 実commit・rollback・可視性", () => {
    it("D02 T01: 実削除後commit前は別接続に旧行のみ、commit後に反転", async () => {
        const f = await seed();
        const before = await snapshot("item_editing", f.editing.id);
        const entered = deferred<void>(), gate = deferred<void>();
        const original = command.deleteItemEditing;
        vi.spyOn(command, "deleteItemEditing").mockImplementation(async (args) => { await original(args); expect(await snapshot("item_editing", f.editing.id, args.transaction)).toBeNull(); for (const [model, table] of [[Item, "item"], [Video, "video"], [Sale, "sale"], [ItemShippingProfile, "item_shipping_profile"]] as const) expect(await snapshot(table, ids(model).at(-1)!, args.transaction)).not.toBeNull(); entered.resolve(); await gate.promise; });
        const pending = run(f);
        try {
            await boundary(entered.promise, pending);
            expect(await snapshot("item_editing", f.editing.id)).toEqual(before);
            for (const [model, table] of [[Item, "item"], [Video, "video"], [Sale, "sale"], [ItemShippingProfile, "item_shipping_profile"]] as const)
                expect(await snapshot(table, ids(model).at(-1)!)).toBeNull();
            expect(notification).not.toHaveBeenCalled();
        }
        finally {
            gate.resolve();
            await pending;
        }
        expect(await snapshot("item_editing", f.editing.id)).toBeNull();
        await assertProtected(f);
    });
    it.each(["video", "sale", "shipping", "item", "before-delete", "after-delete", "before-commit"])("T06 T07 T09 D03 D04: %s障害で全rollback後同ID再試行", async (stage) => {
        const f = await seed();
        const before = await snapshot("item_editing", f.editing.id);
        const failure = new Error("injected createItem failure");
        if (["video", "sale", "shipping", "item"].includes(stage))
            vi.spyOn(({ video: Video, sale: Sale, shipping: ItemShippingProfile, item: Item }[stage])!, "create").mockRejectedValueOnce(failure);
        else if (stage === "before-delete")
            vi.spyOn(command, "deleteItemEditing").mockRejectedValueOnce(failure);
        else if (stage === "after-delete") {
            const original = command.deleteItemEditing;
            vi.spyOn(command, "deleteItemEditing").mockImplementationOnce(async (args) => { await original(args); throw failure; });
        }
        else {
            const original = sequelize.transaction.bind(sequelize);
            vi.spyOn(sequelize, "transaction").mockImplementationOnce(((callback: (t: import("sequelize").Transaction) => Promise<unknown>) => original(async (t) => { await callback(t); throw failure; })) as typeof sequelize.transaction);
        }
        await expect(run(f)).rejects.toBe(failure);
        await assertRolledBack(f, before);
        vi.restoreAllMocks();
        expect(await run(f)).toBeTypeOf("number");
        expect(notification).toHaveBeenCalledTimes(1);
    });
    it.each(["model", "foreign-key"])("D08: %s制約を実行しrollback", async (mode) => { const f = await seed(); const before = await snapshot("item_editing", f.editing.id); const original = Item.create.bind(Item); vi.spyOn(Item, "create").mockImplementationOnce((data, options) => original({ ...data, ...(mode === "model" ? { uploaded_at: null } : { brand_id: 2147483647 }) }, options)); await expect(run(f)).rejects.toMatchObject({ name: mode === "model" ? "SequelizeValidationError" : "SequelizeForeignKeyConstraintError" }); await assertRolledBack(f, before); });
    it("T12: 通知失敗でもcommit済み4行は維持", async () => { const f = await seed(); vi.spyOn(console, "error").mockImplementation(() => { }); notification.mockRejectedValue(new Error("notification")); const id = await run(f); await assertPublishedRelations(id); expect(await snapshot("item_editing", f.editing.id)).toBeNull(); await assertProtected(f); });
});

it("F4: uploaded_atのModel必須制約と実DBの不一致を検出", async () => {
    const f = await seed(); const before = await snapshot("item_editing", f.editing.id);
    const [column] = await observer.query<{ is_nullable: string }>("SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='item' AND column_name='uploaded_at'", { type: QueryTypes.SELECT });
    expect.soft(column.is_nullable, "ModelでallowNull:falseのitem.uploaded_atは実DBもNOT NULLである").toBe("NO");
    const original = Item.create.bind(Item);
    vi.spyOn(Item, "create").mockImplementationOnce((data, options) => original({ ...data, uploaded_at: null }, { ...options, validate: false }));
    await expect(run(f)).rejects.toMatchObject({ name: "SequelizeDatabaseError", parent: { code: "23502" } });
    await assertRolledBack(f, before);
});
it("T12: 通知未完了でも4行commitと公開成功を維持", async () => {
    const f = await seed(); const gate = deferred<void>(); notification.mockReturnValue(gate.promise);
    try { const id = await run(f); await assertPublishedRelations(id); expect(await snapshot("item_editing", f.editing.id)).toBeNull(); await assertProtected(f); }
    finally { gate.resolve(); await gate.promise; }
});

it("D08: 実在するgender_typeのDB NOT NULL制約で全rollback", async () => {
    const f = await seed(); const before = await snapshot("item_editing", f.editing.id);
    const [column] = await observer.query<{ is_nullable: string }>("SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='item' AND column_name='gender_type'", { type: QueryTypes.SELECT });
    expect(column.is_nullable).toBe("NO");
    const original = Item.create.bind(Item);
    vi.spyOn(Item, "create").mockImplementationOnce((data, options) => original({ ...data, gender_type: null }, { ...options, validate: false }));
    await expect(run(f)).rejects.toMatchObject({ name: "SequelizeDatabaseError", parent: { code: "23502" } });
    await assertRolledBack(f, before);
});
