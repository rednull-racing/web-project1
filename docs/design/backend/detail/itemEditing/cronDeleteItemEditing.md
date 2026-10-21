# cronDeleteItemEditing 詳細設計

基本設計: ../../itemUpload.md

## 1. 概要

作成（CreatedAt）から3日経過した商品編集セッション（item_editing）を毎日昼12時にcronで削除する。

3日経過した商品編集セッション（item_editing）は、もう編集しておらず放置されたものとみなす。

処理途中で失敗した場合は、商品編集セッション（item_editing）の削除を取り消し、削除途中で失敗した場合は同一トランザクション内で削除された削除済みデータを復元する。

## 2. cron仕様

- 実行日時: 毎日昼12時（"0 12 * * *"）
- timezone: "Asia/Tokyo"

### 分類名称

- 大分類: itemEditing
- 小分類: cronDeleteItemEditing

### ファイル・関数名

/server/src

- cron index: /cron/index.ts（既存）
- cron 本体: /cron/itemEditingDelete.ts（新規）
- usecase: /usecases/itemEditing/cronDeleteItemEditing.ts
    - cronDeleteItemEditingUseCase（新規）
- service: /services/itemEditing/command.ts
    - cronDeleteItemEditing（新規）

### cron コンソールログ

- 成功時

```ts
console.log(`[cron] ${deleteCount}件の3日経過ItemEditingを削除しました。`);
```

- 失敗時

```ts
console.log(`[cron] ItemEditing削除エラー`, err);
```

### 三行コメント（cronの場合は例外で1行）

```ts
// cron 3日経過ItemEditing削除
```

## 3. 認証・認可

無し

## 4. 処理フロー

### 処理フロー図

## 5. DB操作仕様

### 参照テーブル

- item_editing

### 編集テーブル

- item_editing

## 6. トランザクション設計

すべてのitem_editing削除を同一トランザクションに置く。

### 成功時・失敗時

### 排他制御

## 7. エラー設計

## 8. テスト設計

## 9. 未決定事項
