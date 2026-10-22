# createItemDraftの既存テストで対象外deleteItemDraftUseCaseをモックする

完了（2026-10-19）：F1に基づき対象2テストを修正。既存HTTP19件・controller5件と削除API208件、計232件が成功。
本番コード・期待値・DBガードの変更なし。詳細は `server/test/docs/report/itemDraft/deleteItemDraft.md` の最新結果を参照。
以下は対応前の依頼内容として残す。

## 問題

deleteItemDraft実装後、既存createItemDraftのHTTPテスト19件がbeforeEachのRouter importで失敗する。
`TypeError: Cannot read properties of undefined (reading 'error')` が `server/src/db.ts:10` で発生し、HTTPケース本体へ到達しない。

## 原因

同じcontrollerがimportする作成usecaseだけをモックしている。
追加された削除usecaseから実db.tsへ進み、戻り値のない既存dotenvモックと衝突する。

## 対象・参照

- `server/test/integration/usecases/itemDraft/createItemDraft/route.test.ts`
- `server/src/controllers/itemDraft/test/createItemDraft.test.ts`
- `server/test/docs/report/itemDraft/deleteItemDraft.md` のF1
- 対象ディレクトリのAGENTS.md、既存createItemDraftの設計書・統合レポート

## 実装内容

各テストで現在の相対import先のdeleteItemDraftUseCaseへ独立したvi.mockを追加する。
作成APIで削除usecaseが呼ばれないことも確認する。
controller単体は現状5件成功するが、実DB/modelの設定読込みに依存しない形へ揃える。

既存の19HTTPケース・controller5ケースと新設deleteItemDraftの208ケースを再実行する。
lint・本番/テスト用typecheckを確認し、同じdeleteItemDraftレポートへF1の再検証結果を追記する。

## 注意点

本番Router/controller/usecase、db.tsのガード、既存の応答・レート制限・期待値は変更しない。
dotenvモックへダミーDB設定を追加して回避しない。skip・todo化やassert緩和で失敗を隠さない。
