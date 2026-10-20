# refreshTokenのJWT payload型エラーを解消する（完了）

## 2026-10-20 対応完了

- payloadを非null・非配列のオブジェクトに限定し、idをunknownから実行時検証してgetUserへnumberを渡すよう修正。
- 数値/数字stringの正のINTEGER IDを受理し、文字列payload・id欠落・不正idを既存INVALID_DECODE_TOKEN/401で拒否。
- 単体42件・実JWT接続14件の56件成功、lint・本番/テスト用型検査・追加lint成功。
- 詳細はserver/test/docs/report/items/createItem.md末尾のF3完了記録。以下は初回調査時の記録。

## 初回調査

- 優先度: P1-bug
- 対象: `server/src/usecases/auth/refreshToken.ts:43`
- 問題: `server/`で`./node_modules/.bin/tsc --noEmit -p test/tsconfig.json`を実行すると、`string | JwtPayload`から`id`を取得する箇所でTS2339になる。createItemテスト実装時に検出した既存コードのエラー。
- 原因: JWT検証結果が文字列である可能性を型上・実行時に除外していない。
- 修正方針: 現行のトークン契約と認証エラー形式を確認し、payloadが期待するオブジェクトでidを持つことを実行時検証してから利用する。型アサーションだけで回避しない。
- 実装内容: 対象の型絞り込みと、正常payload・文字列payload・id欠落・不正idの必要な認証テストを追加する。
- 注意: createItemの本番コード変更禁止の依頼では修正していない。通常の`npm run typecheck`は成功し、テスト用tsconfigでのみ検出した。
- 確認: 関連テスト、lint、本番・テスト用型検査を実施する。認証情報や実トークンを出力しない。
