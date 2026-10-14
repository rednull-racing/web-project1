## 概要

/server/src/models配下のファイルをコーディング規約に即してリファクタしてください。

## modelファイルの場所

/server/src/models

## 変更ルール

/server/src/modelsにあるAGENTS.mdをよく読み、/docs/codingRule/backend/model.mdにあるコーディング規約に即して、/models配下のファイルの、主にinit()のカラム定義の部分をリファクタしてください。

### 編集しなくてよいファイル

/server/src/models配下以外のファイルは編集しないでください。

また、/models配下でも以下のファイルは既にリファクタ済みなので編集しないでください。

- coupon.ts
- coupon_user.ts
- coupon_item.ts
- coupon_shop.ts
- coupon_category.ts
- purchase_session.ts

/models配下の以下のファイルも今回のリファクタとは関係ないので編集しないでください。

- index.ts
- AGENTS.md

## 最後にセルフレビュー

実装後に以下をセルフチェックしてください。

- AGENTS.mdやコーディング規約のルールを順守しているか
- sequelizeのmodelの構文として破綻していないか
- すでにリファクタ済みのファイルと比べて書き方に差が無いか
- /server/src/models以外のファイル、または上記の編集しなくてよいファイルに変更がなされていないか

---

注：AGENTS.md作ったからよく読んどいて！ルートディレクトリにも/models配下にも作ったよ！😊
