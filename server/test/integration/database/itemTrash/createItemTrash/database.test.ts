import { describe, expect, it } from "vitest";
import { QueryTypes } from "sequelize";
import type { Transaction } from "sequelize";
import { AppError } from "../../../../../src/errors.js";
import {
    Item,
    ItemTrash,
    sequelize,
    seed,
    run,
    snapshot,
    trashRows,
    protectedSnapshot,
    sourceSnapshot,
    seedDependents,
    notification,
} from "../../../../fixtures/itemTrash/createItemTrash/databaseFixtures.js";

const expectNotFound = async (pending: Promise<unknown>) => {
    await expect(pending).rejects.toBeInstanceOf(AppError);
    await expect(pending).rejects.toMatchObject({ code: "ITEM_NOT_FOUND", statusCode: 404 });
};

describe("createItemTrash 実DBの退避・削除・保持", () => {
    it.each(["active", "soldout"] as const)("DB-01 status=%sの全列退避と元商品・関連削除", async (status) => {
        const f = await seed();
        await f.item.update({ status });
        const protectedBefore = await protectedSnapshot(f);
        await run(f);
        const [row] = await trashRows(f);
        expect(row).toBeDefined();
        const { id, createdAt, updatedAt, ...data } = row;
        expect(data).toEqual({
            item_id: f.item.id,
            name: f.item.name,
            detail: f.item.detail,
            image_url: f.item.image_url,
            first_image_url: f.item.first_image_url,
            price: 10000,
            item_condition_id: f.condition.id,
            seller_id: f.owner.id,
            gender_type: f.item.gender_type,
            age_type: f.item.age_type,
            recommend: f.item.recommend,
            category_id: f.category.id,
            brand_id: f.brand.id,
            brand_aliases_id: f.alias.id,
            attributes: f.item.attributes,
            title: f.video.title,
            summary: f.video.summary,
            thumbnail_url: f.video.thumbnail_url,
            duration: f.video.duration,
            original_url: f.video.original_url,
            converted_url: f.video.converted_url,
            video_status: f.video.status,
            shipping_day_id: f.day.id,
            shipping_service_id: f.service.id,
            shipping_place_id: f.place.id,
            shipping_service_free_text: "配送備考",
        });
        expect(id).toEqual(expect.any(Number));
        expect(createdAt).toBeInstanceOf(Date);
        expect(updatedAt).toBeInstanceOf(Date);
        expect((createdAt as Date).getTime()).toBeGreaterThan(new Date("2020-01-01T00:00:00Z").getTime());
        for (const [table, sourceId] of [
            ["item", f.item.id],
            ["video", f.video.id],
            ["sale", f.sale.id],
            ["item_shipping_profile", f.shipping.id],
        ] as const) {
            expect(await snapshot(table, sourceId)).toBeNull();
        }
        expect(await protectedSnapshot(f)).toEqual(protectedBefore);
        expect((await snapshot("item_editing", f.existing.id))?.item_id).toBeNull();
        expect(notification).toHaveBeenCalledTimes(1);
        expect(notification).toHaveBeenCalledWith({
            data: {
                read_user_id: f.owner.id,
                url: `/item/deleted/${id}`,
                message_image: f.item.first_image_url,
                message: `商品「${f.item.name}」が削除されました。削除された商品の詳細はこちらのページからご確認ください。なお、復元される場合は削除日から30日以内に行ってください。`,
                type: "ITEM",
            },
        });
    });

    it.each([
        [
            "video_id",
            ["title", "summary", "thumbnail_url", "duration", "original_url", "converted_url", "video_status"],
        ],
        ["sale_id", ["price"]],
        ["shipping_id", ["shipping_day_id", "shipping_service_id", "shipping_place_id", "shipping_service_free_text"]],
    ] as const)("DB-02 %sの関連欠落は対応する保存項目をNULLにする", async (column, fields) => {
        const f = await seed();
        await f.item.update({ [column]: null });
        const before = await protectedSnapshot(f);
        await run(f);
        const [row] = await trashRows(f);
        for (const field of fields) expect(row[field]).toBeNull();
        expect(await snapshot("item", f.item.id)).toBeNull();
        expect(await protectedSnapshot(f)).toEqual(before);
    });

    it.each([null, 0, 24000])("DB-03 before_price=%sをItem.priceにフォールバックせず保存する", async (price) => {
        const f = await seed();
        await f.sale.update({ before_price: price });
        await f.item.update({ price: 999 });
        await run(f);
        expect((await trashRows(f))[0].price).toBe(price);
    });

    it("DB-04 他人による削除は404、DB・通知を変更しない", async () => {
        const f = await seed();
        const before = await sourceSnapshot(f);
        const protectedBefore = await protectedSnapshot(f);
        await expectNotFound(run(f, f.item.id, f.other.id));
        expect(await sourceSnapshot(f)).toEqual(before);
        expect(await protectedSnapshot(f)).toEqual(protectedBefore);
        expect(await trashRows(f)).toEqual([]);
        expect(notification).not.toHaveBeenCalled();
    });

    it("DB-05 不存在と削除後の再送は404、退避の重複と通知の重複はない", async () => {
        const f = await seed();
        const absent = await Item.create({ seller_id: f.owner.id, uploaded_at: new Date() });
        await absent.destroy();
        await expectNotFound(run(f, absent.id));
        expect(await trashRows(f)).toEqual([]);
        await run(f);
        const saved = await trashRows(f);
        await expectNotFound(run(f));
        expect(await trashRows(f)).toEqual(saved);
        expect(notification).toHaveBeenCalledTimes(1);
    });

    it("DB-06 注文・購入セッション・編集・通報は商品参照のみNULLにして保持する", async () => {
        const f = await seed();
        const d = await seedDependents(f);
        const sources = [
            ["orders", d.order.id],
            ["purchase_session", d.session.id],
            ["item_editing", f.existing.id],
            ["item_report", d.report.id],
        ] as const;
        const before = await Promise.all(sources.map(([table, id]) => snapshot(table, id)));
        const otherReport = await snapshot("item_report", d.otherReport.id);
        await run(f);
        for (const [index, [table, id]] of sources.entries()) {
            const row = await snapshot(table, id);
            expect(row).not.toBeNull();
            const { item_id, updatedAt, ...rest } = row!;
            const { item_id: oldItemId, updatedAt: oldUpdatedAt, ...original } = before[index]!;
            expect(item_id).toBeNull();
            expect(oldItemId).toBe(f.item.id);
            expect(rest).toEqual(original);
            if (table !== "item_report") expect(updatedAt).toEqual(oldUpdatedAt);
        }
        expect(await snapshot("item_report", d.otherReport.id)).toEqual(otherReport);
        expect((await trashRows(f))[0].item_id).toBe(f.item.id);
    });

    it("DB-07 最後のItem削除直前の実SQL失敗で先行書込みをrollbackし、再試行できる", async () => {
        const f = await seed();
        const d = await seedDependents(f);
        const before = await sourceSnapshot(f);
        const dependentBefore = await Promise.all([
            snapshot("orders", d.order.id),
            snapshot("purchase_session", d.session.id),
            snapshot("item_report", d.report.id),
        ]);
        let reached = false;
        Item.addHook(
            "beforeDestroy",
            "trashSqlFailure",
            async (row: InstanceType<typeof Item>, options: { transaction?: Transaction | null }) => {
                if (row.id !== f.item.id) return;
                expect(options.transaction).toBeDefined();
                const [count] = await sequelize.query<{ count: number }>(
                    "SELECT count(*)::int AS count FROM item_trash WHERE item_id=:id",
                    { replacements: { id: f.item.id }, transaction: options.transaction, type: QueryTypes.SELECT },
                );
                expect(count.count).toBe(1);
                reached = true;
                await sequelize.query("SELECT 1 / 0", { transaction: options.transaction });
            },
        );
        try {
            await expect(run(f)).rejects.toMatchObject({ original: { code: "22012" } });
        } finally {
            Item.removeHook("beforeDestroy", "trashSqlFailure");
        }
        expect(reached).toBe(true);
        expect(await sourceSnapshot(f)).toEqual(before);
        expect(
            await Promise.all([
                snapshot("orders", d.order.id),
                snapshot("purchase_session", d.session.id),
                snapshot("item_report", d.report.id),
            ]),
        ).toEqual(dependentBefore);
        expect(await trashRows(f)).toEqual([]);
        expect(notification).not.toHaveBeenCalled();
        await run(f);
        expect(await trashRows(f)).toHaveLength(1);
    });

    it("DB-08 通報FKのNO ACTIONは直接の商品削除を拒否し、APIによる明示NULL更新は成功する", async () => {
        const f = await seed();
        const d = await seedDependents(f);
        await expect(f.item.destroy()).rejects.toMatchObject({ original: { code: "23503" } });
        expect((await snapshot("item_report", d.report.id))?.item_id).toBe(f.item.id);
        expect(await snapshot("item", f.item.id)).not.toBeNull();
        await run(f);
        expect((await snapshot("item_report", d.report.id))?.item_id).toBeNull();
        expect(await ItemTrash.count({ where: { item_id: f.item.id } })).toBe(1);
    });
});
