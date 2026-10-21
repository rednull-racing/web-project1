# ShopInfoからPermitを取得する外部キーを確認・修正する

## 進捗（2026-10-15・完了）

- Permitモデルの `shop_info_id` カラム定義を正として、ShopInfo.hasMany(Permit)のforeignKeyを `shop_info_id` に修正。
- 関連名 `Permit` とhasManyを維持。カラム定義の変更はなく、既存migrationも同じ外部キーを定義しているため新規migrationは不要。
- server全体lint・typecheck通過。DB接続なしで双方向の外部キー、生成SQLのJOIN条件、所有者条件、関連ファイルの有無・nullを確認。
- DBクエリ・migrationは実行していない。

## 問題の概要・原因（修正前）

`ShopInfo.hasMany(Permit)` のforeignKeyが `permit_id` になっている。
Permitの明示的なカラム定義と逆方向の `Permit.belongsTo(ShopInfo)` は `shop_info_id` を使用しており、一致していない。
許可証取得で意図しないJOIN条件になり、SQLエラーや取得漏れにつながる可能性がある。DBの実態は未確認。

## 修正方針・実装内容

- Permitモデル、既存migration、現在のDB仕様を確認し、正しい外部キーを確定する。
- ShopInfo側の関連定義を正しいキーに合わせ、双方向の関連を確認する。
- DB変更が必要な場合のみ新しいmigrationを用意し、実行はしない。
- 関連名 `Permit` と配列の件数を維持し、ShopInfoの所有者条件と許可証・添付ファイルの取得を確認する。
- serverのlint・typecheckを実行する。

## 対象・参照ファイル

- `server/src/models/shop_info.ts`
- `server/src/models/permit.ts`
- `server/src/services/shopInfo/query.ts`
- `server/src/usecases/shopInfo/get/getFile.ts`
- `server/migrations` 内のpermit関連定義

## 実装時の注意事項

関連プロパティ名の統一作業中に発見した別件。DBクエリ・migrationは実行していない。
既存migrationを変更せず、実DBの状態が不明なままカラム削除などを行わない。
