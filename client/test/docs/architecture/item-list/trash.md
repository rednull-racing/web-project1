# 削除した商品一覧 テスト設計

## 対象・根拠・確定範囲

対象 `/item-list/trash`。パスは原則client基準、E2Eはリポジトリルートのtest基準。[ページ仕様](../../../../src/app/item-list/trash/AGENTS.md)、対象本番コード、[テスト規則](../../../AGENTS.md)、[設計書規則](../AGENTS.md)、[レポート規則](../../report/AGENTS.md)、frontend-testスキルに従う。

API根拠はリポジトリルート `server/src/{routes,controllers,usecases,services}/itemTrash/`、`docs/design/backend/detail/itemTrash/getItemTrashList.md`。GET `/api/item-trash/list` は本人seller_id限定、name/title部分一致、createdAt DESC/id DESC、20件、wrapped配列・数値ID・ISO日時、totalPagesは切上げ（空0）。一覧を読むだけでDB変更・S3操作はない。

**仕様差の扱い**：metadataの「最近1か月以内」と異なり、現行取得条件に期間制限はない。E-X01は実取得契約の観測とし、説明文変更や期間フィルター追加は実行せず修正案へ残す。過去のユーザー指定によりdraft以外のpriceはnull不可、number|stringとする。APIモデルのnull許容を理由にtrashへ「-」補完を追加しない。実データでnullが発生する場合の扱いは未確定であり提案に残す。

## 責務・実行境界・予定配置

| 対象 | 責務 | 単体予定配置 |
| --- | --- | --- |
| `src/app/item-list/trash/page.tsx` | async Pageはタイトル「削除した商品」とTrashItemListをItemListUIへ。metadataを返す。自身でfetchしない | `src/app/item-list/trash/test/page.test.tsx` |
| 同 `trashItemList.tsx` | 入力中/確定語/ページを管理しURL→SWR→行とPaginationまたは空表示 | 同 `test/trashItemList.test.tsx` |
| 同 `trashItem.tsx` | wrapped要素から渡された商品を描画、削除日時、詳細Link、画像・価格Props。mutateは未使用 | 同 `test/trashItem.test.tsx` |
| 同 `api/client.ts` | base＋page、trim/encode keyword、共通fetcher再export | 同 `api/test/client.test.ts` |

単体はVitest/RTL/jsdom、SWR・子部品・日時関数を対象に応じて境界モック。PageはawaitしてReact要素とmetadataを検査し、async Pageを直接RTL renderするために本番境界を変えない。子の全分岐は既存[共通部品](./_components.md)・[共通枠](./common.md)へ委譲する。

結合予定は `test/integration/components/item-list/trash/trashItemList/`、ページ結合は `test/integration/pages/item-list/trash/`、fixtureは `test/fixtures/item-list/trash/`。実SWR・一覧・行・子・共通fetchを通しHTTPはMSW、token取得と画像最適化・Next router等の外部境界だけを置換する。実際の取得JSONと異なる平坦fixtureは使わない。

E2E予定は `test/E2E/item-list/trash/{getItemTrashList,authorization}/flow.spec.ts`（リポジトリルート基準）、専用fixtureは `test/fixtures/item-list/trash/`。実NextAuth→production Next→実Express→隔離PostgreSQLとし、対象APIのモック・レスポンス変換・ルート補正は行わない。共通の既存DBガードを参考に、trashで使うschemaを検査する。DB整備・migration/syncは実行しない。

## fixture・状態・共通アサーション

- 標準は `{itemTrashList:[{itemTrash:{id:101,name:"検証用商品",price:1200,first_image_url:"/item.jpg",title:"動画A",createdAt:"2026-11-11T23:00:00.000Z"}}],totalPages:3}`。価格"1200"も同じ1,200円表示。name/title/image nullと空文字、空配列totalPages0、未取得、HTTP失敗を差分fixtureとする。
- 日時単体はformatRelativeTimeへのISO引数を確認。実関数の境界は既存単体へ委譲し、結合では必要に応じ固定時計を使う。未取得と空を区別し専用Loading/エラー表示を発明しない。
- SWR cacheはケースごとにMap。focus/reconnect/retry/dedupeの設定を明示し業務操作と自動再試行を混同しない。deferredでA/B応答順を制御し、開始した処理は解放する。固定sleepなし、操作・非同期assertはawait。
- DOMはrole・placeholder・テキスト・href、必要なclassだけCSS Modules importを使う。内部state・巨大snapshotに依存しない。共通setupと分担してDOM/handler/spy/時計/環境変数を復元する。
- E2EはA21件・B・所有者null、nameだけ/titleだけ一致・不一致・%文字、同時刻ID違い、1か月超の行を用意。保存列は入力正規化と照合できる値にする。前後snapshotで全保護対象不変を確認し、作成IDと所有者で限定cleanup。接続先とcurrent_database=test_dbを検証し、ガードが失敗したらseed前に停止する。秘密値は出力しない。

U/C/P/Eは単体/コンポーネント結合/ページ結合/E2E、Oは人間観測、Xは現状観測。P0は基本契約・所有権、P1は補完。列挙条件を独立テストへ展開し、ID数と実行件数を分ける。

## 単体ケース

| ID・優先度 | 条件・操作 | 期待結果 |
| --- | --- | --- |
| U-M01 P1 | Page/metadataをawait | ItemListUIのtitle・子、metadata title「削除した商品一覧」、所定説明、robots.index/follow=false。Page通信なし |
| U-A01 P0 | page1/2、検索なし・空・半全角空白・日本語前後空白・予約文字 | 正規URL、非空だけtrim後1回encode、入力不変 |
| U-A02 P1 | base末尾slash有/無、page0/-1/1.5、文字列null、fetcher実体 | 現行連結と未検証pageを観測、同一fetcher再export。通常入力契約や実API成功と混同しない |
| U-L01 P0 | dataなし/空/複数、totalPages0/1/3 | 未取得は検索欄のみ、空だけ空案内、複数はwireをunwrapし順序・mutateを保持、Paginationへ現在1と総数 |
| U-L02 P0 | page3から非空文字を入力 | page1へ、入力更新、確定済みの旧keywordを維持 |
| U-L03 P0 | 入力後Enter/アイコン送信 | 確定keyword更新・page1。非空入力だけでは新keyword取得なし |
| U-L04 P0 | 確定検索中に空/半全角空白 | keyword解除・page1、入力そのものの空白は維持 |
| U-L05 P1 | error＋dataなし/前回dataあり | 専用エラーなし、あるdataを表示。独自のlogin遷移等なし |
| U-I01 P0 | 標準行と子spy | `/item/deleted/101`、削除日時にcreatedAt、image status:null/showSold:false、priceはsaleなしと割引0。未使用mutate呼出なし |
| U-I02 P1 | name/title/image nullまたは空文字 | 名/title空補完、imageへnullable URL渡し代替表示は子責務 |
| U-I03 P0 | number/string価格、price型 | 数値と数値文字列を表示側で扱い、null価格は型で許容しない。0も欠損として消さない |

## 結合ケース

| ID・優先度 | 操作・注入 | 期待結果 |
| --- | --- | --- |
| C-N01 P0 | 正規GETとwire、価格number/string、nullable文字 | Bearer GET、数値ID href、ISO日付、商品名・価格と代替画像。復元/完全削除操作や更新HTTPなし |
| C-N02 P0 | 入力→送信→page2 | 確定前に新keywordを送らず、trim/encode検索page1、次にpage2 |
| C-N03 P0 | 検索page2で入力、次に空白 | 旧検索page1へ戻り、空白でkeywordなしpage1 |
| C-E01 P1 | 遅延GET→空配列 | 待機中空案内なし、応答後だけ空案内、page UIなし |
| C-E02 P0 | JSON401/500・非JSON429・network error、その後正常再取得 | 専用エラー表示や成功行の捏造なし、正常な再取得で回復。実認証切れの検証とは分ける |
| C-E03 P1 | Aを遅延→B成功→A解放 | 現在のB入力・キー・表示をAが上書きしない |
| P-N01 P1 | 実ItemListUI＋一覧 | タイトルと一覧接続、Backはrouter.back要求まで |
| P-N02 P1 | 実枠で空/遅延 | 空と未取得を区別。SSR/実トースト/実レイアウトの保証なし |

## E2Eケース

| ID・優先度 | 操作・前提 | 期待結果・停止位置 |
| --- | --- | --- |
| E-N01 P0 | Aでログインし21件一覧 | GET200、20件・totalPages2、createdAt DESC/id DESC、本人のみ、画面の正しいIDリンクと価格。DB不変。最初に実行し前提失敗時は後続保留 |
| E-N02 P0 | page2、name/title/0件/%検索 | JSONとDB条件が一致、page2残1件、空totalPages0、状態不変 |
| E-S01 P0 | sessionなし要求、認証後access-token除去で再取得 | 前者login redirect・保護情報なし、後者実401・保護データなし。UI独自logoutは要求しない |
| E-S02 P0 | seller_id等のqueryでBを指定 | 認証Aの一覧/件数だけ、Bやowner nullを返さない、DB不変 |
| E-X01 P1 | 1か月超の本人データ | 現APIは期間条件がないので取得される現状を観測。説明文との矛盾は修正案へ。自動でフィルター追加しない |

APIの全query境界・レート50/51回・transaction snapshotの網羅は既存serverテスト担当。本E2Eは接続・代表認可・DB不変の追加保証に絞る。詳細先への実遷移は目視で、一覧のhref契約を検証済みと区別する。

## 人間観測と実行順序

O01：担当「人間」、状態「人間確認待ち」。Chromium/Firefox/WebKit、ログインA、幅359/375/768/1280、長い名前/動画名・画像有無の一覧で行と価格・日時の見え方を確認。検索・ページ操作・詳細リンク・戻る、キーボードのフォーカスと実画面遷移を観測。レポート `test/docs/report/item-list/trash.md` へ結果記録。自動成功に含めない。

代表単体→結合の正規GET→E2Eの環境/認証/schema→E-N01→後続の順。環境不成立は本体未実行・後続保留として記録し、独立した単体/結合は進める。仕様変更が必要な修正は実行せずレポートへ提案して終了。修正時は対象と影響回帰だけを再実行し、新しい変更・疑問がなければ反復しない。

client/で予定：

```bash
npm run test:unit -- src/app/item-list/trash/test/ src/app/item-list/trash/api/test/
npm run test:integration -- test/integration/components/item-list/trash/ test/integration/pages/item-list/trash/
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

test/で予定：`npm run test:e2e -- E2E/item-list/trash/ --project e2e-chromium` と `npm run typecheck`。環境準備はリポジトリルート `test/README.md`。Node・lint/型設定は実構成を確認する。本番tsconfigのsrc内test包含と、結合/設定も含むtest用tsconfigを区別する。通常lint対象外のE2E TSは既存ESLint設定で明示検査する。

設計ID・assert・実行JSONとリンクを照合し、実装・実行済みと未実装・未実行・失敗・中断を分ける。自動検証完了とO01未確認、既存の全体診断を別判定とし、単体/結合成功だけで実E2E完了と扱わない。
