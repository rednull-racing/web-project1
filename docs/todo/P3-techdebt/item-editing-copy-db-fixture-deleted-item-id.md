# 商品コピーDBテストの削除済みitem_id依存を確認する

発見日: 2026-10-23。優先度: P3-techdebt。

## 問題と原因

server/で`npm run test:run -- test/integration/database/itemEditing/createItemEditingCopy --maxWorkers=1`を実行すると、databaseFixtures.ts:94の`columns.item_id.allowNull`でTypeErrorとなり94件が準備段階で未実行になる。現行モデル・テストDBのitem_editingにはitem_idがない。status追加とは独立した既存fixtureの問題で、今回は修正していない。

## 対象・修正方針

- server/test/fixtures/itemEditing/createItemEditingCopy/databaseFixtures.tsと利用側のdatabase.test.ts、databaseConcurrency.test.ts。
- server/test/docs/architecture/itemEditing/createItemEditingCopy.mdとreport側同名文書を参照。
- 現行モデル・反映済みDB・作成仕様と照合し、削除済みitem_id前提のスキーマ検査、seed、期待値を洗い出す。必要な所有権・コピー・非対象行保持の検証を維持して修正する。

## 実装時の注意・完了条件

.env.test由来test_dbと全接続ガードを維持し、自作ID限定cleanupとcloseを確認する。DBや本番コードをテスト都合で変更しない。関連DBテスト・lint・本番/テスト型検査を実行し、結果と未確認範囲をレポートへ記録する。
