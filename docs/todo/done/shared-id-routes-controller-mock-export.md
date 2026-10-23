# sharedIdRoutesのcontrollerモックに動画変換exportが不足

発見日: 2026-10-22。優先度: P3-techdebt。

## 問題と原因（修正前の記録）

`server/` で `npm run test:run -- test/integration/usecases/itemDraft/deleteItemDraft/sharedIdRoutes.test.ts` を実行すると6件失敗する。
itemEditing Routerのimport時、controllerモックに `convertItemEditingVideoController` がなく停止する。下書きitem_id削除対応とは別の問題。

## 修正方針・対象

`server/test/integration/usecases/itemDraft/deleteItemDraft/sharedIdRoutes.test.ts` のモックを現行 `server/src/routes/itemEditing.ts` のimportに合わせ、対象テストを再実行する。
共有IDの上限・認証・本番Router仕様は変更しない。

## 完了結果（2026-10-22）

- 現行Routerのimportに合わせ、動画変換controllerの観測用モックを追加。上限・認証・本番Router仕様の変更なし。
- 指定テストは1ファイル6件成功。初回sandboxのHTTP待受EPERMは権限付き再実行で解消。
- lint、本番／テスト型検査、変更TS追加lint成功。DB・動画変換実処理は対象外。
- 詳細：`server/test/docs/report/itemDraft/deleteItemDraft.md` の最新結果。
