# shopSignup/signup2のテスト起動時のModel初期化を修正する

## 問題の概要・原因

`npm --prefix server run test:run -- test/usecases/shopSignup/signup2.test.ts` が、テスト実行前にSequelize Modelの初期化で停止する。
`DeliveryStatusOption.init` から `Cannot read properties of undefined (reading 'define')` が発生し、0件実行となる。
テストはdbをtransactionだけを持つオブジェクトでモックしているため、実Modelを読み込む依存経路とモック境界を確認する。

## 対象・参照ファイル

- `server/test/usecases/shopSignup/signup2.test.ts`
- `server/src/usecases/shopSignup/edit/signup2.ts` とそのimport先
- `server/test/AGENTS.md`、`server/test/usecases/AGENTS.md`

## 修正方針・実装内容

実装のimport経路とvi.mockの対象を照合し、UseCase単体テストで意図しない実Model初期化を起こさないよう境界を整える。
既存の正常系・異常系・正規化名と元名称へのフォールバックの検証を維持してテストを再実行する。

## 実装時の注意事項

テストを通す目的で本番ModelやDB接続設定を変更しない。
今回の銀行・支店normalize型修正では、このテスト設定を変更していない。
