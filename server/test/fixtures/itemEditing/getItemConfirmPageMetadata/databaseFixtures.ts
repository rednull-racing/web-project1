import "../getItemConfirmPage/databaseSetup.js";
import { beforeAll } from "vitest";
import { QueryTypes } from "sequelize";
import { seed, snapshot, ItemEditing } from "../getItemConfirmPage/databaseFixtures.js";
import { getItemConfirmPageMetadataUseCase } from "../../../../src/usecases/itemEditing/getItemConfirmPageMetadata.js";

// 共通基盤の全3接続ガード・スキーマ検査後、今回読むnameと状態列も照合してからseedする。
beforeAll(async () => {
    const connection = ItemEditing.sequelize;
    if (!connection) throw new Error("DB_TEST_STOP: ItemEditing connection missing");
    const [column] = await connection.query<{ data_type: string; character_maximum_length: number | null }>(
        `SELECT data_type, character_maximum_length FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'item_editing' AND column_name = 'name'`,
        { type: QueryTypes.SELECT },
    );
    if (column?.data_type !== "character varying" || column.character_maximum_length !== 255)
        throw new Error("DB_TEST_STOP: item_editing.name must be VARCHAR(255)");
    const labels = await connection.query<{ enumlabel: string }>(
        `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
         JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = current_schema() AND t.typname = (
             SELECT udt_name FROM information_schema.columns WHERE table_schema = current_schema()
             AND table_name = 'item_editing' AND column_name = 'status'
         ) ORDER BY e.enumsortorder`,
        { type: QueryTypes.SELECT },
    );
    if (JSON.stringify(labels.map((row) => row.enumlabel)) !== JSON.stringify(["normal", "edit"]))
        throw new Error("DB_TEST_STOP: item_editing.status enum differs");
});

export type Fixture = Awaited<ReturnType<typeof seed>>;
export const run = (f: Fixture, itemEditingId = f.editing.id, userId = f.owner.id) =>
    getItemConfirmPageMetadataUseCase({ itemEditingId, userId });

export { seed, snapshot, ItemEditing };
