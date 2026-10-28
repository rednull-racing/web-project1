# itemDraftPage テスト設計書

## 1. 対象・目的・仕様の根拠

- ページ大分類：`item`、ページ小分類：`itemDraftPage`。対象ルート：`/item/draft/[id]`。依頼の `client/sec` は実配置の `client/src` として扱う。
- 目的：下書き表示、未入力値の補完、編集再開、削除、認証・所有者照合を確認し、重複操作・非同期の失敗・利用不能な操作を検出する。
- 今回は設計書のみ作成する。テストコード実装・テスト実行・本番コード修正・依存追加・DB操作は行わない。下記のファイル配置・コマンドはすべて将来の予定。
- 根拠：[テスト全体規則](../../../AGENTS.md)、[設計書規則](../AGENTS.md)、[ページ仕様](../../../../src/app/item/draft/AGENTS.md)、同ディレクトリの現行実装。
- API・DBの根拠（リポジトリルート基準）：`docs/design/backend/detail/itemEditing/createItemEditingDraft.md`、`docs/design/backend/detail/itemDraft/deleteItemDraft.md`、対応する `server/src` の実装・Model。書式・バックエンド検証との分担は `server/test/docs/architecture/itemEditing/createItemEditingDraft.md`、`server/test/docs/architecture/itemDraft/deleteItemDraft.md` を参照する。
- 共通部品も、このページで使用する入力・操作について単体テストを設計する。他ページ専用分岐、購入・公開・アップロード保存、バックエンド全分岐の再検証は対象外。
- `GET /item-draft/:id` は未実装。[既存Todo](../../../../../docs/todo/P1-bug/implement-item-draft-detail-api.md)を参照する。取得APIを実装済みと仮定してE2E完了としない。

### 1.1 期待値の優先関係

ユーザーの追加指示に基づき、問題のある現行実装を正解として固定しない。重複送信防止、操作の排他、在庫表示、キーボードでの操作性は以下の検出ケースとして明文化する。現状で満たさないと考えられるケースも通常の失敗するassertとして実装する。`skip`・`todo`・期待された失敗への変換、APIを1回しか呼ばせないモック、操作後の実測値をそのまま期待値にする方法で隠さない。

現行のページ仕様・API契約に基づくケースと、追加指示を具体化した品質要件を区別する。後者の詳細なUI方式は固定せず、利用者から見た結果を検証する。業務上未確定の閾値・性能目標は勝手に発明せず、未確認事項へ残す。

## 2. 関連ファイル・責務・処理境界

この文書の `src/`・`test/integration/`・`test/fixtures/` は **client/基準**。E2E章の `E2E/`・`fixtures/` は **リポジトリルートのtest/基準**。その他は明記する。

| ファイル（client/基準） | 責務・順序・検証境界 |
| --- | --- |
| `src/app/item/draft/[id]/page.tsx` | params解決→セッション→取得→所有者照合→本文／メタデータ。未認証は/login、所有者不一致は/。React cacheを共有 |
| `src/app/item/draft/itemDraftPage.tsx` | Container→上編集→main（動画・商品）→下編集→削除。current===0だけsoldout |
| `src/app/item/draft/videoSection.tsx` | 動画・タイトル・商品概要・保存日時・Summaryへの変換と補完 |
| `src/app/item/draft/itemSection.tsx` | 画像・ヘッダー・バリエーション・説明・カテゴリー・配送への変換と補完 |
| `src/app/item/draft/editButton.tsx` | POST成功後、返却itemEditingIdで/uploadへ。失敗トーストと再操作。現行loadingは各インスタンス単位 |
| `src/app/item/draft/delete.tsx` | 確認を開閉→DELETE→成功通知・閉じる→1500ms後/my-page。ApiErrorはトースト、その他はalert |
| `src/app/item/draft/api/client.ts` | fetchEditDraftItem：POST /item-editing/draft、JSONの数値ID。fetchDeleteDraftItem：DELETE /item-draft/:id、bodyなし |
| `src/app/item/draft/api/server.ts` | fetchItemDraftPage：共通server fetchへGET相当・no-store。未実装APIのHTTP応答はテスト境界で代替 |
| `src/app/item/videoSection/{videoElem,videoTitle,itemPeek,summary}.tsx` | メディア、見出し、商品説明へのスクロール、概要開閉。VideoTitleは非同期Server Component |
| `src/app/item/itemSection/{slideshow,itemHeader,itemName,variantsList,detail,categoryText,deliverySection}.tsx` | 画像拡大、商品名・価格・セール・属性、バリエーション、説明、配送・在庫・素材 |
| `src/components/container/container.tsx`、`src/lib/formatRelativeTime.ts` | ページの子要素保持、保存日時整形 |
| `src/lib/api/{client,server,apiError}.ts` | 認証、HTTP・JSON、例外変換。clientは非2xxをApiError、通信／JSON失敗は通常例外。serverは401→login、404→notFound、その他throw |

編集開始のDB境界は下書き取得・ロック→編集行作成・コピー→下書き削除→commit→201。削除は取得・ロック→対象物理削除→commit→200/JSON。フロントはcommit済みの応答後に成功扱いとする。下書きIDと編集IDを混同しない。

## 3. レベル・予定配置・実処理と代替

| レベル | 予定配置 | 実処理／代替・保証の限界 |
| --- | --- | --- |
| U：単体 | `src/app/item/draft/test/{itemDraftPage,videoSection,itemSection,editButton,delete}.test.tsx` | 対象コンポーネントを実行。子部品・API関数・router・通知を境界でモック。props変換、順序、状態、停止を確認。HTTP・実遷移は保証しない |
| U：API | `src/app/item/draft/api/test/{client,server}.test.ts` | ページ専用wrapper実処理、共通fetchをモック。共通fetchとの接続はC/Pで確認 |
| U：共有UI | `src/app/item/videoSection/test/{videoElem,itemPeek,summary}.test.tsx`、`src/app/item/itemSection/test/{slideshow,itemHeader,itemName,variantsList,detail,categoryText,deliverySection}.test.tsx`、`src/components/container/test/container.test.tsx` | 各対象を実行。Hls・Swiper・next/imageは必要最小の代替。Swiperの実スワイプやレイアウトはBへ。ItemHeaderの子ItemNameは単体ではモック可 |
| U：日時 | `src/lib/test/formatRelativeTime.test.ts` | 実関数、固定時刻。DOM不要のNode環境 |
| C：コンポーネント結合 | `test/integration/components/item/itemDraftPage/{editButton,deleteItemDraft,itemSection}/integration.test.tsx` | UIと専用API・apiFetchを実行、HTTPはMSW。トークン取得だけを境界モック。商品側は実共有部品。routerはモックで遷移要求まで |
| P：DOMページ結合 | `test/integration/pages/item/itemDraftPage/itemDraftPage.test.tsx` | 同期ItemDraftPageと編集・削除・商品側の実部品、MSW。動画側の非同期VideoTitleのみ同期の見出し代替。非同期Server Component／取得・認可・Hydrationの保証には含めない |
| B：ブラウザーページ結合 | `test/integration/pages/item/itemDraftPage/{page,components}.spec.ts` | 起動済みNext.jsで実ルート・全UI・SSRを検証。サーバー発APIはテスト用APIサーバー、ブラウザー発APIはpage.routeで代替。DBなし |
| E：E2E（取得のみ代替） | `E2E/item/itemDraftPage/createItemEditingDraft/flow.spec.ts`、`E2E/item/itemDraftPage/deleteItemDraft/flow.spec.ts`（test/基準） | 編集・削除のHTTP、Express、DBは実処理。未実装GETだけテスト用APIで代替。取得を含む完全E2Eとは区別 |

VideoSection＋実VideoTitleの結合とVideoTitle単独の出力契約はBで検証する。async関数を直接awaitしてRTLへ渡す方法を、Server Componentの実行保証にしない。VideoTitleのために本番を同期／Client Componentへ変更しない。

ページ固有fixture・setupは `test/fixtures/item/itemDraftPage/{fixtures,setup}.ts`。ブラウザー用APIサーバーも同ディレクトリの `apiServer.ts` に予定する。E2Eの認証・seed・DB照会・cleanup・取得代替proxyはルートtest基準 `fixtures/item/itemDraftPage/` に予定する。すべて未作成。共通setup/MSWは既存 `test/fixtures/{setup,server}.ts` を利用する。

### 3.1 共通の検証方法

- role・accessible name・表示テキスト・画像altで要素を選ぶ。現行の閉じるSVG／overlay等に名前がない箇所は、開閉の機能確認に限りDOM構造を補助利用し、アクセシビリティケースでは名前がないこと自体を失敗させる。
- 非同期はdeferred応答で「未完了」を確実に作る。リクエスト数・HTTP method/body・通知・遷移・未実行の後続を別々にassertする。成功時の値だけでなく、完了前に成功扱いしないことを確認する。
- Vitestはfake timersで削除成功後の1499msと1500msを分ける。user-eventと時計を連携し、終了時に復元。ブラウザーでは固定sleepではなく応答・URL・表示を待つ。
- MSWの未定義通信はエラー。ケースごとにhandler、mock、cookie、時間、fixtureを初期化する。SWRを含むlayoutを使う場合はキャッシュも分離する。
- 概要・説明のoverflowはjsdomで寸法を制御し、実clampはBで確認。画像代替が元URLと同じ意味を保つか確認し、画像最適化URLの文字列全体には依存しない。
- APIエラー後は成功通知・成功遷移なし。認証拒否・入力拒否・所有者不一致は対象の更新なし。モック層だけで実DBの無変更・rollback・行ロックを保証しない。

## 4. 標準fixture・変換対応

### 4.1 標準値とケース別変更

| 名前 | 条件 |
| --- | --- |
| F-full | 所有者A=7、他人B=8、下書きID文字列11、応答編集ID456。商品名「下書きシャツ」、タイトル「動画タイトル」、summaryとdetailは別文章。price=800、before_price=1200、discount_rate=25、discount_amount=400、sale_flag=true、recommend=true |
| F-media | 画像3枚、first_image_urlは別の識別可能URL、サムネイル・元MP4・変換m3u8も別URL。短い同梱のテストメディアを使い外部CDNに依存しない |
| F-attrs | inventory：initial=10/current=4/low_stock_ratio=0.2。色2件・サイズ2件、固有uiId・色画像。在庫0/1/閾値上のバリエーション。素材は綿60・ポリエステル40。配送選択肢・カテゴリーは識別可能な別名 |
| F-time | now=2026-10-28T03:00:00Z、updatedAtは1時間前、createdAtは異なる古い日時。日時表示がupdatedAt由来か確認 |
| F-empty | 型が許容する商品・動画・セールの任意値をnull、attributes={}、関連選択肢は省略。gender_type/age_type等の必須値は有効値を保持 |
| F-boundary | 価格null/0/1、画像null/[]/[空文字,有効URL]、colorVariants省略/0/1/2件、inventory省略/current=0/1。商品名・タイトルnull/空文字、summary/detail空文字／長文 |
| F-security | 商品名・概要・説明に `<script>`、`<img onerror=…>` 相当の文字列、引用符、日本語・改行を含める。文字列表示を検証し、任意のHTMLとして実行させない |
| F-http | 成功JSON、400/401/404/429/500 JSON、ネットワークreject、JSON解析失敗、遅延。HTTP 204を成功fixtureに使わない（現DELETEは200/JSON） |

factoryは毎回新規オブジェクトを返す。Uの変換ケースではdeep freezeした入力と事前コピーを使い非破壊を確認。E2Eは実採番IDと有効な参照行を使用し、11/456を固定して既存DB行を使わない。

### 4.2 入力→表示／保存の対応

| 取得元 | 渡し先・期待値 |
| --- | --- |
| inventory.current | 厳密に0でのみ両セクションsoldout=true。省略はfalse |
| name/title、price | 未入力は商品名未入力／タイトル未入力、price=nullだけ「-」、0は0。実共有部品で￥-／￥0 |
| thumbnail_url、original_url、converted_url | サムネイル空値は16:9代替、元動画nullは空文字。変換URL優先、なければ元動画、両方なしは動画なし |
| first_image_url→image_urlの最初の有効値 | ItemPeek、なければ1:1代替。Slideshowはimage_urlの空文字を除外、空なら1:1代替1枚 |
| attributes.colorVariants | 0件は非表示、画像未入力は1:1代替。コピーして元JSONを変更しない |
| summary/detail、Category.name | null／関連なしは空文字。Summary/DetailはnormalPage=false、itemId=null |
| recommend、before_price、discount_rate、discount_amount | nullはfalse／0／0／0。ItemHeader.page=draftのためおすすめ炎アイコンは出さない |
| shipping_service_free_text→ShippingServiceOption.name | 非空自由記述優先、選択肢名、最後に「-」。他配送選択肢未設定も「-」 |
| updatedAt | formatRelativeTimeへ渡す。createdAtと取り違えない |
| 下書き→編集DB行（E） | name/detail/image_url/price/item_condition_id/first_image_url/gender_type/age_type/recommend/category_id/brand_id/brand_aliases_id/attributes、thumbnail_url/title/summary/duration/original_url/converted_url/video_status、before_price/discount_rate/discount_amount/sale_flag、shipping_day_id/shipping_service_id/shipping_place_id/shipping_service_free_textを同値コピー |
| 下書き管理項目→編集DB行（E） | idは新規、seller_idは認証者、status=normal、item_id=null、createdAt/updatedAtは新規。元下書きは削除。表示用関連オブジェクトをそのままDBへ保存しない |

## 5. ケース記法・優先度

IDは文書内で一意。U/C/P/B/Eはレベル、N=正常、V=値・境界、F=失敗、Q=問題検出、S=セキュリティ、O=未確定の観測。P0=基本契約・認可・破壊操作・重要競合、P1=分岐・接続・操作性、P2=補助境界・測定。複数条件はそれぞれ独立ケースへ展開し、ID数を実行件数としない。

## 6. 単体テスト

| ID・優先度 | 対象・条件／手順 | 期待結果・停止位置 |
| --- | --- | --- |
| U-N01 P0 | ItemDraftPage、F-fullを描画 | 上編集→mainの動画・商品→下編集→削除の順、編集2個・削除1個。操作へ下書きID11、表示へ同じデータ |
| U-V01 P0 | current=0/1、inventory省略 | 両セクションへtrue/false/false。nameや他在庫からsoldoutを推測しない |
| U-V02 P0 | VideoSection、F-full/empty/boundary | 4.2の全動画側props・保存日時、補完優先順、normalPage=false・itemId=nullを確認 |
| U-V03 P0 | ItemSection、F-full/empty/boundary | 4.2の商品側props、バリエーション分岐、補完、元入力非破壊を確認 |
| U-N02 P0 | EditButton、クリック後APIを保留→resolve456 | 初期enabled、保留中disabled、追加クリックでも呼出し1回、完了前pushなし、成功後/upload/456へ1回 |
| U-F01 P0 | 編集APIをApiError／通常Errorでreject→再試行成功 | 指定エラートースト、pushなし、enabledへ戻り再操作可能。再試行は追加1回だけ |
| U-N03 P0 | DeleteItemDraftを開く→背景／Xで閉じる→再度開く | 初期確認なし、確認文と削除ボタン、キャンセルでAPI・通知・pushなし |
| U-N04 P0 | 削除確定→API保留→resolve | 保留中成功なし、成功トースト・確認閉鎖、1499msまでpushなし、1500msで/my-pageへ1回 |
| U-F02 P0 | 削除rejectをApiError／通常Errorで個別実施 | 前者は失敗トースト、後者は指定alert、確認閉鎖、成功トースト・sleep後pushなし。再度開いて再試行可能 |
| U-N05 P0 | 専用client API2関数をID11で呼ぶ | POSTの数値JSON、DELETEのパス・bodyなし。応答同値、rejectを握りつぶさず伝播 |
| U-V04 P1 | POSTのID「0011」、不正文字列 | 前者は11、後者はNumber→JSON上nullの現行変換を検証。wrapperを入力検証層とみなさず400のUI検証はC-F01 |
| U-N06 P1 | 専用server APIをID11で呼ぶ | /item-draft/11・cache:no-storeで共通関数呼出し、応答／失敗伝播。実GET接続保証は含めない |
| U-N07 P1 | VideoElem：m3u8＋Hls対応／非対応、MP4、両URLなし | Hls load/attach・unmount時destroy、代替src、動画なし。変換URL優先、poster設定。下書きのplayで集計APIなし |
| U-N08 P1 | ItemPeekの名前・価格・性別各値・kids、クリック、標的なし | 表示とSOLD OUT、#itemNameへsmooth/startスクロール。標的なしでも例外なし |
| U-N09 P1 | Summary/Detail：短文／overflow、開く→閉じる、本文変更 | 長文のみ操作表示、開閉表示が切り替わる。下書きでは展開集計APIなし。寸法モックを復元 |
| U-N10 P1 | Slideshow：1/3枚、2枚目クリック→閉じる | 画像・alt、拡大時initialSlide=1、閉じると拡大なし。実ライブラリの動作はB-N03 |
| U-N11 P0 | ItemHeader/ItemName：在庫有無、saleFlag=false/true、割引0/正値、recommend=trueでdraft | ￥800、SALE時の元価格・正値の割引だけ表示、soldout時価格・割引なし、おすすめ炎なし、商品名標的ID保持 |
| U-N12 P1 | VariantsList：1/2色、サイズなし／あり、カードを開閉・別カードへ | 色・サイズ・画像・SOLD表示、開いたカード切替。current=0で残りわずかと重複しない |
| U-V05 P1 | 色在庫initial10/current=0,1,2,3、省略 | SOLD／残りわずか／残りわずか／通常。サイズ在庫と個別閾値はQ09で確認 |
| U-N13 P1 | CategoryText、DeliverySection、Container | カテゴリー名、配送4項目、素材合計100だけ素材表示（99/100/101、配列空も展開）。Containerは子の内容・順序を保持 |
| U-V06 P2 | formatRelativeTime：59/60秒、59/60分、23/24時間、7日と8日 | 1分前→1分前、59分前→1時間前、23時間前→1日前、7日前→ja-JP日付。固定時刻・TZで再現 |
| U-S01 P0 | 各テキスト表示部品にF-security | 実行可能なscript/onerror要素を生成せず、文字列として表示 |

VideoTitleの単独出力はB-N01に含める。未使用の `itemSection/price.tsx` はこのページの構成に含まれないため対象外。

## 7. コンポーネント結合テスト

| ID・優先度 | 実部品・条件／操作 | 期待結果・停止位置 |
| --- | --- | --- |
| C-N01 P0 | EditButton＋専用API＋apiFetch、MSWの201を遅延 | Authorization・JSON headers、POST body11を確認、応答前disabled、完了後返却IDへpush1回 |
| C-F01 P0 | 編集400/401/404/429/500、通信失敗、非JSON応答 | 全て編集失敗通知、遷移なし、再操作可能。401で自動/login遷移するという未実装仕様は足さない |
| C-N02 P0 | DeleteItemDraft＋専用API＋apiFetch、200 JSONを遅延 | 開閉のみでDELETEなし、確定で対象パス1回、応答前成功なし、成功後通知と遷移順序 |
| C-F02 P0 | 削除400/401/404/429/500、通信失敗、JSON失敗 | HTTPエラーはApiError経由トースト、通信／解析失敗はalert。確認閉鎖、成功なし、遷移なし |
| C-F03 P0 | token取得結果null | 編集／削除とも業務HTTP未送信、各失敗通知、遷移なし |
| C-N03 P1 | ItemSectionと実共有商品部品でF-full/empty | 価格・商品名・セール・配送・画像代替・variantsのDOMが変換表と一致。draftで炎なし |
| C-N04 P1 | 実Detailをoverflowにし開閉 | 本文開閉は動作し、集計HTTPなし |
| C-S01 P0 | F-securityを実商品側部品に流す | 子部品を経てもHTML化・スクリプト実行なし |

動画側の実親子連携は非同期Server Componentを含むためB-N01/N02に置く。各部品をモックしたUのprops検証を「結合済み」と数えない。

## 8. ページ結合テスト

| ID・優先度 | レベル・条件／操作 | 期待結果・停止位置 |
| --- | --- | --- |
| P-N01 P0 | P：F-full/emptyをItemDraftPageへ、上下を各独立ケースでクリック | 2編集と1削除、対応するAPIへ下書きID、成功時は返却編集ID／my-pageへ遷移要求。空データでも操作が壊れない |
| P-N02 P0 | P：在庫0/1/省略、価格null/0 | 動画側へのsoldout伝達と実商品表示が一致、￥-と￥0を混同しない |
| P-F01 P0 | P：編集／削除HTTP失敗後、画面で再操作 | 他の表示を失わず失敗通知、誤った成功遷移なし。失敗後の再試行成功 |
| B-N01 P1 | B：GET代替で実ルート描画、F-full/empty | 実VideoTitleの見出し、全セクション、保存日時、画像・動画なし補完。SSR本文とHydration後が整合しconsole/pageerrorに不整合なし |
| B-N02 P1 | B：長い概要・説明を開閉、動画play、商品概要クリック | 本文展開・再生／動画なし表示・商品名へのスクロールが実動作し、再生・展開の集計HTTPは0 |
| B-N03 P1 | B：画像2枚目の拡大、スワイプ、閉じる、色カード開閉 | 実Swiperと子部品の状態・選択画像が一致、閉じた後再操作できる |
| B-S01 P0 | B：未ログインで本文／メタデータ要求 | /loginへ。GET代替の呼出し0、下書き本文・商品名メタデータなし |
| B-S02 P0 | B：セッションAとseller B／null、文字列化・trim後一致の所有者 | 不一致は/へ、下書き本文とそのメタデータなし。一致だけ本文・メタデータを表示 |
| B-N04 P0 | B：正常GET、name未入力も展開、本文とmetadataを要求 | title「商品名 | 下書き」、description、robots=noindex,nofollow。商品ID用metadata APIなし。cacheは同一描画リクエスト内のみ共有し、別リクエスト間の1回固定を要求しない |
| B-F01 P0 | B：サーバー発GET代替が401/404/500／通信失敗 | 401は/login、404はnot-found、他はエラー境界。本文・編集／削除操作を出さず、CSR業務APIなし |
| B-N05 P1 | B：幅375/767/768/1024、長い商品名、確認表示 | 768未満縦、768以上横並び6:4相当（gapを除く幅）、横overflowなし、確認と削除ボタンが画面内で操作可能 |
| B-N06 P1 | B：遷移成功、戻る／リロード | 実URL・ルート遷移を確認。GET代替を状態更新して、消費済み下書きへ戻った時は404とし古い操作可能画面を成功扱いしない |
| B-S03 P0 | B：F-securityをサーバー応答へ | SSR・Hydration後とも文字列として表示し、ブラウザー上で実行されない |
| B-O01 P2 | B：全画像・動画の読込、長文・複数variantsで操作 | request数・失敗・Hydrationエラー・操作時間を記録。数値SLA未定のため性能合格を宣言しない。基本操作不能や無限再要求は通常失敗 |

BはChromium・Firefox・WebKitで実施。画像・メディア・認証・遷移先の参照APIもテスト用応答を用意する。`page.route()`だけではNext.jsサーバー発GETを捕捉できないため、`API_URL`をテスト用APIへ向ける。ブラウザー側のAPI originと混同しない。E2EもService Worker経由の通信を避け、実要求の計測を妨げない。

## 9. 問題を検出して失敗させるケース

下記は現行コードの問題候補を根拠にした**要求ケース**。今回は未実行のため実際の失敗結果ではない。現行制約を追認するOケースへ格下げしない。意図的な欠陥のある実装に対してテストが失敗するか、テスト実装時に確認する。

| ID・レベル・優先度 | 入力・不利な実行順序 | 合格期待値／検出対象 |
| --- | --- | --- |
| Q01 U/C P0 | 削除を保留し同じ「削除する」を連打・Enter連続入力 | DELETEは1回。処理中は実行操作disabled等で再送不可。現delete.tsxはloading／再入防止なしのため失敗見込み |
| Q02 P/B P0 | 上編集を保留→下編集を押す、逆順も実施 | POSTはページ全体で1回、両編集操作が処理中表示。現各EditButton独立stateでは2回送信され得る |
| Q03 P/B P0 | 編集保留中に削除確認→実行、削除保留中に編集 | 最初の操作だけ送信、相反するPOST/DELETEを同時送信しない。現ページに共有排他なし |
| Q04 U/C/P P0 | 削除200→遷移待ち1500ms中に確認を再度開き実行 | 追加DELETEなし、成功通知・pushは1回。成功後に消費済み対象へ再操作させない |
| Q05 U/P/B P1 | 編集／削除をキーボードだけで起動・確認・閉鎖、商品概要をEnter/Spaceで操作 | 到達可能な名前付き操作、マウス同等の動作。現削除開始はp、閉じるはSVG、ItemPeekはroleだけでtabIndex/キー操作なしのため失敗見込み |
| Q06 B P1 | 確認を開いてTab/Shift+Tab、Escape、閉じた後のフォーカス | 確認が名前付きdialogとして認識可能、背景へフォーカス逸脱なし、Escape閉鎖、起動元に復帰。現dialog属性・focus制御なし |
| Q07 U/C/B P1 | DeliverySection：initial=2,3,4、current=1/2（initial以内） | 在庫行にcurrent=1なら残りわずか、2以上なら在庫あり。現三項演算子が小在庫側でbooleanを返し文言を描画しない問題を検出 |
| Q08 U/B P1 | 画像クリック／閉じるとvariants開閉をキーボードで行う | 名前付き操作へ到達し実行・閉鎖できる。現div/SVGのonClick依存を検出。Swiper内部の既定操作だけで独自拡大UIを合格にしない |
| Q09 U/C/B P1 | 色・サイズ在庫initial=10、low_stock_ratio=0.3、current=0/2/3/4を各独立実施 | 0はSOLD、2/3は残りわずか、4は通常。サイズは対応する低在庫表示の有無をassert。現サイズの比較方向逆転と色の0.2固定を検出 |
| Q10 U/B P1 | converted_urlが空文字、original_urlは有効MP4 | 元動画を実srcへ設定し再生可能とする。現VideoElemは表示条件に論理和、URL選択にnull合体を使い、空の変換URLで元動画が設定されない問題を検出 |

Q01〜Q04はMSW handler内の実到達数を数え、UIのイベント回数だけで済ませない。Q02で下ボタンのクリックを省略しない。Q03は要求開始順をgateで固定し、2要求を許した上で片方404なら合格という期待値へ置き換えない。バックエンドが重複作成を防いでもフロントの問題は失敗させる。

Q09は追加指示を具体化した品質要件として「在庫が設定閾値以下になったら残りわずか」を採用する。現コードの比較式を期待値へコピーしない。色在庫も固定値0.2ではなく、その在庫のlow_stock_ratioを使用する契約で設計する。既存業務仕様との合意が必要な場合は要確認として明示し、テスト実装では通常の失敗として可視化する。無断で現挙動への期待値変更や除外をしない。

## 10. E2E：編集開始・削除と永続化

### 10.1 環境・取得代替の限定

ルートtest基準の配置は3章参照。`fetchEditDraftItem()`・`fetchDeleteDraftItem()`を実UIから実行し、実apiFetch→実Express→テスト用PostgreSQLの結果を検証する。POST/DELETEをroute.fulfillやAPI関数モックにしない。

1. 既存スキーマのテストDBを用意し、アプリ・seed・照会・cleanupの全接続が `test_db` であることを接続前設定と接続後 `current_database()` で確認する。実接続の秘密値を記録しない。migration・sync・全件削除で自動補正しない。
2. A/Bの実認証、NextAuthセッションとブラウザーのaccess-tokenを整合させる。認証を無効化しない。SSR用API_URLだけをテスト用proxyへ、CSR用NEXT_PUBLIC_API_URLを実Expressへ向けてNext.jsをbuild/startする。
3. proxyは未実装のGET /item-draft/:idだけ、seedした行と一致する表示用JSONを返す。所有者でない／消費済みなら404へ切り替える。その他は実Expressへ転送し、応答を記録する。本番へテスト用GETや裏口を追加しない。
4. 編集・削除の応答は実APIを待ち、返却ID・HTTP status・実URLを確認する。/upload/[新編集ID]と/my-pageの初期表示に必要なAPIも実処理を基本とし、不足があれば遷移後の表示検証を環境停止として分ける。
5. proxyは画面表示を可能にする準備用代替であり、GETの認可・DB読取整合性を保証しない。完全な取得込みE2EはGET実装後に代替を外して追加確認する。

E2E seedはAの対象D1・別下書きD2・BのD3・既存編集E0・参照マスターを作成し、対象外行の事前snapshotを保存する。F-fullとF-emptyを独立実施。DB事実確認は未実装GETや画面文字ではなく別接続で直接SELECTする。入力の表示用補完値「-」や代替画像を、編集DBに保存すべき元値と混同しない。

### 10.2 シナリオ

| ID・優先度 | 操作・条件 | 実HTTP・画面・DBの期待結果 |
| --- | --- | --- |
| E-N01 P0 | AがD1表示→上／下編集（各独立seed） | POST本文はD1、201と新編集ID。/upload/返却IDへ。D1なし、編集は1件増加、4.2のコピー・管理値一致。D2/D3/E0/参照行不変 |
| E-N02 P0 | F-emptyの下書きを編集開始 | 201、nullable・空配列・JSONの元値を保持し、表示補完を保存しない。元下書き消費、編集画面へ遷移 |
| E-N03 P0 | D1→削除確認→キャンセル（X／背景は別実施） | DELETEなし、遷移なし、DB全対象不変 |
| E-N04 P0 | D1→削除確定 | DELETE200とJSON、成功トースト→確認閉鎖→/my-page。D1のみ物理削除、編集増加0、D2/D3/E0/参照行不変。S3削除を呼ぶ通信なし（実オブジェクト全体の保証は対象外） |
| E-F01 P0 | 表示後に別の実要求でD1消費→画面の編集／削除を実行 | 実404、各失敗通知、誤った成功・遷移なし。編集の追加生成0、対象外不変 |
| E-S01 P0 | 表示後、ブラウザーのAPI認証を無効化。refreshが成功しない状態にして各操作 | token取得不能なら業務要求0、サーバー側で無効なtokenなら実401。各失敗通知・成功遷移なし、DB不変。両分岐を混同しない |
| E-S02 P0 | 表示後POST body／DELETE URLを他人D3へ改変して実送信 | 実404、D3不変、編集生成なし、UIは失敗。UI非表示だけで所有権を保証しない |
| E-S03 P0 | 表示後の送信IDをPOSTは0、DELETEは0／2147483648に改変 | 実400、失敗UI、DB不変。POSTにDELETEと同じ上限があるという仕様は作らない |
| E-F02 P1 | 新規認証ユーザーの実要求で枠を消費し、UIで編集6回目／削除21回目（別API・別ケース） | 実429、失敗UI、追加書込なし。10分5回／5分20回の実レート境界。window待ちを長いsleepで作らない |
| E-Q01 P0 | 同じ削除の連打、上下編集交互、編集と削除（Q01〜Q04相当） | UIからの重複要求0（最初の1回だけ）、遷移・成功通知1回。別接続で編集増加は最大1、下書きの最終状態が単一操作と一致。DBが安全でも余分なHTTPが出れば失敗 |
| E-N05 P1 | 同じ下書きの編集／削除成功後、再訪・リロード・戻る | 取得代替も不存在を返し、古い内容で操作可能にしない。編集行の追加生成なし。この結果を実GETの検証に数えない |

実500・transaction rollback・ロック待機をE2Eから確実に注入する仕組みは現時点でない。MSWでの500はC-F01/F02、実DB障害とrollback・競合の証明は既存バックエンド設計の対象として区別する。HTTP成功後にブラウザー通信だけを失敗させた場合、DBはcommit済みの可能性があるため「画面失敗ならDB不変」とassertしない。通信の成否不明を扱う追加設計が必要なら別ケース化する。

### 10.3 後片付け・環境停止

- 各ケース・ブラウザー・retryで別ユーザー／対象を採番し、レート枠と消費済みIDを再利用しない。workers=1でもレート状態が消えるとはみなさない。
- 作成行・返却編集IDを追跡し、finallyで残った要求を回収後、実FKに従い編集・下書き→参照親の順で今回作成IDだけ削除。非対象snapshotとcleanup後の残存0を確認し接続を閉じる。シーケンスを戻さない。
- DB名・設定由来不明、スキーマ不一致、認証準備不足、GET代替未準備、ブラウザーOS依存不足は実行停止として報告する。業務成功・期待された欠陥検出と区別する。

## 11. 観点とケースの対応

| 観点 | 主な対応ID |
| --- | --- |
| 正常・表示・補完・境界 | U-N01/N07〜N13、U-V01〜V06、C-N03、P-N01/N02、B-N01、E-N01〜N04 |
| 異常・非同期・停止・再試行 | U-F01/F02、C-F01〜F03、P-F01、B-F01、E-F01/F02 |
| 状態・並行操作・二重送信 | U-N02〜N04、Q01〜Q04、E-Q01 |
| ナビゲーション・戻る・リロード | P-N01、B-N02/N06、E-N01/N04/N05 |
| 認証・認可・XSS・メタデータ | U-S01、C-S01、B-S01〜S03、B-N04、E-S01〜S03 |
| レスポンシブ・互換性・SSR | B-N01/N05、全B/Eの3ブラウザー |
| アクセシビリティ・フォーカス | Q05/Q06/Q08。操作と主要ラベルを保証し、全WCAG適合を宣言しない |
| パフォーマンス・メディア | B-N02/N03、B-O01。数値基準未確定 |
| DB整合性・非対象不変 | E-N01/N02/N04、E-F01/F02、E-S01〜S03、E-Q01 |
| 現行問題の検出 | Q01〜Q10。失敗すべきケースを観測のみへ変更しない |

## 12. 実装順・将来の実行計画・完了条件

実装はP0（Uの境界、C接続、Q01〜Q04、認可・DB整合性）→P1（表示分岐、Q05〜Q10、ブラウザー）→P2の順。設計済みと実行成功を区別し、失敗ケースは仕様・実装のどちらが原因か根拠を示して扱う。

予定コマンド（**今回は実行しない**）：

```bash
# client/で実行：ページ専用と共有部品の単体
npm run test:unit -- src/app/item/draft/test/ src/app/item/draft/api/test/ src/app/item/videoSection/test/ src/app/item/itemSection/test/ src/components/container/test/ src/lib/test/formatRelativeTime.test.ts
# client/：コンポーネント結合・DOMページ結合
npm run test:integration -- test/integration/components/item/itemDraftPage/ test/integration/pages/item/itemDraftPage/
# client/：テスト用APIと本番相当Next.jsを別プロセスで起動後
npm run build
npm run start -- --hostname 127.0.0.1
npm run test:pages:browser -- test/integration/pages/item/itemDraftPage/
# client/：コード実装時の静的検査
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
# test/：E2E前提を準備後
npm run test:e2e -- E2E/item/itemDraftPage/
npm run typecheck
```

`client/tsconfig.json`は現状テストTSもincludeするため、本番typecheckがテストを完全除外するとは書かない。`client/test/tsconfig.json`はテスト・fixture・runner設定を明示対象としincremental=false。通常client lintは `.next/out/build/next-env.d.ts` を除外し、client内テストTSを含む。ルートtestパッケージはclient lint対象外なので、E2E実装時は既存ESLintの適用範囲を確認し、設定を独断で変更せず対象TSの追加検査方法・結果を記録する。

今回の完了条件：この1文書に全レベル・配置・fixture・境界・ケース・問題検出・実行計画が対応し、相対リンク・差分を確認済みであること。テストコード・実行結果・成功件数は作成しない。

将来のテスト完了条件：各IDと展開条件が実装・結果に対応し、Q系を含む未解決失敗を残して全体合格としない。実ブラウザーとmock、実DBと代替GET、失敗・環境停止・未実行を分け、将来の `client/test/docs/report/item/itemDraftPage.md` に結果・修正・再検証をまとめる。現在 `client/test/docs/report/AGENTS.md` は存在しないため、実装時に追加された規約も確認する。

未確認事項：Q09で明文化した在庫閾値契約の業務側合意、性能の数値基準、実GET取得込みE2E、Node.js 26とOS依存を満たした実行環境、遷移先の実API・テストDBスキーマ。今回これらの確認や修正、テスト実行はしていない。
