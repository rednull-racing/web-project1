# updateConfirmの実DBテストを確定済み数値契約へ移行する

発見日: 2026-10-21。優先度: P3-techdebt。

## 問題と原因

`server/`で`npm run test:run -- test/integration/database/itemEditing/updateConfirm/database.test.ts`を実行し、92件中63件成功・I03/I04の29件失敗を確認。
0・負数・小数・InfinityをDB制約や404、brandのnull化へ到達すると期待しているが、現行validateNumberはINVALID_NUMBER/400で停止する。空白はnull化して正常更新されるため、外部キー違反の期待値と一致しない。
今回のvideo_status追加とは別の契約不一致。DB非接続テストの同種問題は[対応履歴](../done/reconcile-update-confirm-test-contracts.md)で修正済みだが、この実DBテストは未移行。

## 対象・参照

- 対象: `server/test/integration/database/itemEditing/updateConfirm/database.test.ts`のI03/I04。
- 参照: `server/src/usecases/shared/validateNumber.ts`、`server/test/integration/usecases/itemEditing/updateConfirm/masterBrand.test.ts`、`server/test/docs/architecture/itemEditing/updateConfirm.md`、`server/test/docs/report/itemEditing/updateConfirm.md`。

## 修正方針・実装内容

対応履歴と数値契約の根拠を全文確認し、不正数値は400と保存前後の不変、空白は対象IDのnull保存を確認するケースへ移行する。元IDとの対応を設計・レポートへ残す。テストを通す目的で本番コードやDB制約を緩和しない。
実DB規則に従い.env.test由来のtest_dbガード、自作IDだけのcleanup・接続終了を維持する。関連テスト、lint、本番・テスト型検査、通常lint対象外TSの追加検査を実施する。
