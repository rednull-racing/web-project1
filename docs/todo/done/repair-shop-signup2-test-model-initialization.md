# shopSignup/signup2のテスト起動時のModel初期化を修正する

## 進捗（2026-10-15・完了）

- ユーザー指定に従い、既存の単一ファイル形式・5ケース・期待値を維持し、モック境界だけを修正。
- 旧services/shopSignup.jsのモックを、実UseCaseがimportするquery.js・command.jsのモックへ分割。
- 修正前はDeliveryStatusOption.initで停止し0件実行、修正後は対象テスト5件すべて成功。実Model・DB設定・本番コードは変更していない。
- server全体lint・本番typecheckと、対象テストへのtypescript-eslint推奨設定による追加lintが通過。
- test/tsconfig.jsonの型検査は対象外signup1・signup5の既存importエラー2件で失敗。別Todoへ記録。

## 問題の概要・原因（修正前）

`npm --prefix server run test:run -- test/usecases/shopSignup/signup2.test.ts` が、テスト実行前にSequelize Modelの初期化で停止する。
`DeliveryStatusOption.init` から `Cannot read properties of undefined (reading 'define')` が発生し、0件実行となる。
テストはdbをtransactionだけを持つオブジェクトでモックしているため、実Modelを読み込む依存経路とモック境界を確認する。

## 対象・参照ファイル

- `server/test/usecases/shopSignup/signup2.test.ts`
- `server/src/usecases/shopSignup/edit/signup2.ts` とそのimport先
- `server/test/AGENTS.md`、`server/src/AGENTS.md`（単体テスト共通ルール。旧server/test/usecases/AGENTS.mdから移管）

## 修正方針・実装内容

実装のimport経路とvi.mockの対象を照合し、UseCase単体テストで意図しない実Model初期化を起こさないよう境界を整える。
既存の正常系・異常系・正規化名と元名称へのフォールバックの検証を維持してテストを再実行する。

## 実装時の注意事項

テストを通す目的で本番ModelやDB接続設定を変更しない。
今回の銀行・支店normalize型修正では、このテスト設定を変更していない。
