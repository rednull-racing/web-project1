# itemEditingの既存controllerテストをDBから分離する

優先度: P3-techdebt。

## 問題の概要

2026-10-16のcontroller配置変更後、server/で次のテストを実行すると、両suiteとも収集時に `DATABASE_URL is not set!` で停止した。

- `test/usecases/itemEditing/createItemEditingDraft/controller.test.ts`
- `src/controllers/itemEditing/test/updateConfirm.test.ts`

移動した `src/controllers/itemEditing/test/createItemEditingCopy.test.ts` は5件成功している。

## 原因・修正方針

controllerは複数usecaseをimportするが、上記テストでは対象外usecaseの依存が十分にモックされておらず、createItemEditingCopyからsrc/db.tsへ到達する。実DB設定を加えて回避せず、対象外usecaseを現在の実ファイルパスでモックし、DB非接続の単体テストとして独立させる。

## 実装内容・注意事項

上記2ファイルと `src/controllers/itemEditing/itemEditing.ts`、成功しているCopyのcontrollerテストを確認する。対象controllerは実処理のまま、usecaseとの境界をモックする。期待値や本番コードは変更しない。server/で上記3ファイルを指定した `npm run test:run -- <対象ファイル> --maxWorkers=1` とlint・typecheckを実行し、結果を記録する。DB接続・migration実行は不要。

## 解決結果（2026-10-16）

現在のDraft controllerは既にモック済みで4件成功。updateConfirmも5件成功したが、対象外Draft/Copyが実DB設定を読み込む状態だったため、両usecaseを実import先でモックして分離した。Copy5件を含むcontroller3ファイル14件が成功した。旧test/usecasesのDraft/controllerは削除済みのため、現配置src/controllers/itemEditing/test/createItemEditingDraft.test.tsを検証した。

関連全体10ファイル542件、lint、本番/テスト全体型検査、変更結合TS追加lintが成功。DB接続・migration・本番コード変更なし。詳細は [最新レポート](../../../server/test/docs/report/itemEditing/updateConfirm.md#contracts-20261016) を参照。
