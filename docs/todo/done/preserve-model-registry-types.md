# Modelの再exportで型情報が失われる問題を整理する

## 進捗（2026-10-14）

- Model登録オブジェクトの `any` を削除し、`ModelRegistry` と各Modelの具体的な型を保持する再exportへ変更済み。
- 設定取得の `any` も削除済み。以下は未対応のため、このTodoは未完了とする。
- 型復元後のtypecheckは87ファイルで288件のエラーを検出。関連取得結果の型未定義、nullable値、存在しないカラム、Modelクラスとインスタンスの混同、Sequelizeメソッドの引数不整合などを個別に確認する。
- 今回はModelインポートの型復元のみ実施。Service・UseCaseの修正、価格復元仕様の決定、オーバーロード整理は行っていない。
- 参照先の `copyUpload/copyUpload.ts` は現在存在しないため、後続作業では現行の呼び出し元を検索する。
- 後続作業で16個のModelに関連プロパティ41件を `NonAttribute` で宣言し、未取得はundefined、単数関連の不在はnull、複数関連は配列として型を保持。
- `getMyItemWithVideoSaleShipping` はtransactionなしでも `ItemWithVideoSaleShipping | null` を返す型契約へ修正済み。クエリや業務処理は変更していない。
- 最新のtypecheckは107件のエラーが残存。関連先やカラムのnull確認、存在しないカラム、Modelクラスとインスタンスの混同、Sequelizeメソッドの引数不整合は未修正。
- 関連名の不一致は `docs/todo/P1-bug/align-eager-loaded-association-property-names.md` に記録し、型宣言で隠さず別途対応する。

## 進捗（2026-10-15）

- `server/src/services` の型エラー17件を解消。destroyのtransactionを同一optionsへ統合し、findAllの未対応distinctとfindOneの無効なrequireを削除。店舗編集のS3データ取得先をShopInfoEditへ修正。
- 全体lintは通過。typecheckはservices内の指摘なし、対象外のtypes・usecasesに13件が残存しているため未完了。
- `getShopSignup1One` の戻り値が正しくnullableと推論され、`server/src/usecases/shopSignup/get/signup1.ts` の16行目に2件のnull参照エラーが表面化。後続作業で呼び出し側の存在確認と既存エラー処理を確認する。
- services外の型エラーは今回修正していない。`any`・型アサーションの追加やModel・DBの変更なし。

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
