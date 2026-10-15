# shopSignupの既存テストのUseCase import先を修正する

## 問題の概要・原因

`server` で `./node_modules/.bin/tsc --noEmit -p test/tsconfig.json` を実行すると、signup1.test.tsとsignup5.test.tsでTS2307が発生する。
テストが存在しない旧UseCaseパスを参照している。

## 対象・参照ファイル

- `server/test/usecases/shopSignup/signup1.test.ts:33`
- `server/test/usecases/shopSignup/signup5.test.ts:27`
- `server/src/usecases/shopSignup/edit` 配下の現行UseCase
- `server/test/usecases/AGENTS.md`

## 修正方針・実装内容

現行UseCaseの配置・exportとテストのimportおよびモック先を照合し、実際の依存先へ合わせる。
既存ケース・期待値を維持して対象テスト、lint、本番とテストの型検査を実行する。

## 実装時の注意事項

signup2のモック修正とは別件。本番コードやDB設定をテストのために変更しない。
