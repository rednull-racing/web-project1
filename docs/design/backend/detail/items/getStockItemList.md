# getStockItemList 詳細設計

基本設計: [商品リスト取得API設計](../../getItemList.md)

## 1. 概要

`/item-list/stock`向けに、認証本人が所有するitemの一覧を取得する。
DB変更・通知・S3操作・既存一覧APIの置換・フロント変更は行わない。
正常・失敗ともDBデータは変更しない。

## 2. API仕様

- GET `/api/items/list/stock`。routes/index.tsの`/api/items`登録とRouterの`/list/stock`を使用。
- body不要。成功レスポンスはapplication/json、200。
