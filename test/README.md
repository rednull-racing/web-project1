# E2Eテスト環境

E2Eはこのディレクトリの独立したnpmパッケージで管理する。テスト方針・配置規則は [フロントエンドテスト](../client/test/AGENTS.md) を参照する。

## セットアップ

```bash
cd test
npm ci
npm run test:browsers:install
```

Linuxでブラウザーの共有ライブラリが不足する場合は、管理者権限のある環境で `npx playwright install-deps` を実行する。

## 実行

1. テスト用PostgreSQLとExpressを起動し、対象シナリオのデータ・認証情報を準備する。マイグレーションは自動実行しない。
2. `client` で `npm run build`、`npm run start -- --hostname 127.0.0.1` を実行する。
3. `test` で `npm run test:e2e` を実行する。`client` からは `npm run test:e2e` で同じコマンドへ委譲できる。

接続先の既定値は `http://127.0.0.1:3000`。別のテスト環境は `PLAYWRIGHT_BASE_URL` で指定する。設定ファイルはサービス起動・DB更新を行わない。シナリオ固有のデータ準備・後片付けは `fixtures/` に実装する。

Chromium・Firefox・WebKitを実行する。ブラウザーを限定する場合は `npm run test:e2e -- --project e2e-chromium` を使用する。型検査は `npm run typecheck`。レポートは `playwright-report/`、失敗時のtraceなどは `test-results/` に出力される。

業務テストはまだ追加していない。テストがない場合、実行コマンドはエラー終了する。収集設定だけを確認する場合は `npm run test:e2e -- --list --pass-with-no-tests` を使用する。

## client側のテスト

`client` で `npm ci` を実行後、`npm run test:unit`、`npm run test:integration` を実行する。DOMを使わないテストはファイル先頭に `// @vitest-environment node` を指定できる。HTTPモックは `client/test/fixtures/server.ts` の `server.use(...)` でテストごとに登録する。SWRはテストごとに独立したcache providerを用意する。

ブラウザー上のページ結合テストは `client` で `npm run test:pages:browser` を使用する。起動済みのNext.jsが必要で、ブラウザーからのAPI通信はテスト内で置き換える。サーバー発の通信には別途テスト用APIを用意する。

## 導入時の確認結果

Node.js 22.22.2でReact・DOM操作とMSWの一時検証テストが成功し、検証用ファイルは削除した。プロジェクト指定のNode.js 26環境では未検証。両パッケージの型検査を実施した。ブラウザー本体はインストール済みだが、実行環境のOS共有ライブラリが不足し、3ブラウザーの起動確認は失敗した。管理者環境で上記の `playwright install-deps` を実行する必要がある。
