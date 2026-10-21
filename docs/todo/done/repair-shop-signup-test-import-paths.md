# shopSignupの既存テストのUseCase import先を修正する

## 進捗（2026-10-15・完了）

- ユーザー指定に従い、signup1・signup5のUseCase import先と依存モック先だけを現行パスへ修正。形式・ケース・期待値は維持。
- signup1はedit/signup1/signup1.js、signup5と削除helperはedit/signup5配下へ変更。ShopSignupのモックは実import先のquery.js・command.jsへ変更。
- signup1・signup2・signup5の回帰テスト17件すべて成功。server全体lint・本番typecheck・test/tsconfig.jsonの型検査通過。
- 対象テストにtypescript-eslint推奨設定を追加適用するとsignup1の既存未使用変数4件で失敗。パス修正の範囲外として別Todoに記録。
- 本番コード・DB設定・テスト期待値の変更なし。DB接続なし。

## 問題の概要・原因（修正前）

`server` で `./node_modules/.bin/tsc --noEmit -p test/tsconfig.json` を実行すると、signup1.test.tsとsignup5.test.tsでTS2307が発生する。
テストが存在しない旧UseCaseパスを参照している。

## 対象・参照ファイル

- `server/test/usecases/shopSignup/signup1.test.ts:33`
- `server/test/usecases/shopSignup/signup5.test.ts:27`
- `server/src/usecases/shopSignup/edit` 配下の現行UseCase
- `server/src/AGENTS.md`（単体テスト共通ルール。旧server/test/usecases/AGENTS.mdから移管）

## 修正方針・実装内容

現行UseCaseの配置・exportとテストのimportおよびモック先を照合し、実際の依存先へ合わせる。
既存ケース・期待値を維持して対象テスト、lint、本番とテストの型検査を実行する。

## 実装時の注意事項

signup2のモック修正とは別件。本番コードやDB設定をテストのために変更しない。
