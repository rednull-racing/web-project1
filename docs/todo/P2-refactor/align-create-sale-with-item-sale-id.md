# 旧createSaleをItem.sale_idの関連仕様と照合する

## 問題の概要・原因

Saleから対応するItemを取得する処理の修正中、旧 `createSale` が削除済みの `Sale.item_id` を作成データへ渡していることを確認した。
現在のModelはItemのsale_idがSaleを参照するため、旧作成処理では関連を設定できない。
旧APIは参考用に残すというユーザー方針があるため、今回のセール開始・終了処理の修正では変更していない。

## 対象・参照ファイル

- `server/src/services/sale.ts` の `createSale`
- `server/src/types/serviceType/sale.ts` の `CreateSaleParams`
- `server/src/models/sale.ts`、`server/src/models/item.ts`
- `createSale` を使用するUseCaseと商品新規作成の仕様

## 修正方針・実装内容

各ディレクトリのAGENTS.mdを確認し、旧処理の呼び出し元と現行仕様を照合する。
修正対象にする場合は、作成したSaleのidをItem.sale_idへ設定する流れを確認し、必要な作成・更新を同じtransactionで行う。
lint・typecheckと、作成したSaleに対象Itemが正しく結び付くことを確認する。

## 実装時の注意事項

Saleへitem_idを復活させたり、DB・Modelの制約を独断で変更したりしない。
参考用の旧APIを残す方針を尊重し、明示的な修正依頼があるまでこの作成処理は変更しない。
