# バックエンド依存パッケージの脆弱性を調査する

発見日: 2026-10-22 / 優先度: P1-bug

## 問題と原因

Node.js 26.12.1の本番Dockerビルド中、builderの`npm ci`が34件の依存パッケージ脆弱性
（low 3、moderate 8、high 16、critical 7）を報告した。
これはNode.js本体の更新とは別に対処が必要なnpm依存関係の検出結果である。
各アドバイザリ、到達可能性、本番依存への影響は未調査。

## 対象・参照

- `server/package.json`
- `server/package-lock.json`
- `server/Dockerfile`

## 修正方針・実装内容

`npm audit --json`と`npm audit --omit=dev --json`で各アドバイザリと依存経路を確認する。
本番で利用される経路、開発・マイグレーション用経路を調べ、更新範囲を決める。
破壊的変更を伴う一括更新は避け、既存仕様との互換性を検証する。
修正後はlint・型検査・関連テスト・Dockerビルドとauditを再実行する。

## 注意事項

検出数は記録時点の値。修正着手時に再取得する。
今回のNode.js更新では依存ライブラリの一括更新やmigration実行は行っていない。
