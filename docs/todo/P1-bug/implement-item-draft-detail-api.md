# 下書き詳細画面の取得APIを実装する

発見日: 2026-10-27 / 優先度: P1-bug

## 問題と原因

`/item/draft/[id]` は `GET /item-draft/:id` で `{ itemDraft }` を取得するが、現行の `server/src/routes/itemDraft.ts` には動画変換・下書き作成・削除のみが定義され、取得ルートがない。
フロントの動画・商品セクションは実装済みだが、このリポジトリのサーバーとの画面接続を完了できない。

既存の `getMyItemDraft` はトランザクション内の更新ロック付き取得で、表示用の関連選択肢や日時・所有者IDを含むレスポンス取得用途とは異なる。

## 修正方針・実装内容

下書き詳細取得APIの設計を確認し、認証・パラメータ検証・所有者照合を行ったうえで下書きデータを返すルート・Controller・UseCase・Serviceと必要なテストを追加する。
下書きIDと商品編集ID・商品IDを区別し、所有者以外へデータを返さない。ModelとDBの現行制約を確認し、nullable項目と関連するカテゴリー・配送選択肢等の契約を画面側と揃える。

## 対象・参照

- `server/src/routes/itemDraft.ts`
- `server/src/controllers/itemDraft/itemDraft.ts`
- `server/src/services/itemDraft/query.ts`
- `server/src/models/item_draft.ts`
- `client/src/app/item/draft/api/server.ts`
- `client/src/app/item/draft/types.ts`
- `client/src/app/item/draft/AGENTS.md`

## 完了条件・注意点

所有者による取得、未ログイン、他人の下書き、存在しないID、不正ID、未入力項目・関連選択肢の取得を検証する。
実APIを使って下書きページ本体とメタデータの表示を確認し、残件が解消したら画面側AGENTS.mdを更新する。
2026-10-27のフロント実装ではAPIを追加していない。コンポーネントの一部を置き換えた表示検証・型検査・変更ファイルlintのみ実施し、実APIの疎通は未検証。
