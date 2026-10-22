# sharedIdRoutesのcontrollerモックに動画変換exportが不足

発見日: 2026-10-22。優先度: P3-techdebt。

## 問題と原因

`server/` で `npm run test:run -- test/integration/usecases/itemDraft/deleteItemDraft/sharedIdRoutes.test.ts` を実行すると6件失敗する。
itemEditing Routerのimport時、controllerモックに `convertItemEditingVideoController` がなく停止する。下書きitem_id削除対応とは別の問題。

## 修正方針・対象

`server/test/integration/usecases/itemDraft/deleteItemDraft/sharedIdRoutes.test.ts` のモックを現行 `server/src/routes/itemEditing.ts` のimportに合わせ、対象テストを再実行する。
共有IDの上限・認証・本番Router仕様は変更しない。
