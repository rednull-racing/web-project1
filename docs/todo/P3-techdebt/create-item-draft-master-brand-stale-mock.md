# createItemDraftのmasterBrandテストの旧モック先を更新する

発見日: 2026-11-05。割引カラム削除作業中の関連回帰で発見。今回のカラム削除とは独立した既存テストのimport不整合。

## 問題と原因

- `server/` で `npm run test:run -- test/integration/usecases/itemDraft/createItemDraft/masterBrand.test.ts --reporter=verbose` を実行すると、テスト収集時に `DeliveryStatusOption.init` から `Cannot read properties of undefined (reading 'define')` で停止し、ケース本体は実行されない。
- `validateMaster.ts` は `services/todouhukenOption/todouhukenOption.js` をimportするが、当該テストは旧 `services/todouhuken/todouhuken.js` をモックしている。実service経由でModelが初期化され、transactionだけを持つDBモックと衝突する。両ファイルは今回変更していない。

## 修正方針・対象

- 対象: `server/test/integration/usecases/itemDraft/createItemDraft/masterBrand.test.ts`。
- 参照: `server/src/usecases/shared/validateMaster.ts`、`server/src/services/todouhukenOption/todouhukenOption.ts`、`server/test/docs/architecture/itemDraft/createItemDraft.md`、`server/test/docs/report/itemDraft/createItemDraft.md`。
- 現行import先でDB境界を遮断し、実helperを使用する既存の検証を維持する。他のモック漏れがないか確認してから対象テスト・lint・本番/テスト型検査を実施し、既存レポートへ記録する。
- 実envの追加読込みやDBガード緩和で通さない。未確認の後続失敗や本番仕様変更を推測で追加しない。
