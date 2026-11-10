# getItemLikeList 詳細設計

基本設計: [商品リスト取得API設計](../../getItemList.md)

## 1. 概要

`/item-list/like`向けに、認証本人が所有するitem_likeから参照されているitemの一覧を取得する。
DB変更・通知・S3操作・既存一覧APIの置換・フロント変更は行わない。
正常・失敗ともDBデータは変更しない。

## 2. API仕様

- GET `/api/item-like/item-list`。routes/index.tsの`/api/item-like`登録とRouterの`/item-list`を使用。
- body不要。成功レスポンスはapplication/json、200。
- authenticateToken → getLikeItemListRateLimit → validateQuery(getLikeItemListQuerySchema) → getLikeItemListController。
- params検証・ItemLikeIDによる認可はない。
- 認証本人単位（`admin:${userId}`）で60000msに50回。専用インスタンス、standardHeaders=true、legacyHeaders=false。
- 認証後の400・500も計上。未認証は非計上。不正JSONは共通parserで先に拒否され非計上。
- 51回目から429、express-rate-limit既定本文とRateLimit/Retry-Afterヘッダー。窓終了後に再受付。

### 入力

例: `GET /api/items/list/stock?page=7&status=active&keyword=シャツ`
