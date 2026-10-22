# createItemDraftのDBテストに残る削除済みitem_id期待値を整合する

発見日: 2026-10-22。優先度: P3-techdebt。

## 問題と原因

全Model NULL制約変更後の回帰で、createItemDraftのDBテスト148件中3件が失敗した。
AF-OWN01、D02、AF-OWN02がitem_draft.item_id:nullを期待するが、取得結果にはこの列がない。
item_idは20261020120909のmigrationで削除済み。今回のNULL制約migrationはitem_draftを変更していない。
その他145件と動画変換DBテスト13件は成功。

## 対象・参照

- server/test/integration/database/itemDraft/createItemDraft/database.test.ts（59行、130行、592行付近）
- server/test/fixtures/itemDraft/createItemDraft/databaseFixtures.ts
- server/src/models/item_draft.ts、対応する取得service・テスト設計書
- docs/todo/done/align-delete-item-draft-service-test-columns.md（別serviceテストの類似不一致）
- docs/log_memo/20261022-all-column-nullability.md

## 修正方針・実装内容

現行Model、削除migration、取得service、テスト設計を照合して現行契約を確定する。
削除済み列の期待値と不要なfixture入力を、契約に基づき修正する。
テストを通すために列を復活させたり無関係なAPIを変更しない。
.env.test由来test_dbのガードを確認して対象DBテスト、lint/typecheck、テスト型検査を実行する。

## 完了（2026-10-22）

削除済みitem_draft.item_idへの期待値・入力・取得列・FK依存を除去。本番コードに依存なし。対象264件および追加65件成功、lint・本番/テスト型検査・変更TS追加lint成功。詳細は `server/test/docs/report/itemDraft/createItemDraft.md`。対象外のsharedIdRoutesモック不足6件は別Todo `docs/todo/P3-techdebt/shared-id-routes-controller-mock-export.md` に記録。
