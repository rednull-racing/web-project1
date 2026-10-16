完了: 2026-10-16。ルートtestをserver/testへ集約し、相対import・設計書リンクを更新。新規ライブラリ・設定の追加なしで、既存VitestによるHTTP結合テスト22件、serverのlint・typecheck、test/tsconfig.jsonによる全テスト型検査が成功。参照先修正後、以前の8件の型エラーは再現しない。実DBテストは未実行。

以下は対応前の記録。

# createItemEditingCopy結合テストの参照先と型を修正する

## 問題の概要

優先度: P3-techdebt。2026-10-16の単体テスト移動時、`server/` で `./node_modules/.bin/tsc --noEmit -p test/tsconfig.json` を実行すると、保留中の結合テストに8件の型エラーが残っている。結合テストは依頼により修正・実行していない。

## 原因・対象ファイル

- `server/test/fixtures/itemEditing/createItemEditingCopy/databaseFixtures.ts:13` の旧usecase参照によるTS2307はfixture移動時に修正済み。実ファイルは `server/src/usecases/itemEditing/createItemEditingCopy/createItemEditingCopy.ts`。
- `server/test/integration/usecases/itemEditing/createItemEditingCopy/databaseConcurrency.test.ts:93,94,99,104` のコールバック引数でTS7006、225,226,239行の未確定PromiseでTS2345が出る。importエラーの波及と独立した型問題を切り分ける。
- `server/test/integration/usecases/itemEditing/createItemEditingCopy/route.test.ts` のusecaseモック先は結合テスト配置変更時に現配置へ修正済み。実行結果は未確認。

## 修正方針・実装内容

結合テストの作業再開時、上記ディレクトリのimport・モック先を現在のusecase配置へ合わせ、型検査をやり直す。残るエラーは実際のPromiseの生存期間と制御順序に沿って修正する。`httpFixtures.ts`、`databaseSetup.ts`、`databaseFixtures.ts` と `server/test/docs/architecture/itemEditing/createItemEditingCopy.md` を参照する。

## 実装時の注意事項

期待値を弱めず、anyや根拠のない型アサーションで隠さない。本番コードやDB接続設定は変更しない。Routerの検証と実DBテストを分け、DB検証は既存の安全ガードを確認してから行う。migrationは実行しない。lint・本番とテストの型検査・対象テストの結果を記録する。

2026-10-16追記: 結合テスト5ファイルはserver/test/integrationへ移動済み。上記8件は移動前の観測値で、当時のserver/test/tsconfig.jsonはルート配置のテストを対象にしていなかった。fixture関連は `server/test/fixtures/itemEditing/createItemEditingCopy/` へ移動済み。再検証前に `configure-root-backend-integration-tests.md` の実行・型検査環境を整える。
