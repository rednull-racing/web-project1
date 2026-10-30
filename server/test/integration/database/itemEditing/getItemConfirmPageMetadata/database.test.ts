import { describe, expect, it } from "vitest";
import { seed, snapshot, run, ItemEditing } from "../../../../fixtures/itemEditing/getItemConfirmPageMetadata/databaseFixtures.js";
import { AppError } from "../../../../../src/errors.js";

const assertNotFound = async (pending: Promise<unknown>) => {
    await expect(pending).rejects.toBeInstanceOf(AppError);
    await expect(pending).rejects.toMatchObject({ code: "ITEM_EDITING_NOT_FOUND", statusCode: 404 });
};

describe("P0/P2 getItemConfirmPageMetadata 実DB・所有者限定・参照不変", () => {
    it.each(["normal", "edit"] as const)("D01 status=%sのid/nameだけを返し非対象行・関連を変更しない", async (status) => {
        const f = await seed();
        const target = status === "normal" ? f.editing : f.empty;
        const name = status === "normal" ? "確認商品" : null;
        const before = await snapshot();
        expect(await run(f, target.id)).toEqual({ id: target.id, name });
        expect(await snapshot()).toEqual(before);
    });

    it.each([null, "", "  ", "名".repeat(255)])("D02 name=%jを保存値のまま保持する", async (name) => {
        const f = await seed();
        await f.empty.update({ name });
        const before = await snapshot();
        expect(await run(f, f.empty.id)).toEqual({ id: f.empty.id, name });
        expect(await snapshot()).toEqual(before);
    });

    it.each(["他人", "不存在", "所有者null"] as const)("D03 %sを同じ404とし全自作行を変更しない", async (kind) => {
        const f = await seed();
        const id = kind === "他人" ? f.otherEditing.id : kind === "所有者null" ? f.ownerless.id : f.missingId;
        const before = await snapshot();
        await assertNotFound(run(f, id));
        expect(await snapshot()).toEqual(before);
    });

    it("D04 逐次再取得で同じ保存値を返し非対象行を変更しない", async () => {
        const f = await seed();
        const before = await snapshot();
        expect(await run(f)).toEqual({ id: f.editing.id, name: "確認商品" });
        expect(await run(f)).toEqual({ id: f.editing.id, name: "確認商品" });
        expect(await snapshot()).toEqual(before);
    });

    it("D04 別対象・別所有者を並行取得しても結果が混ざらず全自作行不変", async () => {
        const f = await seed();
        const before = await snapshot();
        // 読取の並行実行を確認し、更新との直列化や行ロックを保証しない。
        const results = await Promise.allSettled([
            run(f), run(f, f.empty.id), run(f, f.otherEditing.id, f.other.id),
        ]);
        expect(results).toEqual([
            { status: "fulfilled", value: { id: f.editing.id, name: "確認商品" } },
            { status: "fulfilled", value: { id: f.empty.id, name: null } },
            { status: "fulfilled", value: { id: f.otherEditing.id, name: "別所有者" } },
        ]);
        expect(await snapshot()).toEqual(before);
    });

    it("D05 取得後に自作対象を明示削除すると再取得404で他行は不変", async () => {
        const f = await seed();
        expect(await run(f)).toEqual({ id: f.editing.id, name: "確認商品" });
        await ItemEditing.destroy({ where: { id: f.editing.id } });
        const before = await snapshot();
        await assertNotFound(run(f));
        expect(await ItemEditing.findByPk(f.editing.id)).toBeNull();
        expect(await snapshot()).toEqual(before);
    });
});
