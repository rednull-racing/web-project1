# バックエンド依存パッケージの脆弱性を調査する

発見日: 2026-10-22 / 優先度: P1-bug

## 問題と原因

Node.js 26.12.1の本番Dockerビルド中、builderの`npm ci`が34件の依存パッケージ脆弱性
（low 3、moderate 8、high 16、critical 7）を報告した。
これはNode.js本体の更新とは別に対処が必要なnpm依存関係の検出結果である。
初回記録時点では、各アドバイザリ、到達可能性、本番依存への影響は未調査だった。

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

## 2026-10-22 調査結果（調査完了・修正未着手）

[調査報告書と監査原本](../../security/server-dependencies-20261022/report.md)に全34パッケージ、依存経路、成立条件、更新候補を記録した。
全依存34件（Critical 7 / High 16 / Moderate 8 / Low 3）、本番依存25件（7 / 11 / 5 / 2）を再現。

- 最優先はMulter 2.1.1。ショップ登録ルートの一部では認証・レート制限前にmultipartを解析し、未認証で脆弱な処理へ到達し得る。修正版候補2.3.0。
- Express 4.22.3、morgan 1.12.1、およびip-address・moment等の子依存更新を候補とする。実際の互換性は修正作業で検証する。
- proxy-addrのCriticalは特殊な信頼サブネット指定が条件。現行trust proxy=1で同条件は確認できない。
- 旧生成ツールがSequelize 4/5系・mysql2等を本番依存へ取り込む。現行Sequelize 6.37.8のSQL注入と混同しない。
- EJSのrender経路、uuidの脆弱なAPI呼出し、momentのlocale呼出しは現行コードに見つからない。稼働EC2での検証は未実施。
- bracesには修正版がなく、現行Sequelizeのuuid指定も修正版majorを許容しない。auditの自動提案にはダウングレードがあり、一括適用しない。

## 残件・修正時の完了条件

今回の依頼は調査のため、依存更新・本番コード修正・migration実行は行っていない。
報告書の修正順序に従い、Multer、HTTP周辺、不要な生成・描画依存、ビルド/開発依存を個別に対処する。
修正後のlint・型検査・関連テスト・Docker検証・再auditが必要なため、このTodoはP1-bugへ残す。
未解消経路は到達性と対応方針を記録し、調査報告だけで脆弱性修正完了とはしない。
