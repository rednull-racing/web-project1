# /item/draftページ

## 概要

下書き商品データ（`ItemDraft`）を使い、保存した商品の内容を確認し、編集の再開や下書きの削除を行うページ。

対象ルートは `/item/draft/[id]` の1つ。`id` は下書きID（`itemDraftId`）であり、編集開始APIが返す商品編集ID（`itemEditingId`）とは区別する。

この文書では `draft` 配下のページ・専用コンポーネント・API・CSSを説明する。共有コンポーネントは構成図の参照先として示し、詳細は各配置先のAGENTS.mdで扱う。

### 現在の実装と今後の方針

- 実装済み：ルートでの認証・所有者照合・データ取得、`ItemDraftPage` の枠組み、編集開始・削除操作。
- 未実装：`draft/videoSection.tsx` と `draft/itemSection.tsx` は空ファイル。`ItemDraftPage` 内にも配置されておらず、`main` 内はコメントのみ。
- 今後の方針：`../confirm/AGENTS.md` と確認画面の専用セクションを参考に、下書きデータを共有部品へ渡す専用セクションを実装する。以下の「実装予定」は設計方針であり、現在の表示動作を示すものではない。

---

## 各コンポーネントの役割

### コンポーネント構成図

図中のパスは `client/src/app/item/` を基準とする。実線は包含関係、点線は操作先を示す。実装予定の図は現行構成と分けて記載する。

#### ページ全体（現行）

```mermaid
flowchart TD
    Route["/item/draft/[id]<br/>draft/[id]/page.tsx"]
    Page["ItemDraftPage<br/>draft/itemDraftPage.tsx"]
    Container["Container（共通）<br/>@/components"]
    Top["EditButton（上部）<br/>draft/editButton.tsx"]
    Main["main<br/>動画・商品セクションは未配置"]
    Bottom["EditButton（下部）<br/>draft/editButton.tsx"]
    Delete["DeleteItemDraft<br/>draft/delete.tsx"]

    Route --> Page
    Page --> Container
    Container --> Top
    Container --> Main
    Container --> Bottom
    Container --> Delete
```

ルートはセッションを確認し、`draft/api/server.ts` の `fetchItemDraftPage` で取得した下書きの所有者を照合する。表示時は `ItemDraftPage` に `id` と `itemDraft` を渡す。ページ用の `page` 引数は存在しない。

#### 動画セクション（実装予定）

```mermaid
flowchart TD
    Video["VideoSection（実装予定）<br/>draft/videoSection.tsx"]
    Elem["VideoElem（共通）<br/>videoSection/videoElem.tsx"]
    Title["VideoTitle（共通）<br/>videoSection/videoTitle.tsx"]
    Peek["ItemPeek（共通）<br/>videoSection/itemPeek.tsx"]
    Date["保存日時（HTML要素）"]
    Summary["Summary（共通）<br/>videoSection/summary.tsx"]
    Target["ItemHeader 内の商品名"]

    Video --> Elem
    Video --> Title
    Video --> Peek
    Video --> Date
    Video --> Summary
    Peek -.->|クリックでスクロール| Target
```

`confirm/videoSection.tsx` を参考に、共有部品へ下書きの動画・商品情報を渡す。動画には `normalPage={false}`、概要には `page="draft"` と `itemId: null` を指定する方針。共有部品自体の詳細は記載対象外。

#### 商品セクション（実装予定）

```mermaid
flowchart TD
    Item["ItemSection（実装予定）<br/>draft/itemSection.tsx"]
    Slide["Slideshow（共通）<br/>itemSection/slideshow.tsx"]
    Header["ItemHeader（共通）<br/>itemSection/itemHeader.tsx"]
    Variants["VariantsList（共通・条件付き）<br/>itemSection/variantsList.tsx"]
    Detail["Detail（共通）<br/>itemSection/detail.tsx"]
    Category["CategoryText（共通）<br/>itemSection/categoryText.tsx"]
    Delivery["DeliverySection（共通）<br/>itemSection/deliverySection.tsx"]

    Item --> Slide
    Item --> Header
    Item --> Variants
    Item --> Detail
    Item --> Category
    Item --> Delivery
```

`confirm/itemSection.tsx` を参考に、共有部品へ下書きの商品・配送情報を渡す。商品ヘッダーと商品説明には `page="draft"`、商品説明の `itemId` には `null` を指定する方針。

#### 編集・削除操作（現行）

```mermaid
flowchart TD
    Edit["EditButton<br/>draft/editButton.tsx"]
    Upload["/upload/[itemEditingId]"]
    Delete["DeleteItemDraft<br/>draft/delete.tsx"]
    Open["この下書き商品を削除する（HTML要素）"]
    Popup["削除確認ポップアップ（popup が true）"]
    Close["オーバーレイ・X<br/>ポップアップを閉じる"]
    Submit["削除するボタン（HTML要素）"]
    MyPage["/my-page"]

    Edit -.->|編集開始APIの成功後| Upload
    Delete --> Open
    Delete --> Popup
    Open -.->|クリックで表示| Popup
    Popup --> Close
    Popup --> Submit
    Submit -.->|削除APIの成功後| MyPage
```

### ItemDraftPage

`draft/itemDraftPage.tsx`。`id`（下書きID）と `itemDraft`（表示データ）を受け取り、ページ全体を組み立てる。

- `Container` 内に上部編集ボタン、`main`、下部編集ボタン、削除操作を順に配置する。
- 現行コードで `attributes.inventory?.current === 0` を `soldout` として算出しているが、セクションが未配置のため未使用。
- 今後は `main` に `VideoSection` と `ItemSection` を配置し、`itemDraft` と `soldout` を渡す方針。編集・削除操作には引き続き下書きIDを渡す。

### VideoSection（実装予定）

`draft/videoSection.tsx`。`itemDraft` と `soldout` を受け取り、動画側の共有部品へ必要なデータを渡す役割を持たせる。

- 動画URL・サムネイル、動画タイトル、商品概要、保存日時、動画概要を確認画面と同じ順序で配置する。
- 保存日時は `updatedAt` を `formatRelativeTime` で整形する。
- `summary` が `null` の場合は空文字を渡す。未入力のタイトル・画像・動画URL等の扱いは下書きAPIの実データと共有部品の受け取り条件を確認して実装する。
- 動画の再生・概要の展開は下書き表示として扱うため、前述の `normalPage`・`page`・`itemId` を明示する。

### ItemSection（実装予定）

`draft/itemSection.tsx`。`itemDraft` と `soldout` を受け取り、商品側の共有部品へ必要なデータを渡す役割を持たせる。

- 商品画像、商品ヘッダー、バリエーション、商品説明、カテゴリー、配送情報を確認画面と同じ順序で配置する。
- `attributes.colorVariants` が1件以上ある場合だけ `VariantsList` を配置する。
- 説明やカテゴリー名がない場合は空文字、配送関連の選択肢名がない場合は `"-"`、割引率・割引額が `null` の場合は `0` を渡す方針。
- 未入力価格は表示用に `price ?? "-"` へ整形し、商品ヘッダーと動画側の商品概要で統一する方針。価格 `0` と未入力を混同しない。
- 現行の `ItemDraft.price` は `number` 型。`null` を受け取る想定と型定義が一致していないため、実装時にAPIレスポンスを確認し、必要な型と値の補完を揃える。現時点ではこの表示処理も未実装。

### EditButton

`draft/editButton.tsx`。下書きIDを受け取り、編集開始APIを呼ぶClient Component。

- 「編集する」ボタンをページの上下に配置する。
- `loading` が `true` の場合は再実行を止め、ボタンを無効化する。状態は各ボタンのインスタンスごとに管理する。
- 成功時はレスポンスの `itemEditingId` を使って `/upload/${itemEditingId}` へ遷移する。
- 失敗時はエラートーストを表示し、`loading` を解除して再操作できるようにする。

### DeleteItemDraft・削除確認ポップアップ

`draft/delete.tsx`。下書きIDを受け取るClient Component。ポップアップはこのファイル内で描画する。

- 「この下書き商品を削除する」のクリックで `popup` を `true` にし、削除確認を表示する。
- オーバーレイまたは閉じるアイコンで確認を閉じる。「削除する」ボタンで削除APIを呼ぶ。
- 成功時はトーストを表示して確認を閉じ、1.5秒待って `/my-page` へ遷移する。
- `ApiError` はエラートースト、それ以外の例外はアラートで通知し、いずれも確認を閉じる。

---

## API

APIパスは共通fetch関数へ渡す相対パスを記載する。下書きIDは表示取得・編集開始・削除の入力に使い、商品編集IDは編集開始後の遷移に使う。

### SSR 下書きデータ取得

`draft/api/server.ts` の `fetchItemDraftPage(itemDraftId)` をルートのServer Componentから呼ぶ。

| 項目 | 内容 |
| --- | --- |
| 共通関数 | `apiFetchServer`（`@/lib/api/server`） |
| メソッド・パス | `GET /item-draft/${itemDraftId}` |
| キャッシュ | `cache: "no-store"` |
| 戻り値の型 | `{ itemDraft: ItemDraft }` |

未ログインなら `/login` へ遷移する。取得後、セッションのユーザーIDと `itemDraft.seller_id` を文字列化・前後の空白除去後に照合し、不一致なら `/` へ遷移する。一致した場合だけ `ItemDraftPage` を表示する。

現行の `generateMetadata` は `/item/api/server.ts` の `fetchItemMetadata(id)` を呼び、商品名に「下書き」を付けたタイトル・説明と、`robots` の `index: false`・`follow: false` を設定する。この関数は商品ID用の `/items/${id}/metadata` を参照するため、下書きIDによる表示取得とは別の経路になっている。今後の実装時は下書き用データとの整合を確認する。

### CSR 編集開始・下書き削除API

`draft/api/client.ts` の各関数を、対応する操作コンポーネントから呼ぶ。共通関数は認証付きの `apiFetch`（`@/lib/api/client`）を使う。

| 関数 | 呼び出し元 | メソッド・パス | 本文・戻り値 |
| --- | --- | --- | --- |
| `fetchEditDraftItem(itemDraftId)` | `EditButton` | `POST /item-editing/draft` | 本文：`{ itemDraftId: Number(itemDraftId) }` をJSON化。戻り値の型：`{ itemEditingId: number }` |
| `fetchDeleteDraftItem(id)` | `DeleteItemDraft` | `DELETE /item-draft/${id}` | 本文なし。呼び出し元ではレスポンス値を使用しない |

削除関数の現行の引数名は `itemId` だが、渡している値は下書きID。下書き画面から直接商品作成・商品更新APIは呼ばない。

### 表示データの型

`draft/types.ts` に `ItemDraft` と関連する選択肢・カテゴリー等の型を定義する。商品・動画・セール情報は `ItemDraft` の各フィールド、バリエーションや在庫等は共通の `ItemAttributes` 型を使用する。

`page` は `ItemDraftPage` の引数には存在しない。今後、共有部品へ渡す場合は専用セクション側で `"draft"` を指定する。下書きは未入力データを扱うため、`confirm/types.ts` をそのまま前提にせず、APIが返す欠損・`null` と表示用の値を照合する。

---

## デザイン・CSS

### draftページ専用CSS

`draft/draft.module.css` を現行の `EditButton`・`DeleteItemDraft` から使用する。

| 対象 | 主なクラス | 使用状況 |
| --- | --- | --- |
| 編集ボタン | `editButton` | 使用中 |
| 削除操作 | `deleteText` | 使用中 |
| 削除確認・背景・閉じる操作 | `popup`、`overlay`、`x`、`popupTitle` | 使用中 |
| 確認文・削除実行ボタン | `text13`、`popupButton` | 使用中 |
| 保存日時 | `dateFlex`、`countText`、`countNumber` | 定義済み。動画セクションは未実装 |

背景と確認ポップアップは `position: fixed` で重ねて表示する。`draft` 直下のファイルからのインポート例：

```ts
import styles from "./draft.module.css";
```

### itemページ共通CSSの利用

`ItemDraftPage` は `item/itemCommon.module.css` の `main2column` を使用する。画面幅768px以上で最初と最後の子要素を6:4の比率で横並びにし、それ未満では通常の縦並びとなる。現行の `main` 内に表示要素はなく、両セクション配置後にこのレイアウトを利用する。

`draft` 直下のファイルからのインポート例：

```ts
import CStyles from "../itemCommon.module.css";
```

`VideoSection`・`ItemSection` での共通CSSの参照は今後実装する。共有コンポーネント内部のスタイルは各配置先で管理する。
