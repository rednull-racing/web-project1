# signup1テストの既存未使用変数を整理する

## 進捗（2026-10-15・完了）

- 任意項目を省略するケースのbodyを既存Signup1Body型で宣言し、対象4プロパティをdeleteする準備へ変更。
- 未使用変数を解消し、プロパティを省略する入力・既存期待値・単一ファイル形式を維持。
- 対象テスト8件成功。server全体lint・本番typecheck・test/tsconfig.jsonの型検査が通過。
- 対象テストにtypescript-eslint推奨設定を追加適用したlintもエラー・警告なし。本番コード・共通設定変更なし。

## 問題の概要・原因（修正前）

`server/test/usecases/shopSignup/signup1.test.ts` の任意項目を省略するケースで、分割代入に使う `_homepage`・`_building`・`_companyNumber`・`_capital` がtypescript-eslint推奨設定のno-unused-varsに違反する。
通常のserver lintはsrcのTypeScriptを対象にしており、この4件はテストへ追加適用したlintで検出した。

## 修正方針・実装内容

任意項目を省略する入力と期待値を維持して、未使用変数が生じない準備方法へ変更する。
既存のテスト形式は維持し、対象テストとtypescript-eslint推奨設定による追加lintを確認する。

## 対象・参照ファイル

- `server/test/usecases/shopSignup/signup1.test.ts`
- `server/test/usecases/AGENTS.md`
- `server/eslint.config.mjs`

## 実装時の注意事項

import修正とは別件。テストを通すための期待値変更や本番コード・共通lint設定の変更は行わない。
