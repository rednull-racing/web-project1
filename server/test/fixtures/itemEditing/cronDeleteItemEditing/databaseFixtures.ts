import { assertEnvironment } from "./databaseSetup.js";
import { QueryTypes, Op } from "sequelize";
import type { Model, ModelStatic, Transaction } from "sequelize";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import db, { ItemEditing, ItemDraft, Item } from "../../../../src/models/index.js";
import sequelize from "../../../../src/db.js";
import * as command from "../../../../src/services/itemEditing/command.js";
import { cronDeleteItemEditingUseCase } from "../../../../src/usecases/itemEditing/cronDeleteItemEditing.js";

export { sequelize, ItemEditing, ItemDraft, Item, command };
export const now = new Date("1900-01-04T03:00:00Z");
export const cutoff = new Date("1900-01-01T03:00:00Z");
const connections = [...new Set([sequelize, db.sequelize])];
const models: ModelStatic<Model>[] = [ItemEditing, ItemDraft, Item];
const created = new Map<ModelStatic<Model>, number[]>(models.map((model) => [model, []]));
let safe = false;

beforeAll(async () => {
    assertEnvironment();
    for (const connection of connections) {
        if (connection.getDatabaseName() !== "test_db") throw new Error("DB_TEST_STOP: configured database");
        const [row] = await connection.query<{ name: string }>("SELECT current_database() AS name", {
            type: QueryTypes.SELECT,
        });
        if (row.name !== "test_db") throw new Error("DB_TEST_STOP: actual database");
    }
    for (const model of models) {
        const columns = await sequelize.getQueryInterface().describeTable(model.getTableName());
        for (const [name, attribute] of Object.entries(model.getAttributes())) {
            const column = columns[attribute.field ?? name];
            if (!column || column.allowNull !== (attribute.allowNull ?? true)) {
                throw new Error(`DB_TEST_STOP: schema mismatch ${model.tableName}.${name}`);
            }
        }
    }
    const columns = await sequelize.getQueryInterface().describeTable("item_editing");
    if (!columns.id.primaryKey || !columns.createdAt.type.startsWith("TIMESTAMP")) {
        throw new Error("DB_TEST_STOP: id/createdAt schema mismatch");
    }
    const inbound = await sequelize.query<{ name: string }>(
        "SELECT conname AS name FROM pg_constraint WHERE contype='f' AND confrelid='item_editing'::regclass",
        { type: QueryTypes.SELECT },
    );
    if (inbound.length) throw new Error("DB_TEST_STOP: unexpected incoming foreign key to item_editing");
    // 他のテストの古い編集行があれば、削除テストを開始しない。
    if (await ItemEditing.count({ where: { createdAt: { [Op.lte]: cutoff } } })) {
        throw new Error("DB_TEST_STOP: preexisting expired rows; no writes performed");
    }
    safe = true;
    for (const model of models) {
        model.addHook("afterCreate", "cronDeleteTrack", (row) => {
            created.get(model)!.push(Number(row.get("id")));
        });
    }
});
beforeEach(() => {
    assertEnvironment();
    vi.spyOn(Date, "now").mockReturnValue(now.getTime());
    for (const ids of created.values()) ids.length = 0;
});
afterEach(async () => {
    vi.restoreAllMocks();
    if (!safe) return;
    assertEnvironment();
    for (const model of models) {
        const ids = created.get(model)!;
        if (ids.length) {
            await model.destroy({ where: { id: ids } });
            expect(await model.count({ where: { id: ids } })).toBe(0);
        }
    }
});
afterAll(async () => {
    for (const model of models) model.removeHook("afterCreate", "cronDeleteTrack");
    const closed = await Promise.allSettled(connections.map((connection) => connection.close()));
    vi.unstubAllEnvs();
    expect(closed.every((result) => result.status === "fulfilled")).toBe(true);
});

export const seed = async () => {
    if (!safe) throw new Error("DB_TEST_STOP: not verified");
    return [
        await ItemEditing.create({ name: "期限直前", createdAt: new Date("1900-01-01T02:59:59.999Z"), updatedAt: now }),
        await ItemEditing.create({
            name: "期限一致",
            createdAt: cutoff,
            updatedAt: now,
            video_status: "pending",
            sale_flag: true,
        }),
        await ItemEditing.create({ name: "期限直後", createdAt: new Date("1900-01-01T03:00:00.001Z"), updatedAt: now }),
        await ItemEditing.create({ name: "未来", createdAt: new Date("1900-01-05T03:00:00Z"), updatedAt: now }),
    ];
};
export const snapshot = (ids: number[], transaction?: Transaction) =>
    ItemEditing.findAll({ where: { id: ids }, order: [["id", "ASC"]], raw: true, transaction });

export const run = async () => {
    assertEnvironment();
    if (!safe) throw new Error("DB_TEST_STOP: not verified");
    // 毎回、期限対象を自作IDへ限定できているか検査してから実usecaseを動かす。
    const candidates = await ItemEditing.findAll({ where: { createdAt: { [Op.lte]: cutoff } }, attributes: ["id"] });
    if (candidates.some((row) => !created.get(ItemEditing)!.includes(row.id))) {
        throw new Error("DB_TEST_STOP: unowned expired row");
    }
    return cronDeleteItemEditingUseCase();
};

export const waitForBlocked = async (blocker: number) => {
    const deadline = performance.now() + 5000;
    while (performance.now() < deadline) {
        const rows = await sequelize.query<{ pid: number }>(
            "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND CAST($blocker AS integer) = ANY(pg_blocking_pids(pid)) AND query LIKE 'DELETE FROM%item_editing%'",
            { bind: { blocker }, type: QueryTypes.SELECT },
        );
        if (rows.length) return rows[0].pid;
        await new Promise((resolve) => setTimeout(resolve, 15));
    }
    throw new Error("DELETE lock wait not observed");
};
