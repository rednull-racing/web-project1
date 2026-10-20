# item.uploaded_atのモデルとDBのNULL制約を照合する（解消済み）

## 2026-10-20 対応完了

- ユーザーがModelどおりNOT NULLとする方針と、既存NULL行のcreatedAt補完を指定。
- 新規migration `20261020150923-enforce-item-uploaded-at-not-null.js` をneondb/test_dbへ適用し、NOT NULL・NULL0件・適用履歴を確認。
- 実DBのID13・27は各createdAtと一致。F4を含むDB6ファイル266件すべて成功。
- 以下は初回調査時の記録。現行の未確定事項・未修正問題ではない。

## 初回調査

- 優先度: P1-bug
- 対象: `server/src/models/item.ts`、反映済みDBの`item.uploaded_at`、必要と判断された場合の新規migration。
- 問題: createItemのF2解消後の実DBテストで、モデルの`allowNull: false`に対しtest_dbは`is_nullable=YES`だった。Model validationを無効化してuploaded_at=nullを作成serviceへ注入すると公開処理は成功する。通常の公開usecaseは日時を設定するため、この観測だけで通常APIがnullを保存すると断定しない。
- 原因: モデルと実DBの制約が異なる。どちらの制約が意図した反映済み仕様かは未確定。
- 修正方針: まず正規の反映済みDB・スキーマ定義・詳細設計を照合し、公開日時をDBでも必須にするかを確認する。DB反映後にモデルを独断で正として扱わない。
- 実装内容: DB必須が確定した場合は既存NULL行の扱いを決め、新規migrationでNOT NULLを反映する。nullableが正しい場合はモデル・詳細設計・テスト契約を整合させる。既存migrationは書き換えない。
- 注意: 過去商品の公開日時へ一律に現在時刻を補完しない。実DBの制約とデータを確認せず本番へ適用しない。
- 検証: `server/test/integration/usecases/items/createItem/databaseTransactions.test.ts`のF4とD08を再実行し、Model validation・実FK・実NOT NULLの拒否とrollbackを区別する。経緯は`server/test/docs/report/items/createItem.md`のF2再検証記録を参照。
