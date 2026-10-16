完了: 2026-10-16。ルートtestをserver/testへ集約し、相対import・設計書リンクを更新。新規ライブラリ・設定の追加なしで、既存VitestによるHTTP結合テスト22件、serverのlint・typecheck、test/tsconfig.jsonによる全テスト型検査が成功。参照先修正後、以前の8件の型エラーは再現しない。実DBテストは未実行。

以下は対応前の記録。

# ルート配置のバックエンド結合テストの実行・型検査を整える

優先度: P3-techdebt。

## 問題の概要・原因

createItemEditingCopyの結合テスト5ファイルを `test/integration/backend/{database,usecases}/itemEditing/createItemEditingCopy/` へ移動した。現在の `server/package.json` のVitestコマンドはserverを基準とし、`server/test/tsconfig.json` はserver/testのみを対象とする。ルートのnode_modulesにはvitest・sequelize・supertestがなく、移動後のテストは既存コマンドの検査対象にならない。今回の依頼は配置変更のため実行環境の変更は行っていない。

## 修正方針・実装内容

既存のserver側依存を利用し、新規ライブラリ追加なしでルート配置のテストを発見・実行・型検査できる設定とコマンドを整える。DBを使わないroute.test.tsと実DBテストは分けて実行できるようにする。実行手順を `test/docs/architecture/itemEditing/createItemEditingCopy.md` に記録する。

## 対象・参照ファイル

- `test/integration/backend/`、`server/package.json`、`server/tsconfig.json`、`server/test/tsconfig.json`、`server/eslint.config.mjs`
- `test/fixtures/backend/itemEditing/createItemEditingCopy/{fixtures,databaseFixtures,httpFixtures,databaseSetup}.ts`
- `docs/todo/P3-techdebt/repair-create-item-editing-copy-integration-tests.md`

## 注意事項

fixture関連は `test/fixtures/backend/itemEditing/createItemEditingCopy/` へ移動済み。databaseSetup.tsはserverをカレントディレクトリとして.env.testを読む安全ガードを持つため、作業ディレクトリ変更で読込先を壊さない。DB環境変数の値を出力しない。DBテスト実行前に既存の安全条件を確認し、migrationは実行しない。テスト内容・期待値・本番コードはこの実行環境の対応だけを理由に変更しない。
