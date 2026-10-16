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
