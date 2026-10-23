# sessionMiddlewareのuuid実行時依存を解決する

発見日: 2026-10-23。優先度: P1-bug。

## 問題と原因

createItemのHTTP回帰で、`middleware/index.ts`から読み込む`middleware/session.ts`の`import { v4 } from "uuid"`が`Cannot find package 'uuid'`となり、route/registrationの34件が準備時に失敗した。現行server/package.jsonには`@types/uuid`だけがあり、uuidの直接実行時依存はない。現在のserver/node_modulesでもトップレベルuuidは存在しない。Sequelize配下のuuidは別の依存であり、このimportを保証しない。

アプリ実起動・本番EC2の状態は未確認。確認済みなのは現在の依存配置とHTTPテストのimport失敗であり、全環境での停止を断定しない。

## 対象・参照

- `server/src/middleware/session.ts`、`server/src/middleware/index.ts`
- `server/package.json`、`server/package-lock.json`
- `docs/todo/done/review-server-dependency-vulnerabilities.md`（Sequelize配下uuidのoverrideは過去の別件）
- `server/test/docs/report/items/createItem.md`（2026-10-23の初回失敗と対象外依存の分離）

## 修正方針と実装内容

session IDの契約・既存利用先を確認し、既存のNode.js組込み`node:crypto`のrandomUUIDへ置き換える等、直接依存が不要な方針を検討する。新しいライブラリを追加する方針ならユーザーの明示依頼が必要。単に別パッケージ配下のuuidを直接importして配置へ依存させない。

既存Cookieからの引継ぎ、新規IDの形式・一意性、cookie属性、nextへの接続を必要な対象テストで確認し、本番lint・型検査と関連HTTP回帰を実行する。本件で認証・Cookie運用・共通middleware構成を独断で変更しない。

## 現在の対応と完了条件

createItemの検証では、そのAPIに不要なsessionMiddlewareだけをHTTP fixtureでモックし、実認証・parser・rate limit・validator・controllerを維持した。本番のuuid依存は修正していない。対象外mockを外してもmiddleware importとsession動作が成功し、必要な回帰確認を終えた時点で結果を記録してdoneへ移動する。
