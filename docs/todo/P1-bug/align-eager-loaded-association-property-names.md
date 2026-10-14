# 関連取得結果の参照名をSequelizeの関連名へ合わせる

## 進捗（2026-10-14）

- Permit→S3Metadataは `as: "S3Metadata"` とModelの関連プロパティ型を追加し、取得側includeも同じ名前へ統一済み。
- shopInfo・shopInfoEdit・shopSignupのgetFileは型推論で関連データを扱い、nullを除外する。該当するS3Metadata型エラーは解消済み。
- ShopInfoEdit→Permitは `as: "Permit"` と配列の関連プロパティ型を追加し、取得側includeも統一済み。updateIdImage.tsの該当型エラーは解消済み。
- ShopSignup→Permitも `as: "Permit"` と配列の関連プロパティ型を追加し、取得側includeを統一済み。oldShopSignup.tsの該当型エラーは解消済み。
- ShopInfoのPermits／PermitおよびCategory／Categoriesの不一致は未修正。このTodoは未完了とする。

## 問題の概要・原因

関連Modelの型を復元する作業で、既存の参照名と実際のSequelizeの関連名に不一致を確認した。
該当プロパティはincludeしても設定されないため、関連データを取得済みでも未取得として扱われる可能性がある。

- ShopInfo・ShopInfoEdit・ShopSignupのPermitへのhasManyは、as未指定のため `Permits` という配列になる。既存処理・取得結果型には `Permit` という参照がある。
- PermitのS3MetadataへのbelongsToは、as未指定のため `S3Metadatum` になる。既存処理・取得結果型は `S3Metadata` を参照している。
- prototypeのOrders取得結果から `item.Categories` を参照しているが、Itemの関連定義はasが `Category` になっている。

Sequelizeインスタンスのassociationsをメモリ上で確認済み。DBへクエリは発行していない。

## 対象・参照ファイル

- `server/src/models/shop_info.ts`、`shop_info_edit.ts`、`shop_signup.ts`、`permit.ts`、`item.ts`
- `server/src/services/shopInfo/query.ts`、`shopInfoEdit/query.ts`、`shopSignup/query.ts`
- `server/src/types/serviceType/shopInfoEdit.ts`、`shopSignup.ts`
- `server/src/usecases/shopInfo/get/getFile.ts`、`shopInfoEdit/get/getFile.ts`、`shopSignup/get/getFile.ts`
- `server/src/usecases/shopInfoEdit/update/updateIdImage.ts`
- `server/src/usecases/shopSignup/edit/signup5/oldShopSignup.ts`
- `server/src/prototype/routes/orders.ts`

## 修正方針・実装内容

各ディレクトリのAGENTS.mdに従い、該当関連を参照する処理・取得結果型・includeを全件検索する。
既存のAPI契約を確認し、実際の関連名へ参照を揃えるか、明示的なasを追加してincludeも揃えるかを決める。
単数関連と複数関連の型を実際の関連名・件数に合わせ、静的なassociationsの型にも不一致があれば整合させる。
取得結果に関連がある場合・ない場合の添付ファイル取得や削除処理を確認し、lintとtypecheckを実行する。

## 実装時の注意事項

存在しない参照名のdeclare追加や型アサーションで不一致を隠さない。
DBカラム・外部キー・関連の件数は変更しない。APIの返却名への影響を確認せず独断で変更しない。
関連Model参照の型未定義を直す作業では、この不一致自体は修正していない。
