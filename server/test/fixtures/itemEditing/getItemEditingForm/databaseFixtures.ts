import { ShopInfo } from "../../../../src/models/index.js";
import { registerFixtureModel } from "../getItemConfirmPage/databaseFixtures.js";

// User削除前にShopInfoを片付け、全接続のスキーマ検査とsnapshotにも含める。
registerFixtureModel(ShopInfo);
export { ShopInfo };
export { seed, snapshot, Categories, ItemEditing } from "../getItemConfirmPage/databaseFixtures.js";
