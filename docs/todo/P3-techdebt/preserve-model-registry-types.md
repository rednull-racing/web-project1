# Modelの再exportで型情報が失われる問題を整理する

## 問題の概要・原因

`server/src/models/index.ts` のModel登録オブジェクトが `any` のため、再exportされたModelと取得結果の型情報が失われている。
`getMyItemWithVideoSaleShipping` の戻り値を具体化すると、既存のコピーアップロードと論理削除で型エラーが表れる。

## 対象・参照ファイル

- `server/src/models/index.ts`
- `server/src/services/items/query/relation.ts`
- `server/src/types/serviceType/items.ts`
- `server/src/usecases/items/upload/copyUpload/copyUpload.ts`
- `server/src/usecases/items/delete/logicalDelete.ts`
- `docs/todo/P2-refactor/restore-server-no-explicit-any-lint-rule.md`

## 修正方針・実装内容

各ディレクトリのAGENTS.mdと規約に従い、Model登録・再exportで具体的な型情報を保持する。
取得結果の型を保持したまま、nullableな商品・関連カラム、任意のinventoryの扱いを確認する。
論理削除の `item.before_price` 参照はItemに存在しないため、価格の復元仕様を確認して修正する。

## 実装時の注意事項

型を具体化して表れる問題を `any` や型回避目的のアサーションで隠さない。
関連データの有無や在庫情報の未入力時の仕様を確認し、独断で挙動を変更しない。
既存呼び出しの型契約を維持しているServiceのオーバーロードは、呼び出し元の修正後に整理する。
lintと型チェックを実行する。
