# item_editingへnullableなitem_idを追加し作成時にnullを指定する

発見日: 2026-10-23。優先度: P3-techdebt。

方針更新日: 2026-10-23。ユーザー指示により、item_idの検査を削除する従来案から、nullableなitem_idをモデル・DBへ追加する方針へ変更した。今回はTodoのみ更新し、以下の実装・DB反映・テストは未実施。

## 問題と原因

2026-10-23の実行時、server/で`npm run test:run -- test/integration/database/itemEditing/createItemEditingCopy --maxWorkers=1`を実行すると、databaseFixtures.ts:94の`columns.item_id.allowNull`でTypeErrorとなり94件が準備段階で未実行になった。確認時点のモデル・テストDBのitem_editingにはitem_idがなく、fixtureの前提と一致していない。

## 対象・修正方針

- server/src/models/item_editing.tsへitem_idをnullableで追加する。型・外部キー・関連定義は既存のitem_id設計と関連モデル・migrationを確認して決定し、不明な制約を独断で追加しない。
- server/migrationsへup/downを備えた新規ESM migrationを作成し、実DB・テストDBのitem_editingへnullableなitem_idを追加する。既存レコードのitem_idはnullとし、既存migrationは変更しない。実行は後続の実装依頼で許可された範囲に従う。
- server/src/services/itemEditing/command.tsの全作成service（createItemEditing、createItemEditingDraft、createItemEditingCopy）と各usecase・service引数型を確認し、作成dataのカラム指定へ`item_id: null`を明示する。新規・下書き・商品コピーのいずれでも元商品のIDを設定しない。
- server/test/fixtures/itemEditing/createItemEditingCopy/databaseFixtures.tsと利用側のdatabase.test.ts、databaseConcurrency.test.ts。
- server/test/docs/architecture/itemEditing/createItemEditingCopy.mdとreport側同名文書を参照。
- item_idの存在・nullableの検査を維持し、追加後のモデル・DBと整合させる。全作成経路のdata・保存結果がitem_id nullとなるよう、既存テスト・fixture・設計書・レポートを更新する。所有権・コピー・非対象行保持の検証を維持する。

## 実装時の注意・完了条件

.env.test由来test_dbと全接続ガードを維持し、自作ID限定cleanupとcloseを確認する。今回の方針で指定したモデル・DB・作成処理の変更に範囲を限定し、既存のstatus normal指定を維持する。全作成経路の単体・関連DBテストでitem_id nullを確認し、lint・本番/テスト型検査を実行する。DB反映結果とテスト結果・未確認範囲をレポートへ記録する。必要な実装・検証が完了するまでTodoをdoneへ移動しない。
