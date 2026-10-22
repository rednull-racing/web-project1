# Node.js 26への更新

更新日: 2026-10-22

## 採用バージョン

[26.12.1（Current、2026-10-21公開のセキュリティ修正版）](https://github.com/nodejs/node/releases/tag/v26.12.1)。
依頼の「最新」に合わせてCurrentを採用。最新LTSは24.22.1。
開発・本番Dockerの両ステージ、ルート・client・serverのengines、`.nvmrc`を更新した。
client/serverの`@types/node`を26.6.5へ更新し、対応するundici-typesとlockfileを同期した。
アプリケーションコードの互換修正が必要なエラーは、以下の確認範囲では検出しなかった。

## 確認結果

SHA256を公式SHASUMS256.txtと照合したLinux x64版26.12.1で実行。
Linux公式バイナリに必要なlibatomic1は検証用に/tmpへ展開。ホスト全体のNode.jsは変更していない。

- server: lint・typecheck・build成功。
- server: `tsc --noEmit -p test/tsconfig.json`成功。
- server: `npm run test:run -- src`は59ファイル、1816件成功・2件失敗。
- 失敗2件は`deleteItemDraft.test.ts`の取得カラム`item_id`の既存不一致。Node.js 20.20.2でも同じ2件が失敗。
- bcryptのhash/compare、JWTの署名/検証、AWS S3クライアント生成、Sequelize生成/close成功（外部接続なし）。
- client: typecheck成功。
- client: lintは29エラー・40警告。Node.js 20.20.2と26.12.1でJSON出力が完全一致。
- Docker: Node.js 26.12.1、26.12.1-alpineの公式イメージ取得成功。server/clientともbuilder・本番依存のnpm ci成功。serverのTypeScript buildとclientのNext.js build成功。

ホスト側のNext.js buildはcompile段階で長時間進行せず中止し、Docker内の本番ビルド成功で確認した。
server/clientの本番Dockerイメージ作成成功。完成イメージ内でもbcrypt・JWT、Next.js・sharpの基本動作成功。
実DB・外部AWS接続テスト、migration、本番デプロイは実施していない。
既存のNext.js設定はtypescript.ignoreBuildErrors=trueのため、型検査はbuildと別に実行した。

## 別途対応する既存問題

- [client lint](todo/P3-techdebt/restore-client-lint-baseline.md)
- [deleteItemDraftのテスト契約](todo/P3-techdebt/align-delete-item-draft-service-test-columns.md)
- [npm依存パッケージの脆弱性](todo/P1-bug/review-server-dependency-vulnerabilities.md)

## 利用・反映

ローカル環境はルートで`nvm install`・`nvm use`後、各package.jsonのディレクトリで`npm ci`。
[公式Linux実行要件](https://github.com/nodejs/node/blob/main/BUILDING.md)に従い、libatomicを用意する。
Dockerは`docker compose build --pull`で再ビルドする。
本番反映には更新イメージのビルドとデプロイが必要。
