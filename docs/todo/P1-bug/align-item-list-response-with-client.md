# 商品一覧APIの返却形式とフロントの期待形式を整合する

## 2026-11-12 対応状況

ユーザー指定に従いAPIは変更せず、全7一覧のフロント型・wrapped配列の描画・数値IDのキャッシュ削除を修正した。draftのみ価格nullを許可し「-」表示、他一覧はnull不可。数値文字列も通常の価格表示へ整形する。draft単体43件・結合16件・共通部品79件成功、対象lint/テスト型検査成功。

[検証レポート](../../../client/test/docs/report/item-list/draft.md)を参照。実E2EはテストDBのスキーマガードで停止しており、DB整備後の疎通と人間による操作確認は未完了。必要な実環境確認が残るため本TodoをP1に維持する。以下は発見時の履歴。

発見日: 2026-11-11。文書作成中の静的確認で発見。実API・ブラウザーでの再現は未実施。

## 問題と原因

`client/src/app/item-list` の一覧は配列要素を商品そのものとして描画するが、対応する現行バックエンドは要素をオブジェクトで包んで返す。共通fetcherにこのラップを解除する処理はなく、ControllerもUseCaseの配列をそのまま返す。

- stock / uploaded / like / watch-history / cart: フロントは `itemList: Item[]`、APIは `itemList: { item: ... }[]`。
- draft: フロントは `itemDraftList: ItemDraft[]`、APIは `itemDraftList: { itemDraft: ... }[]`。
- trash: フロントは `itemTrashList: ItemTrash[]`、APIは `itemTrashList: { itemTrash: ... }[]`。

ID・価格・属性等を直接参照するため、取得成功後も表示や操作に支障が出る可能性がある。IDの数値/文字列、nullable項目、日時、Video/Saleの項目も双方の型を照合する必要がある。

## 対象・参照

- `client/src/app/item-list/{stock,uploaded,like,watch-history,cart,draft,trash}` の一覧・商品行・API・AGENTS.md、および `client/src/app/item-list/types.ts`。
- `client/src/lib/fetcher.ts`。
- `server/src/usecases/items/list/getStockItemList.ts`、`getUploadedItemList.ts`。
- `server/src/usecases/{itemLike/getItemLikeList,watchHistory/getWatchItemList,cart/getCartItemList,itemDraft/getItemDraftList,itemTrash/getItemTrashList}.ts`。
- 対応するRoute・Controller・Validator、詳細設計、HTTP/UseCaseテストとレポート。
- 関連履歴 `docs/todo/done/align-item-list-status-queries-with-models.md` は旧status条件の対応であり、今回の返却形式の不一致とは別件。

## 修正方針・実装内容

対象のAGENTS.mdと詳細設計・API契約を読み、採用する返却形式を確定する。API側の変更か、フロント側の変換・型修正かは既存利用箇所への影響を確認して決める。型アサーションだけで隠さず、実際のJSON構造と画面が使用する型を一致させる。

一覧の表示、空データ、検索、ページング、削除時の楽観的更新・復元、商品詳細や購入へのID引継ぎを対象範囲に応じて検証し、変更した契約を各ページのAGENTS.mdへ反映する。既存の所有者・status条件やページサイズを独断で変えない。

## 完了条件・注意事項

対象一覧の実際のJSON形式とフロントの参照が一致し、必要なテスト・lint・型検査と操作確認の結果が記録されていること。今回の文書作成では実装・テストを変更していない。
