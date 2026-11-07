# getItemDraftList 詳細設計

基本設計: [商品リスト取得API設計](../../getItemList.md)

## 1. 概要

`/item-list/draft`向けに、認証本人が所有するitem_draftの一覧を取得する。
DB変更・通知・S3操作・既存一覧APIの置換・フロント変更は行わない。
正常・失敗ともDBデータは変更しない。

## 2. API仕様

- GET `/api/item-draft/list`。routes/index.tsの`/api/item-draft`登録とRouterの`/list`を使用。
- body不要。成功レスポンスはapplication/json、200。
- authenticateToken → getItemDraftListRateLimit → validateQuery(getItemDraftListQuerySchema) → getItemDraftListController。
- params検証・下書きIDによる認可はない。
- 認証本人単位（`admin:${userId}`）で60000msに50回。専用インスタンス、standardHeaders=true、legacyHeaders=false。
- 認証後の400・500も計上。未認証は非計上。不正JSONは共通parserで先に拒否され非計上。
- 51回目から429、express-rate-limit既定本文とRateLimit/Retry-Afterヘッダー。窓終了後に再受付。

### 入力

例: `GET /api/item-draft/list?page=7&keyword=シャツ`

| query   | 契約                                                                                                        |
| ------- | ----------------------------------------------------------------------------------------------------------- |
| page    | 省略時1。単一文字列をnumberへcoerce、整数1〜10000。空文字・小数・範囲外・配列・オブジェクトは400            |
| keyword | 任意の単一文字列、文字数制限なし。前後空白を除去。省略・null・空文字・空白のみ・URLの文字列`null`は検索なし |

未知キーは除去し、`req.validatedQuery`のみをcontrollerで採用する。userId/seller*idの偽装は採用しない。
keywordはusecaseで既存の`normalizeJapanese()`を使用する（依頼中のnormalizeJapanizeに対応する現行関数名）。
NFKC・小文字化・カタカナ→ひらがな・空白除去後、nameまたはtitleのILIKE部分一致。
正規化するのは入力のみ。保存済みカラムの正規化・書換えは行わない。
`%`・`*`・バックスラッシュはエスケープして文字として検索する。nullの検索対象列は一致しない。

### 担当ファイル（server/src基準）
