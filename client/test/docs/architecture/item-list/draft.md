# 下書き商品一覧 テスト設計書

## 1. 対象・目的・仕様の根拠

対象ルートは `/item-list/draft`。下書き詳細の `/item/draft/[id]` とは別のページとして設計する。本文のパスは原則 `client/` 基準、E2Eの配置は `test/` 基準、バックエンド・Todoはリポジトリルート基準と明記する。

今回の成果物はテスト設計書。テスト実装・実行、レポート記入、本番修正、ライブラリ追加、DB操作は行わない。以下の新規配置・コマンド・期待結果は計画であり、検証済みを意味しない。

根拠：

- [ページ仕様](../../../../src/app/item-list/draft/AGENTS.md)、`src/app/item-list/draft/` の4 TSXと `api/client.ts`。
- `src/app/item-list/{types.ts,itemListUI.tsx}`、`src/lib/{fetcher.ts,getAccessToken.ts,formatRelativeTime.ts}`、`src/lib/api/client.ts`、`src/middleware.ts`。
- [共通4部品の設計](./_components.md)と[結果](../../report/item-list/_components.md)。画像・価格・検索・ページ番号の内部全分岐は既存単体を利用し、本書では親との接続差分を確認する。
- [テスト配置・分担](../../../AGENTS.md)、[設計書規則](../AGENTS.md)、[レポート規則](../../report/AGENTS.md)、[E2E環境](../../../../../test/README.md)。
- リポジトリルート基準 `docs/design/backend/detail/itemDraft/{getItemDraftList,deleteItemDraft}.md`、対応する `server/src/{routes,controllers,usecases,services}/itemDraft/` の実装、`server/src/routes/index.ts`、`server/src/models/item_draft.ts`。

### 期待値の優先関係と既知の接続不整合

部品単体は明示された現行の責務を検証し、UIにないローディング・二重送信抑止・ページ補正等を新仕様として発明しない。一方、実APIの接続はバックエンドの確定した契約を正とし、現行の不整合を成功モックで隠さない。

| 論点 | 現行の差 | 検証方針 |
| --- | --- | --- |
| 一覧JSON | UIは `ItemDraft[]`、実APIは `{itemDraft: row}[]`。fetcherは変換しない | 単体UIはフロント型fixtureを明記。結合C-A01・E2E E-N01は実JSONを用い、本人の商品情報・有効なリンクが表示されることを期待して不整合を検出 |
| ID・null・日時 | UI型はid:string、price:number、文字項目:string、createdAt:Date。実APIはid:number、価格や文字項目はnullable、createdAtはISO文字列 | 型アサーションで整合したことにしない。実JSONは別fixtureとして保持。日付関数は文字列対応だがprice nullの表示契約は未確定として別途記録 |
| 削除接続 | UIは `items/{id}/draft` を渡す。共通apiFetchはbaseとそのまま連結。実ルートは `DELETE /api/item-draft/:id` | 単体では現在渡す引数を確認。C-A02・E-D01では正しいルートで削除できることを期待し、URLを補正するproxyや成功handlerを設けない |
| base URLの末尾 | 一覧はbaseに `/item-draft/list`、削除はbaseに `items/...` を連結 | 基準baseは `http://127.0.0.1:4100/api`（例、認証情報なし）。末尾スラッシュ有無をU-A02で観測し、実環境では採用baseを明記。両方が成功すると仮定しない |

一覧の不一致は[既存Todo](../../../../../docs/todo/P1-bug/align-item-list-response-with-client.md)に記録済み。本設計では修正しない。削除パスの不一致も本書の未解決事項として残す。仕様調整・修正後は関係するケースの根拠と期待値を更新し、無関係なassertを弱めない。

## 2. 責務・処理順序・配置

| ファイル | 責務・境界 |
| --- | --- |
| `src/app/item-list/draft/page.tsx` | async PageはItemListUIへタイトルとDraftItemListを渡す。metadataはタイトル・説明・noindex/nofollow。自身の一覧fetchなし |
| `draftItemList.tsx`（同ディレクトリ） | 入力中の値、確定検索語、ページ1始まりを保持→getListUrl→SWR→商品行／空表示。各行に現在キーのmutateを渡す |
| `draftItem.tsx` | ID付き詳細Link、name/titleの空補完、createdAtの保存日時、画像・価格のProps、リンク外のRemoveFloat |
| `removeFloat.tsx` | メニュー→楽観的キャッシュ除去（再検証false）→DELETE待機→成否いずれも再検証要求→成功toast／ApiError toast／通常例外alert |
| `api/client.ts` | 一覧URLのtrim・encode、fetcher再export、DELETEのapiFetch呼び出し。認証・HTTP判定は共通関数 |
| CSS2ファイル | `draftItemList.module.css` と `removeFloat.module.css`。DOM単体で寸法や重なりを保証せずOケースへ |

新規ファイルはすべて予定配置。単体は本番コードの最寄りtest、結合とfixtureはclient/test、E2Eは独立testパッケージに置く。

| レベル・ID | 配置 | 実処理・モック・限界 |
| --- | --- | --- |
| U（単体）U-M/U-L/U-I/U-D | `src/app/item-list/draft/test/{page,draftItemList,draftItem,removeFloat}.test.tsx` | RTL/jsdom。一覧ではSWR・子部品を境界モック、商品行では子部品・日時関数、削除ではAPI・mutate・toast・alertを制御。対象本体は実行 |
| U U-A | `src/app/item-list/draft/api/test/client.test.ts` | Vitest、DOM不要ならNode。共通apiFetchをモック、URL生成は実処理 |
| C（コンポーネント結合）C-N/C-E | `test/integration/components/item-list/draft/{draftItemList,removeFloat}/integration.test.tsx` | 実SWR・一覧・行・共通部品・共通fetch。HTTPをMSW、getAccessTokenのみテスト値へ。next/imageは薄いimgモック、next/linkはhref保持。通信・DBの実接続は保証しない |
| C 接続契約C-A | `test/integration/components/item-list/draft/draftItemList/contract.test.tsx` | 実APIの構造・正規ルートのみのMSW。ルート未一致は失敗扱い、フロント都合でJSONを平坦化しない |
| P（ページ結合）P-N | `test/integration/pages/item-list/draft/page.test.tsx` | 同期ItemListUI＋実DraftItemListを組み立て、Provider・タイトル・API・空表示の接続。async PageをRTLに合わせて改変しない。Server Componentの包含契約はU-M01、実Next接続はE2E |
| E（E2E）E-N/E-D/E-S | `E2E/item-list/draft/{getItemDraftList,deleteItemDraft,authorization}/flow.spec.ts`（test基準） | production Next→実認証→実Expressルーター→隔離PostgreSQL。対象業務APIのモック・JSON変換・ルート書換えなし |

client固有fixture/setupの予定は `test/fixtures/item-list/draft/{fixtures,setup}.ts`、E2E fixtureは `test/fixtures/item-list/draft/{database,harness}.ts`（リポジトリルート基準）。現在draft一覧専用のテスト・fixtureはない。既存の `test/fixtures/item/itemDraftPage/` の認証・DBガード・後片付けと `test/E2E/item/itemDraftPage/` の認可・削除テストを参照して再利用可能範囲を判断する。詳細ページ用の固定seedやmount一覧がそのまま一覧の複数ページに対応すると仮定しない。

## 3. fixture・共通アサーション・非同期の管理

- 時計は例として `2026-11-12T00:00:00.000Z` に固定、標準下書きはid文字列`101`、name「検証用シャツ」、price=12345、画像 `/test-item.jpg`、title「動画A」、createdAtは1時間前。単体は型に合うDateを渡す。URLには検索語「 シャツ & + # ? / % _ 」や日本語を使いtrim・encodeを検証する。
- フロントfixtureは `{itemDraftList:[row],totalPages:3}`。wire fixtureは `{itemDraftList:[{itemDraft:{id:101,name:...,price:12345,first_image_url:...,title:...,createdAt:"2026-11-11T23:00:00.000Z"}}],totalPages:3}`。この2種類を明示し、wireを `ItemDraft[]` にcastしない。正常のC-Nケースの平坦fixtureは現行UIの連携限定で、実API互換を保証しない。
- null/undefinedのname/titleや画像は単体の防御分岐へ直接渡す条件。通常型から外れる入力であることを明記。実API nullデータはC-A01のwire側で確認する。price=null時の「0円」等の補完は未確定であり、新たな期待を作らない。
- E2Eは認証ユーザーA/B、Aの21件（20件＋2ページ目1件）、Bと所有者nullの下書き、保護対象item/item_editingとマスターを用意。createdAt同値の異なるIDを含め、DB照会でcreatedAt DESC/id DESC順と照合する。検索用にnameだけ一致・titleだけ一致・不一致、通常文字としての `%`・`_` を含む行を分ける。入力正規化のみの実装に合わせ、照合用保存文字列も意図した形にする。
- E2EはテストDBの接続先と `current_database()` を検証し、既存fixtureの `test_db` ガードと同等の防護を使う。実環境のデータ・本番認証に接続しない。テスト所有者・作成IDで限定cleanupし、起動したプロセスを停止する。migration・syncは実行しない。
- SWRはケースごとに `provider: () => new Map()`、focus/reconnect再検証・エラーretry・dedupeの設定をケースで明示し、単なる再試行を新しい業務操作と数えない。初期GET後は操作が加える要求を記録する。データを消すために全体cacheを共有しない。
- deferred PromiseでGET/DELETEを保留し、操作・楽観更新・応答・再取得の順を制御。固定sleepなし、user-eventと非同期assertはawait。開始したPromiseとリクエストは必ず回収する。共通setupに従いDOM・MSW・spy・cookie・時計・環境変数を復元する。
- role・テキスト・Link hrefで取得。三点アイコンとoverlayはroleがないため対象行内のSVG属性／CSS Modulesのimport値を限定利用し、モックでbuttonを追加しない。CSS生成名・内部state・巨大snapshotに依存しない。

IDのU/C/P/Eは上記の階層、Nは正常、AはAPI契約、Lは一覧状態、Iは商品行、Dは削除、MはPage/metadata、Sは認証、Xは観測を示す。Oは人間による観測。P0は基本契約・認可・データ整合、P1は分岐補完、P2は観測。列挙条件は独立テストへ展開し、ID数と展開件数を区別する。

## 4. 単体テスト

| ID・優先度 | 条件・操作 | 期待結果・停止位置 |
| --- | --- | --- |
| U-M01 P1 | Pageの返すReact要素とgenerateMetadataをawaitして検査（async Componentを直接RTL renderしない） | ItemListUIのtitleは「下書き商品」、子はDraftItemList。metadataは「下書き商品一覧」、所定説明、robots.index/follow=false。Page自身の一覧通信なし |
| U-A01 P0 | page=1/2、検索語なし・空・半角/全角空白・前後空白付き日本語・予約文字 | base＋`/item-draft/list?page=N`。trim後非空だけkeywordを1回encode。入力を書き換えない。fetcherは共通実体の再export |
| U-A02 P1 | base末尾スラッシュ有/無、page=0/-1/1.5、検索語null文字列 | 現行の連結・ページ非検証・文字列nullの送信を観測。通常のページ操作で生成しない不正値をAPI入力検証済みとはしない |
| U-A03 P0 | fetchRemoveItemへ `items/101/draft`、依存resolve/reject | apiFetchに同じパスとDELETEだけを渡しbodyなし。戻り値・同じ例外を伝播、勝手な再試行なし |
| U-L01 P0 | SWR data未取得／1件以上／空配列、totalPages=0/1/3 | 未取得は検索欄のみで専用Loading/空案内なし。有データは順序を変えず全行とPaginationへ現在1・総数・同一mutateを渡す。空配列は「商品が見つかりません」、行・Paginationなし |
| U-L02 P0 | 3ページへ移動後、非空文字を入力 | 入力値更新・page=1。確定検索語は変更せず、その既存keywordとpage1でSWRキーを生成 |
| U-L03 P0 | 非空入力後Enter／アイコン経由のonSubmit | 確定語を入力値へ、page=1。trimとencodeはgetListUrl。入力だけでは新keywordを要求しない |
| U-L04 P0 | 確定検索中の2ページ目で入力を空／半角空白／全角空白にする | 確定keywordも解除、page=1、URLにkeywordなし。検索入力そのものは渡された空白を維持 |
| U-L05 P1 | SWRにerror、dataなし／前回dataあり | 現行は専用エラー文言なし。dataがあればその行、なければ検索欄のみ。404やloginへの独自遷移を仮定しない |
| U-I01 P0 | 標準商品行、子部品と日時関数をspy | Linkは `/item/draft/101`、name/title、保存日時を表示。createdAtを日時関数へ渡す。画像はstatus:null/showSold:false、価格はsale_flag:false/showSale:falseと割引0。RemoveFloatへIDと同一mutate、削除はLinkの外 |
| U-I02 P1 | name/title nullまたは省略相当、画像空文字 | name/titleは空文字。画像へ空URLを渡す。価格nullの成功表示はこの型外ケースから発明しない |
| U-D01 P0 | メニュー初期・三点クリック2回・表示後overlayクリック | 初期削除文言なし。開閉が反映、overlayで閉じる。メニュー操作だけではDELETE・mutate・成功通知なし |
| U-D02 P0 | 削除API保留→成功。mutateのupdaterへ対象含む2件を与える | 最初のmutateはupdaterとfalse。対象だけ除去、totalPages・他行・元配列不変。APIへ現在のpathを1回渡す。保留中に成功通知なし。成功後mutate()と「下書き商品を削除しました」toast、error/alertなし |
| U-D03 P1 | updaterへundefined／空配列／対象不存在のdata | undefined維持、配列は空／元の他行を保持。totalPages維持。数値idと文字列IDの直接比較はU-X01へ |
| U-D04 P0 | APIがApiError／通常Errorをreject | 両方mutate()で再取得要求。前者は「下書き商品の削除に失敗しました」、後者は既存システムエラーalert。成功通知なし。画面の復元完了をmutateモックだけで保証しない |
| U-X01 P2 | 文字列IDで削除、cache行のidが数値。API保留中に同一削除を2回 | strict比較では数値ID行が除去されない、二重操作の抑止なしという現状を観測。通常の型内成功と区別。新たな拒否仕様は作らない |

mutateの最初の呼出しはtryの外、再取得mutateはawaitされていない。任意のmutate rejectを握り潰せると仮定せず、未処理Promiseを残すモックを作らない。再取得失敗と通知順は結合C-E02でHTTP境界から確認する。

## 5. コンポーネント結合・ページ結合

| ID・優先度 | fixture・操作・障害注入 | 期待結果・限界 |
| --- | --- | --- |
| C-N01 P0 | 平坦fixture、実一覧とSWR、検索入力→送信→ページ2 | 表示はGET本文と一致。入力だけで新keyword要求なし、送信後trim済keyword＋page1、ページボタンでpage2。同じキャッシュキーへの不要な手動再取得は要求しない |
| C-N02 P0 | 平坦fixtureで確定検索中page2から非空入力、次に空白へ変更 | 先に旧keywordのpage1へ戻り、空白でkeywordなしpage1へ。入力途中と検索確定を混同しない |
| C-N03 P0 | 平坦2件、DELETEと後続GETをそれぞれ保留 | 対象のみ即時消失、残る行・件数情報は維持。DELETE成功後のGET完了でサーバー返却の行・totalPagesへ更新。成功toastはDELETE成功後で、GET完了待ちとは限らない |
| C-E01 P0 | 平坦2件、DELETEはJSON401/404/500、再GETは元の2件 | 一度楽観除去後に再取得で復元、失敗toastのみ。401でもこの部品は勝手にlogin遷移しない。正規ルートとの整合はC-A02で別に判定 |
| C-E02 P1 | DELETE非JSON429／network error、またはDELETE成功＋再GET失敗 | 前2つは通常例外alert、成功通知なし。後者はDELETE成功toastを出すが再GET失敗を理由に削除失敗とはしない。復元を保証せずcache状態・errorを記録 |
| C-E03 P1 | 古い検索AのGETを保留→新しいBのGET成功→A解放 | 現在の検索入力・キーはB、Aの遅い応答でB表示を上書きしない。別キーのSWR cacheは独立 |
| C-X01 P2 | 2ページ目の最後1件を削除、再GETが空・totalPages=1 | 空案内、pageNumberは2のまま、Paginationは表示されない現行挙動を観測。前ページへ自動移動する新仕様は設けない |
| C-A01 P0 | 実API同形のwrapped配列・数値ID・ISO日時、さらにnullable項目のwire fixture | 契約ケースの主期待は本人の非null商品名・価格・正しいIDのLinkが描画されること。現行の参照不一致は失敗として記録し、例外発生を成功条件にしない。nullable価格の補完は仕様未確定として別記 |
| C-A02 P0 | 正規DELETE `/api/item-draft/101` だけhandler登録。actual request URLを記録して削除 | 対象正規URLへbodyなしDELETE、成功後再GETを期待。現行誤パスは未一致として検出し、`items/101/draft`を200にする救済handlerは置かない |
| P-N01 P1 | 実ItemListUI＋実一覧、平坦fixture | 「下書き商品」のタイトルと検索・一覧・ページングが同じ構成で接続。共通Backはrouter.back要求まで。全デザイン・実遷移・認証middlewareは保証外 |
| P-N02 P1 | 同構成でGET空配列・totalPages=0／遅延GET | 空だけで空案内。遅延中は空案内を先走って出さない。UIにないLoading文言を必須にしない |

平坦fixtureのC-N03/C-E01は削除通知とキャッシュ連携を分離するために、現行が送るURLを明記してHTTPを制御する限定テスト。成功しても正規DELETEが疎通したとは扱わない。C-A01/C-A02は同じ前提を採用せず、実接続の欠陥を別判定する。

## 6. E2E：実認証・実API・DBの契約

既存の実NextAuth認証fixtureを参考にユーザーA/Bの有効なsessionとaccess-tokenを用意し、ログイン処理を偽の固定IDで置換しない。対象業務APIの通信は原文のまま転送し、DOMだけでなくHTTPのJSONとDBを根拠にする。`page.route`による削除先書換えやレスポンス平坦化は禁止。認証を偽造しない要求改変は認可ケースの条件として区別する。

| ID・優先度 | 前提・手順 | 期待結果・停止位置 |
| --- | --- | --- |
| E-N01 P0 | Aで一覧を開く。21件とB/所有者nullの下書きをseed | GET200、wire構造は実API仕様通り、件数20・totalPages=2、DBと同順序、本人分だけ。画面も本人の名前・価格・IDを利用できる。現状wire不一致をここで検出し、画面後続不能なら失敗として止める |
| E-N02 P0 | E-N01疎通後、ページ2と検索（name一致/title一致/0件、`%`/`_`文字） | page2は残り1件、検索条件と取得JSON・totalPagesがDBと一致。空検索結果totalPages=0。GET前後で下書き・保護データ不変。入力正規化の全組合せはserver既存テストへ委譲 |
| E-D01 P0 | 正常表示したAの対象行から削除。削除前snapshotを保持 | 正規DELETE200、対象item_draftだけ物理削除、再取得一覧から消える。同一所有者の別下書き、B、item、item_editing、マスター不変。現在の誤ルートなら失敗・DB不変を記録。正規ルートへ直接DELETEして画面成功の代用にしない |
| E-S01 P0 | sessionなしで一覧要求、次にログイン済みでaccess-tokenを消して一覧を再取得 | 前者はmiddlewareで/loginへredirect、保護一覧情報なし。後者はGETが認証なしで実401となり保護データが返らない。画面エラー文言や自動logoutは仕様にないため必須にしない |
| E-S02 P0 | 正常表示後tokenを除去し削除を操作 | 共通apiFetchがUNAUTHORIZEDで拒否しDELETEなし、後続GETは401となり得る。DB不変、成功toastなし。初期tokenで他人の下書きを取得できると仮定しない |
| E-S03 P0 | E-D01が正規接続した後、Aの削除要求のIDだけをB／不存在へ改変して実APIへ送る | 両方404・ITEM_DRAFT_NOT_FOUND、DB不変、成功通知なし。URL改変を認可回避と取り違えない。正規ルートへの接続が未成立なら保留、serverの既存認可テスト成功をこのE2E結果に転記しない |
| E-D02 P1 | 一覧表示後、別接続の正規API操作で対象を削除済みにして元画面から削除 | 画面操作は404、再GETで実サーバー状態へ収束、成功toastなし。他行不変。単体の二重操作観測とDB整合を区別 |

レート制限の50/51回、削除20/21回、query/ID全境界、transaction競合・ロールバックの網羅はリポジトリルート `server/test/docs/architecture/itemDraft/{getItemDraftList,deleteItemDraft}.md` の担当範囲。本E2Eは接続・代表認可・DB不変の追加保証に絞り、フロントだけでDB原子性を検証済みとはしない。

## 7. 人間による目視観測

全件の担当は「人間」、状況は「人間確認待ち」。結果記録先は `test/docs/report/item-list/draft.md`（予定、今回は作成しない）。自動E2Eは上記契約の確認に限定し、目視目的のPlaywrightシナリオは作成しない。

| ID | 前提環境・データ | 操作 | 目視の期待・観測内容 |
| --- | --- | --- | --- |
| O01 | Chromium、Aでログイン、画像有/無・長い商品名/動画名・価格の違う一覧。幅359/360/767/768/1280 | 一覧を各幅で閲覧 | 行・省略文字・保存日時・価格の読みやすさ、画像比率、幅359以下で三点が非表示となる現状と削除操作の利用可否を記録 |
| O02 | 同環境、2ページ以上。GET/DELETEの遅い検証環境 | 入力・検索送信・ページ操作・削除メニュー・overlayで閉じる・削除 | 操作感、楽観除去と復元、toast・空表示、メニューの重なりを観測。Loadingやページ補正があるとは仮定しない |
| O03 | Chromium/Firefox/WebKit、同アカウント、キーボード利用 | Tab/Enterで検索・ページ・三点メニュー、商品リンクから詳細へ移動し戻る | フォーカスの見え方、到達性、実遷移・戻る、Hydrationの画面上の崩れを記録。SVG/divメニューのキーボード操作を確認済みと断定しない |

## 8. 実装優先度・実行計画・完了条件

1. 環境・Node指定バージョン・import・SWR cache分離を確認し、U-A01/U-L01/U-D02とC-A01/C-A02の接続契約を先行する。接続不整合を発見しても勝手に本番を修正せず、失敗・修正案としてレポートへ残す。
2. 独立した単体と平坦fixture結合は接続契約の失敗中も実装・確認可能。E2EはDB/schema/認証ガード確認→E-N01を先行。失敗すれば後続検索・削除はその前提未成立として保留し、同じ原因で多数の後続ケースを繰り返さない。空一覧の認証ケースは独立して継続できる。
3. 正式な契約整合と環境復旧後、保留ケースを再開。変更時は該当ファイルと隣接接続を再実行し、統合時に対象一括実行・静的検査を一度行う。分担する場合は単体／結合／E2Eでworktreeと担当ファイルを分け、統合担当が環境確認・集計・ログ更新を担う。

以下は後続作業で使うコマンドの計画であり、今回は実行しない。

```bash
# client/ で実行
npm run test:unit -- src/app/item-list/draft/test/ src/app/item-list/draft/api/test/
npm run test:integration -- test/integration/components/item-list/draft/ test/integration/pages/item-list/draft/
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
# test/ で実行。認証・DB・production Next環境はREADMEに従って事前準備
npm run test:e2e -- E2E/item-list/draft/ --project e2e-chromium
npm run typecheck
```

本番tsconfigの実際のinclude/excludeとテスト用tsconfigの差を実装時に確認する。通常lintに含まれないE2E TS等があれば既存ESLintで対象を明示して追加検査し、通すための共有設定変更は行わない。3ブラウザーの画面差はO03、主要なAPI/DB契約はまずChromiumで検証する。実装時に新しい環境障害・失敗がなければ同じ検証を反復しない。

本設計の完了条件は参照先・予定配置・責務・ケースの整合確認。後続の自動検証完了は各条件の実装と実結果の記録、未実装・未実行・失敗・中断の分離、接続不整合の扱いの明示で判断する。全成功には実JSONと正規DELETEの疎通が必要で、平坦fixtureだけの成功をページ全体の完了としない。O01～O03、価格nullの表示契約、既知の接続不整合、実E2E環境は未確認。テスト・lint・型検査・ブラウザー操作は今回未実行。
