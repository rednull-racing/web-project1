# itemConfirmPage テスト設計書

## 2026-10-30 F1・F2の現行契約

ユーザー指示により、再送と操作性の観測を修正の合否契約へ変更する。本節と更新したC-O01/B-O01を優先し、以下の「設計のみ」の範囲は初回作成時の記録とする。既存の正常・異常系の期待値は維持する。

- C-O01：送信開始から成功待機・遷移まで通信/通知/遷移は1回。失敗時に送信・編集を復旧。閉じる/再表示でも再送不可、unmount後は応答・待機完了による通知/遷移なし。
- B-O01：名前付きnative dialog、開く/閉じるfocus、Tab循環、背景へのfocus逸脱抑止、Escape/閉じる/背景クリック、BackのEnter/Space操作を通常assertで検証する。
- AF-F1（U、P0）：state反映前の同期クリック2回で通信1回、応答前unmountで通知・sleep・pushなし。成功待機unmountは元C-O01を更新して検証する。
- AF-F2（U、P0）：dialog名・aria-modal、初期focus・Tab/Shift+Tab循環・Escape・復帰。native top layerと背景inertの保証はPlaywrightへ分離し、jsdomは専用dialog API代替を使う。

## 1. 対象・根拠・範囲

2026-10-30時点の `/item/confirm/[id]`（新規出品）と `/item/confirm/edit/[id]`（更新）、両ページが使うコンポーネント・共通関数・API連携を対象とする。今回は設計書の作成のみで、以下はテスト実装・実行済みを表さない。本番コード、テストコード、設定、DBは変更しない。

根拠は[テスト規則](../../../AGENTS.md)、[設計書規則](../AGENTS.md)、[レポート規則](../../report/AGENTS.md)、[確認ページ仕様](../../../../src/app/item/confirm/AGENTS.md)および現行コード。形式と階層間の分担は[itemDraftPage](itemDraftPage.md)を参考にする。参考文書の追加要求や過去の修正契約を、このページへ自動的に適用しない。

以下の `src/`・`test/integration/`・`test/fixtures/` は **client/基準**。`test/E2E/` と `server/` は **リポジトリルート基準**。ケースは U＝単体、C＝コンポーネント結合、P＝DOMページ結合、B＝ブラウザーページ結合、E＝E2E。Oを含むIDは仕様未確定部分の観測であり、現行挙動を望ましい契約として固定しない。P0＝基本契約・認証・所有権・入力境界、P1＝表示分岐・層間接続、P2＝補助的観測。複数条件はそれぞれ独立テストへ展開し、設計ID数を実行件数と混同しない。

対象外は購入、アップロード入力フォーム全体、他ページ専用の共有部品分岐、バックエンド全分岐の再検証。共有部品は確認ページから与えられる入力・操作を検証する。E2Eでは公開・更新の実APIと永続化を含める。

## 2. 処理と検証境界

| 対象                                                                                    | 処理・確認する境界                                                                                                                                |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/item/confirm/[id]/page.tsx`、`edit/[id]/page.tsx`                              | params解決→セッション確認→詳細取得→双方IDをString化・trimして所有者比較→normal/editを渡して本文表示。不一致は `/`、未認証は `/login`              |
| 両ページのgenerateMetadata                                                              | セッション確認→専用metadata取得→名前補完→title/description/robots。ここではseller_idを比較せず、所有者限定取得はAPIの責務                         |
| `confirm/api/server.ts`                                                                 | `/item-editing/:id/confirm` と `/item-editing/:id/metadata`、いずれもno-store。本文取得とmetadata取得を別APIとして検証                            |
| `confirm/itemConfirmPage.tsx`、`title.tsx`                                              | Container、Title、Back、動画・商品、UploadButton。`inventory?.current === 0` をsoldoutとして両側へ渡す。pageはURL側から決まりstatusから推定しない |
| `confirm/videoSection.tsx`                                                              | VideoElem、VideoTitle、ItemPeek、保存日時、Summary。summary null→空文字、itemId null、normalPage省略                                              |
| `confirm/itemSection.tsx`                                                               | Slideshow、ItemHeader(confirm)、VariantsList、Detail、CategoryText、DeliverySection。未設定値を補完                                               |
| `confirm/uploadButton.tsx`                                                              | 開閉・同意→POST/PUT→成功toast→sleep(1500)→返却itemIdで遷移。ApiErrorはtoast、その他はalert                                                        |
| `confirm/api/client.ts`                                                                 | `/items`へPOST/PUT、本文は `{ itemEditingId: Number(id) }`。編集IDと返却商品IDは別物                                                              |
| `src/lib/api/client.ts`、`server.ts`                                                    | 認証トークン取得・ヘッダー・JSON・エラー。Serverは401でlogin、404でnotFound、その他throw。Clientは未認証なら通信せずApiError                      |
| `src/app/item/itemSection/`、`videoSection/`                                            | 画像・動画・説明開閉・価格・属性・在庫。再生数や閲覧加点APIは確認画面から呼ばない                                                                 |
| `src/components/container/container.tsx`、`title-back/back.tsx`、`terms/terms-list.tsx` | 子要素表示、router.back、禁止事項の番号と本文                                                                                                     |
| `src/lib/formatRelativeTime.ts`、`sleep.ts`                                             | 保存日時整形と遷移前の待機                                                                                                                        |

共通部品の子に `itemSection/itemName.tsx` があり、confirmではrecommend=trueでも炎マークを表示しない。ItemPeekは `#itemName` へスクロールする。statusの相違や不正なURLをフロント独自の業務制約で拒否する仕様は追加しない。

バックエンド照合先は `server/src/routes/items.ts`、`server/src/usecases/itemEditing/getItemConfirmPage.ts`・`getItemConfirmPageMetadata.ts`、`server/src/services/itemEditing/query.ts`、`server/src/controllers/items/items.ts`、`server/src/usecases/items/create/createItem.ts`・`update/updateItem.ts`およびモデル。GETの他人・不存在は404。本文側の所有者不一致による `/` は、防御分岐としてテスト用APIでのみ再現する。実APIの404と混同しない。

## 3. 配置・環境・実処理とモック

以下は新規テストの予定配置。既存共有テストは内容を確認して回帰利用し、不足だけ追加する。

| レベル | 配置・対応ID                                                                                                                | 実処理／置換範囲                                                                                                                             |
| ------ | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| U      | `src/app/item/confirm/test/{title,itemConfirmPage,videoSection,itemSection,uploadButton}.test.tsx`：U-N01～05、U-E01、U-O01 | Vitest/RTL/jsdom。子部品を境界確認用に置換可。router、toast、alert、待機を制御                                                               |
| U      | `src/app/item/confirm/api/test/{client,server}.test.ts`：U-A01～03                                                          | Node。共通fetchをモックし引数・戻り値・例外を確認                                                                                            |
| U      | 共有部品直下の `test/*.test.tsx`、`src/lib/test/*.test.ts`、`src/lib/api/test/*.test.ts`：U-S01～09、U-A04～05              | 既存Slideshow/VariantsList/Detail/Summary/VideoElem/formatRelativeTimeテストを利用。Hls、Swiper、メディアAPI、寸法、時計を必要な境界だけ置換 |
| C      | `test/integration/components/item/itemConfirmPage/{uploadButton,itemSection,videoSection}/`：C-N01～03、C-E01、C-O01        | 子部品とAPI wrapper・共通fetchを実処理、HTTPのみMSW。認証取得とNext routerは置換                                                             |
| P      | `test/integration/pages/item/itemConfirmPage/confirm.test.tsx`：P-N01～02                                                   | 同期ItemConfirmPageを実構成で描画。MSW、router置換。async PageをRTL対応のため改変しない                                                      |
| B      | 同ページディレクトリの `confirm.spec.ts`：B-N01～03、B-E01～03、B-O01～02                                                   | production Next.js＋Playwright。SSR発GETはテストAPIサーバーへ向ける。ブラウザー発POST/PUTはpage.route等で置換。DB非接続                      |
| E      | `test/E2E/item/itemConfirmPage/{createItem,updateItem,getItemConfirmPage}/flow.spec.ts`：E-N01～03、E-E01～02、E-O01        | 実ブラウザー→実Next.js→Express→テストDB。対象業務APIはモックしない                                                                           |

ページ固有fixture/setupは `test/fixtures/item/itemConfirmPage/{fixtures,setup}.ts`。既存単体の現配置例は `src/app/item/itemSection/test/slideshow.test.tsx`、`variantsList.test.tsx`、`detail.test.tsx`、`src/app/item/videoSection/test/summary.test.tsx`、`videoElem.test.tsx`、`src/lib/test/formatRelativeTime.test.ts`。

MSWは未定義の対象通信をエラーとし、ケースごとにreset。DOM cleanup、タイマー復元、モック、イベント、Hls破棄、fixtureの複製を徹底する。SWRを直接使用する処理はない。全体Providerを利用する場合のキャッシュはケース間で分離する。Next/ImageやSwiperを置換した単体では実描画・画像最適化・スライド動作を保証せずBで補う。

## 4. fixtureと共通アサーション

標準は編集ID文字列`101`、seller_id=7、セッションuser.id=`7`、返却itemId=501。normal/editをパラメーター化し、statusも同じ値で準備する。異なるIDにより誤った遷移先・bodyを検出する。

- 商品名「確認用シャツ」、価格12000、説明と概要は短文、画像3枚（先頭画像も明示）、動画タイトル・thumbnail・original MP4・converted HLS、updatedAtは固定時計から1時間前。
- inventoryはinitial=10/current=5/low_stock_ratio=0.2。colorVariantsは2色、サイズあり/なし。素材は綿60%＋ポリエステル40%。性別men、年齢adult、recommend=true、sale_flag=false。関連選択肢とCategoryは異なる名前を持たせ、取り違えを検出する。
- 差分fixture：関連null、summary/detail null、割引値null、variants省略/空/1件、在庫省略/0/1、sale=true、converted null、長文、HTML風文字列。実JSONはid数値・updatedAt ISO文字列になるため、型アサーションで実データとの差を隠さず境界で確認する。
- 各失敗で成功toast・sleep・router.push・後続更新が未実行であることを確認。GET表示のみではPOST/PUT・閲覧加点・再生数変更がないことを確認する。
- ロール・ラベル・本文から要素を取得し、同名「出品する」はポップアップ内外の範囲を明確にする。固定時間sleepで非同期完了を推測しない。

## 5. 単体テスト

| ID・優先度 | 条件・操作                                                                    | 期待結果・停止位置                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U-N01 P0   | Titleをnormal/editで描画                                                      | 「出品する商品の確認」／「更新する商品情報の確認」。statusに依存しない                                                                                            |
| U-N02 P0   | ItemConfirmPage：current=0/1、inventory省略                                   | 0のみsoldout=trueを両側へ渡す。id/pageをUploadButtonへそのまま渡し、構成順を維持                                                                                  |
| U-N03 P1   | VideoSection標準・summary null                                                | 動画URL、タイトル、画像、商品名、価格、性別・年齢、保存日時が元フィールドに対応。summaryは空文字、itemId null、normalPageは渡さない                               |
| U-N04 P1   | ItemSection標準・関連null・discount null                                      | 全項目対応、detail/categoryは空文字、4配送関連名は「-」、割引は0。ItemHeaderのpage=confirm、DetailのitemId=null。variants省略/空は非表示、1件以上で表示           |
| U-N05 P0   | ポップアップを開く・チェック切替・背景/Xで閉じる・再表示、両page              | 初期非表示、禁止事項15件＋27件と同意欄、未同意alertでAPIなし。同意は再表示時も保持。編集リンクは両pageとも `/upload/edit/101`、ボタン文言は現行どおり「出品する」 |
| U-E01 P0   | 同意済みでAPIがApiError／通常Errorをreject（両page）                          | 前者は通信再試行案内toast、後者はシステムエラーalert。成功通知・待機・遷移なし。同意状態を維持して再試行可能                                                      |
| U-A01 P0   | fetchCreateItem/fetchEditItemへ`101`                                          | `/items`、POST/PUT、JSON本文のitemEditingId=101（数値）。返却itemIdを変更せず返す                                                                                 |
| U-A02 P0   | Server wrapperへ`101`                                                         | confirm/metadataの専用URL、no-store、戻り値同一参照。metadataのname=nullを許容                                                                                    |
| U-A03 P0   | wrapper依存のreject                                                           | 握り潰さず同一エラーを伝播、別APIの呼び出しなし                                                                                                                   |
| U-A04 P0   | 共通client fetch：トークン有/無、非2xx、通信/JSON失敗                         | Bearer・Content-Type、未認証はfetchなし。非2xxはcodeまたはAPI ErrorのApiError、通信/JSON例外は伝播。非JSONのHTTPエラーも現行parse順序に従い観測                   |
| U-A05 P0   | 共通server fetch：JWTなし/更新失敗、200/401/404/500                           | 前2つは通信前login、GETと認証ヘッダー、401 login、404 notFound、500例外。本文描画へ進まない。トークン値はログ・レポートへ出さない                                 |
| U-O01 P1   | client wrapperへ空白/空/非数値/0/負数/小数/過大ID                             | Number変換とJSON化を記録（NaNはnull）。ローカル検証を発明しない。実API拒否と区別                                                                                  |
| U-S01 P1   | ItemHeader/ItemName/ItemPeek：通常/売切/セール、性別3種×年齢3種               | 価格桁区切り、売切で価格非表示、sale時のみ元価格と正の割引値。kidsのみキッズ。confirmのrecommendマークなし                                                        |
| U-S02 P1   | DeliverySection：initial=1/2/4/5、current=0/1/2、閾値の直下/一致/直上         | initial<2は在庫行なし。initial<=4はcurrent=1が少量、2以上が在庫あり。initial>=5は比率閾値以下かつ1以上が少量、0は売切                                             |
| U-S03 P1   | 素材省略/空/合計99/100/101                                                    | 合計100かつ1件以上のみ名前・比率を表示                                                                                                                            |
| U-S04 P1   | VariantsList：在庫0・閾値一致/直上、inventory省略、サイズあり/なし            | SOLD/残りわずか、既定比率0.2。クリック/Enter/Spaceで開閉、別色選択で開いた対象が変わる。サイズの売切/少量classも確認                                              |
| U-S05 P1   | Detail/Summary：scrollHeightがclientHeightと同値/超過、null補完後の空文、長文 | 超過時だけもっと見る、開く/閉じるで文面・高さ更新。どの操作でも加点API未呼出。jsdomは寸法を明示注入                                                               |
| U-S06 P1   | VideoElem：HLS対応/非対応、converted null、両URL空、再生、URL変更/unmount     | converted優先、m3u8かつHls対応時だけload/attach、他はsrc、URLなしは案内文。poster・controls・playsInline、Hls destroy。再生数API未呼出                            |
| U-S07 P1   | Slideshow：画像1/3/0枚、2枚目をクリック/Enter/Space、閉じる                   | 対応画像でmodal開始、initialSlide対応、閉じて元のトリガーへfocus。実Swiperのloop/自動再生はBへ                                                                    |
| U-S08 P1   | Container/Back/TermsList/VideoTitle/CategoryText/ItemPeek                     | children・文言・番号が表示される。Backでrouter.back、ItemPeekでitemNameへscrollIntoView。実スクロールはBへ                                                        |
| U-S09 P1   | 固定時計でformatRelativeTime、sleep前後                                       | 59/60秒、59/60分、23/24時間、7日/8日で分/時間/日/日付の分岐。Dateと文字列で同値。sleepは指定時間未満で未解決、到達で解決                                          |

## 6. 結合テスト

| ID・優先度 | 条件・操作                                                              | 期待結果・停止位置                                                                                                                                                        |
| ---------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-N01 P0   | UploadButton＋実wrapper、同意→normal/edit送信、成功レスポンスitemId=501 | POST/PUTが正しい本文で1回。成功toastは「商品を出品しました」／「商品情報を更新しました」。制御時計で1499msまではpushなし、1500ms後に `/upload/ok/501`／`/item/501` を要求 |
| C-N02 P1   | ItemSection＋実子部品、セール/在庫/variants/関連null fixture            | 元データが最終DOMへ対応し、画像拡大・サイズ開閉・説明開閉が連携。配送自由入力やBrandなど未使用項目を独自表示しない                                                        |
| C-N03 P1   | VideoSection＋実子部品、MP4/HLS/動画なし・概要長文                      | 保存日時、プレビュー、動画、概要開閉が連携。再生・概要操作でも閲覧系APIなし                                                                                               |
| C-E01 P0   | POST/PUTを400/401/403/404/409/429/500、通信失敗、壊れたJSONにする       | ApiErrorなら共通toast、その他はalert。成功・遷移なし、再試行時のリクエスト内容が同じ。401もボタン自身はloginへpushしない                                                  |
| C-O01 P0   | 応答保留/成功待機中に連打・閉じる/再表示・編集要求・unmount             | 同期再入ガードで通信/通知は1回。実行・同意・編集は無効。失敗で復旧。unmount後の待機解放ではpushなし。通常assertで検証                                                     |
| P-N01 P0   | ItemConfirmPage実構成をnormal/editで描画し送信まで操作                  | タイトル、商品、動画、操作の統合、正しいAPIと返却商品IDへの遷移要求。routerの引数までが保証範囲                                                                           |
| P-N02 P1   | 在庫0・1・省略、関連null・長文fixtureへ切替                             | 動画側と商品側のSOLD OUTが同期。nullの文字列露出なし。閲覧・再生数APIは未実行                                                                                             |

## 7. ブラウザーページ結合

各ケースは両ルートで実施。APIサーバーはGETへの認証・入力に応じたレスポンスを返し、metadataと本文それぞれの要求を記録する。ブラウザーのpage.routeでSSR通信まで捕捉したとみなさない。

| ID・優先度 | 条件・操作                                                                    | 期待結果・停止位置                                                                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-N01 P0   | 認証所有者で直接アクセス、metadataのname通常/null/空文字                      | 本文はconfirm GET、headはmetadata GET。正しいtitle/description、空名は商品名未入力、noindex/nofollow。更新metadataは「更新する商品の確認」、画面タイトルは「更新する商品情報の確認」の現行差を維持 |
| B-N02 P1   | 表示→画像拡大/次画像/閉じる、動画再生、説明開閉、ItemPeek、戻る/再訪/リロード | 実Swiper・動画・スクロール、履歴遷移が機能。プレビュー操作で閲覧加点・再生数APIなし。Hydration警告・未処理例外なし                                                                                 |
| B-N03 P1   | 幅375/767/768/1280、Chromium/Firefox/WebKit                                   | 768px未満で縦、以上で2カラム。画像・動画・禁止事項スクロール・同意・送信が利用可能。横はみ出し・重なりなし                                                                                         |
| B-E01 P0   | 未認証、SSR認証切れ                                                           | loginへ遷移し機密本文を表示しない。セッションなしでは本文/metadata API要求なし。共通fetch認証切れの停止位置も区別                                                                                  |
| B-E02 P0   | 詳細に別sellerを返す、実API相当404、metadataのみ404/401/500                   | seller不一致は `/`。404はNot Found、401 login、その他エラー境界。商品名・本文・送信UIを非所有者に露出しない。metadata単独失敗時の本文との競合も確認                                                |
| B-E03 P0   | 名前/概要/説明/カテゴリにHTML風文字、遅延GET/POST/PUT                         | 文字として表示しscript実行なし、機密ログなし。遅延中に成功通知・完了遷移を先行させない。SSR失敗から更新通信へ進まない                                                                              |
| B-O01 P0   | Tab/Shift+Tab/Enter/Space/Escape、dialog/画像拡大の開閉と背景操作             | 名前付きdialog/閉じるbutton、初期focusと復帰、focus循環・背景逸脱抑止、Escape/背景クリックで閉じる。Backは名前付きbuttonでキー操作可能。画像の既存focus復帰も維持                                  |
| B-O02 P2   | 大きい画像・長文・多数variants、低速メディア、両ルート/status不一致           | 表示と操作可能になるまでを計測し、再描画・動画再初期化・画像失敗を観測。閾値やstatus自動遷移は発明しない                                                                                           |

## 8. E2E（API・DBを含む）

事前にテスト専用DBであることと必要スキーマを確認し、IDを限定してユーザーA/B、編集セッション、更新対象商品・動画・関連データを準備する。マイグレーションは実行しない。作成/更新仕様に合う有効データを利用し、実装時に対応usecase・モデルと保存先のフィールド対応を確定する。外部S3・変換・通知等を置換する場合は、その範囲と未保証をレポートへ明記する。

| ID・優先度 | 条件・操作                                                             | 期待結果・DB確認                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E-N01 P0   | A所有のnormal編集データを開き同意して出品                              | 実POST成功、返却itemIdの完了画面。新規商品と関連する動画・配送・セール等が実契約どおり編集元から保存され、所有者・公開状態・関連IDが整合。別商品の行は不変 |
| E-N02 P0   | A所有の既存商品用editデータを開き同意して更新                          | 実PUT成功、返却itemIdの商品画面。対象商品の変更項目と関連データが保存され、対象外商品と所有者は不変。別商品作成として成功扱いしない                        |
| E-N03 P0   | 両ルートのGETとmetadata、表示操作のみ                                  | 専用APIの所有者限定レスポンス、head/本文一致、null/空名の補完、robots。商品・在庫・閲覧数・再生数・編集データは変更なし                                    |
| E-E01 P0   | 未認証・BがAの編集ID/不存在IDへアクセス、別ユーザーIDで更新API直接要求 | 実認証・認可で拒否。GETは他人/不存在404、名前・本文・操作を漏らさない。POST/PUTの具体的codeは現行契約を照合し、対象商品・関連行は不変                      |
| E-E02 P0   | 表示後に編集セッション削除/失効、別端末で更新、改変IDで送信            | 実APIの拒否・競合契約を確認し、失敗なら成功通知・完了遷移・部分保存なし。競合の扱いが未定なら観測へ分類し、任意の409を要求しない                           |
| E-O01 P0   | 実POST/PUT連続操作・二タブ送信・成功後の戻る/再送                      | リクエスト結果、商品件数、関連重複、通知と遷移を観測。フロントの通信数とサーバーの重複防止を別々に記録し、二重公開・整合性問題を見逃さない                 |

E-N01/E-N02では属性JSONの各在庫currentがinitialへリセットされること、成功後に対象ItemEditingが削除されることもDBで確認する。失敗時には編集元を含め部分的に消失しないことを照合する。

後片付けは作成IDを追跡し依存順に削除、接続をcloseする。テスト失敗時も実行し、他テストのデータを一括削除しない。成功時だけでなく拒否時も対象ID限定スナップショットでDB不変を確認する。SQLやトークンの値を成果物へ転記しない。

## 9. 実装順・実行計画・完了条件

1. P0の認証・取得API・所有者・メタデータ・送信分岐・失敗停止を優先し、U→C/P→B→Eへ進める。
2. P1の共通表示、在庫境界、操作、レスポンシブ・ブラウザー互換性を補完する。
3. Oケースを観測して確定契約との差と要確認事項を記録する。観測成功を二重送信防止やアクセシビリティ達成と同一視しない。

将来の実行コマンド（今回は未実行）：

```bash
# client/：対象パスで絞り、共有部品の関連回帰も実行
npm run test:unit -- src/app/item/confirm src/app/item/itemSection/test src/app/item/videoSection/test src/lib/test
npm run test:integration -- test/integration/components/item/itemConfirmPage test/integration/pages/item/itemConfirmPage
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
npm run build
npm run test:pages:browser -- test/integration/pages/item/itemConfirmPage/confirm.spec.ts
# リポジトリルートのtest/：実Next・Express・テストDBを準備して実行
npm run test:e2e -- E2E/item/itemConfirmPage
```

単体コマンドで拾わない `src/lib/api/test/` とContainer/Back/TermsListの対象追加・既存回帰も実装時に選定する。本番typecheckとテストtsconfigの収集範囲を確認し、通常lint対象外のTSは既存ESLint設定による追加検査を記録する。共有設定を検査の都合で変更しない。ブラウザーテストはproduction build/startで、[環境手順](../../../../../test/README.md)に従い3ブラウザーを準備する。

設計書としての完了条件は対象処理とケース・予定配置・依存境界・未確認事項が追跡でき、相対リンクと差分が整合すること。将来の検証完了は全必須ケースの実装・実行結果とOケースの観測、未実施理由・環境制約を `client/test/docs/report/item/itemConfirmPage.md`（予定）に記録して判定する。skipや未作成を成功扱いしない。

F1/F2の再送・focus・Escape・unmount契約は冒頭で確定し再検証する。同意は既存どおり保持。残る未確認事項：statusとURLの不一致、PUT競合・再送時の詳細契約、性能目標。今回はこれらの修正・仕様決定や実測を行っていない。文書変更のみのためテスト・lint・型検査・buildは未実行。
