# getItemLikeList 詳細設計

基本設計: [商品リスト取得API設計](../../getItemList.md)

## 1. 概要

`/item-list/like`向けに、認証本人が所有するitem_likeから参照されているitemの一覧を取得する。
DB変更・通知・S3操作・既存一覧APIの置換・フロント変更は行わない。
正常・失敗ともDBデータは変更しない。

## 2. API仕様
