# 商品一覧のstatus条件を現行Modelと照合する

## 問題の概要・原因

商品一覧の検索条件を型付けする作業で、Itemに定義されていないstatusを使用する既存処理を確認した。
Itemのdeclareとinitは `active`・`soldout` のみだが、下書き一覧は `draft`、削除済み一覧は `deleted`、在庫・出品一覧は `hidden` を条件に含めている。
現在のModel構成と一覧の取得仕様が一致しているか確認する。

Sequelize 6のWhereOptionsは比較値として一般的なstringも許すため、Model属性から型を導いても、この不一致は型エラーにならない。

## 対象・参照ファイル

- `server/src/usecases/items/itemList/userItems/getDraftItems.ts`
- `server/src/usecases/items/itemList/userItems/getDeletedItems.ts`
- `server/src/usecases/items/itemList/userItems/getStock.ts`
- `server/src/usecases/items/itemList/userItems/getUploaded.ts`
- `server/src/services/items/query/list/userItems.ts`
- `server/src/models/item.ts`、`item_draft.ts`、`item_deleted.ts`、`item_editing.ts`
- 対応するRoute・Controller・Validator・一覧の仕様書

## 修正方針・実装内容

対象ディレクトリのAGENTS.mdを確認し、一覧種別ごとの取得対象Modelとstatusの仕様を照合する。
下書き・削除済み・在庫・出品の一覧が現行設計でどのデータを返すか確認し、UseCaseの条件とServiceの取得対象を揃える。
所有者条件、検索語、ページング、件数取得を維持し、lint・typecheckと関連する一覧取得の確認を行う。

## 実装時の注意事項

既存の検索条件に合わせる目的だけでItemのstatus型やDBのENUMを広げない。
取得仕様が不明な場合は推測で対象Modelやstatusを決めない。
今回のwhere型付けでは検索条件・Model・DBを変更していない。
