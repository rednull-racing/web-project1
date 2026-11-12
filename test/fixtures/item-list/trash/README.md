# Trash一覧 E2E環境

`test/` のE2E設定で収集する。Node.js 26と既存依存を使用する。

1. `server/.env.test` に隔離した `test_db` とテスト認証設定を準備する。fixtureはDB名・対象スキーマを検証し、migrationやsyncを実行しない。
2. `client/` で `NEXT_PUBLIC_API_URL=http://127.0.0.1:4321/api API_URL=http://127.0.0.1:4321/api npm run build -- --webpack` を実行する。通常のTurbopackでも依存配置が適合すればよい。公開API URLはビルド時に固定する。
3. `test/` で `npm run test:e2e -- E2E/item-list/trash/ --project e2e-chromium --grep E-N01` を先行実行する。
4. 前提が成功した後、`--grep E-N01`を外して全件を実行する。

fixtureはproduction Nextを3021、実Expressを4321で起動するため、両ポートを空ける。NextAuthの資格情報認証を実行し、HTTP API・返却JSON・ルートの書換えは行わない。期間仕様の観測E-X01は「最近1か月」の案内文と一致するという意味ではない。

作成したユーザー・trashのIDだけを追跡し、finallyで関連するテスト認証トークン・trash・ユーザーを削除して起動プロセスを停止する。既存item_draft/item_editingのスキーマは検証しない。全Eケースは読取りのため一覧前後のseed行の不変を確認する。
