// 基盤の.env.test検査→全4接続ガード→スキーマ検査→ID追跡・cleanup・closeを引き継ぐ。
import "../getItemDraftPage/databaseFixtures.js";
import { seed, snapshotAll, absentId, ItemDraft, snapshot } from "../getItemDraftPage/databaseFixtures.js";
import { getItemDraftPageMetadataUseCase } from "../../../../src/usecases/itemDraft/getItemDraftPageMetadata.js";

export type Fixture = Awaited<ReturnType<typeof seed>>;

// schema/HTTPは別テストの保証範囲とし、実usecaseから所有者付きSQLを実行する。
export const run = (f: Fixture, itemDraftId = f.draft.id, userId = f.owner.id) =>
    getItemDraftPageMetadataUseCase({ itemDraftId, userId });

export { seed, snapshotAll, absentId, ItemDraft, snapshot };
