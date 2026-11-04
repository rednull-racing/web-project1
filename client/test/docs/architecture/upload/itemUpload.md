# 商品アップロード・商品編集ページ テスト設計書

## 1. 対象・根拠・状況

作成日: 2026-11-04。対象は `/upload/[id]` と `/upload/edit/[id]`。依頼の配置に従い、2ページをこの1ファイルにまとめる。共通ケースは両ページに適用し、差分を明記する。

本書は設計のみ。テスト・fixtureは予定配置であり、実装・実行済みを意味しない。人間観測も未実施。

- 規則: [テスト全体](../../AGENTS.md)、[設計書](../AGENTS.md)、[レポート](../../report/AGENTS.md)。
- 根拠（リポジトリルート基準）: `client/src/app/upload/` の現行コード、`docs/design/backend/itemUpload.md`、`docs/design/backend/detail/itemEditing/getItemEditingForm.md`。
- 既存参考: [確認ページ設計](../item/itemConfirmPage.md)、[下書きページ設計](../item/itemDraftPage.md) と対応テスト・fixture。既存の成功を本対象の検証成功として扱わない。
- 範囲: 初期表示、全入力部品、Hooks、API、メディア転送、確認先への引渡し、通常ページの下書き保存。
- 対象外: `/upload/before` のセッション作成、確認画面での最終公開・更新、完了画面、cron、バックエンド各層の全分岐の再テスト。
- 契約の優先: 確定API設計を通信契約、現行コードをUI・変換の根拠とする。不一致・未定義の制約はQ系で観測し、新しい業務制約を発明しない。

以下パスは原則 `client/` 基準。`test/E2E/`、`docs/`、`server/` から始まるパスのみリポジトリルート基準。

## 2. 構成と処理境界

| 対象ファイル（`src/app/upload/` 基準） | 責務 |
| --- | --- |
| `[id]/page.tsx`、`edit/[id]/page.tsx` | 非同期Server Component。session、フォーム取得、所有者比較、normal/editのForm、metadata |
| `form.tsx` | 初期値展開、全入力state、検証、body、登録・下書き・転送の順序、通知・遷移 |
| `uploadUI.tsx`、`layout.tsx` | Container・TitleAndBack・childrenとToastBoundary |
| `videoInput.tsx`、`itemImage.tsx` | ファイル入力・既存プレビュー、商品画像追加削除 |
| `itemNameDetail.tsx`、`category.tsx`、`genderAge.tsx`、`brandInput.tsx` | テキスト、階層選択、対象制約、ブランド候補 |
| `attributes.tsx`、`material.tsx` | 在庫・カラー・サイズ・属性画像、素材配列 |
| `condition.tsx`、`shipping.tsx`、`price.tsx` | マスター選択・備考・価格・手数料 |
| `hooks/useUpload.ts`、`hooks/useFileUpload.ts` | 検証・JSON変換、動画POST/変換PATCH、画像PUT |
| `api/server.ts`、`api/item.ts`、`api/video.ts` | 初期GET、登録PUT、下書きPOST、変換PATCH。fetchItemHighlightは対象外 |

間接依存は `src/components/inputForm/` のInputTitle/InputStr/Textarea、Container/TitleAndBack、`src/components/loading/topLoader.tsx`、`src/providers/toastBoundary.tsx`、`src/lib/api/{client,server}.ts`。本ページとの値・イベント・loading・通知・認証の接続を確認する。他画面向け全分岐は対象外。

初期処理: session → GET form → 所有者比較（String化してtrim）→ Form。未認証は `/login` へ遷移しGET未実行。所有者不一致は `/upload/before` へ遷移しフォーム非表示。

出品処理: 検証 → PUT → 動画POST → editing変換PATCH → サムネイルPUT → 商品画像PUT群 → 属性画像PUT群 → 成功通知 → 1500ms待機 → assign。下書きは緩和検証 → POST → 同じ転送順（変換先は応答のitemDraftId）→ 一覧へassign。既存ファイルは転送を省略する。画像群内はPromise.allのため失敗時も開始済み兄弟通信の取消を保証しない。

| ページ | mode | 出品成功先 | 下書き | metadata |
| --- | --- | --- | --- | --- |
| `/upload/[id]` | normal | `/item/confirm/{id}` | 表示。成功先 `/item-list/draft` | title「商品を出品する」、description「商品の出品はこちら！」 |
| `/upload/edit/[id]` | edit | `/item/confirm/edit/{id}` | 非表示、画面操作からPOSTなし | title「商品を編集する」、descriptionは現行の編集案内文 |

両metadataのrobotsはindex/follow=false。Form見出しは両方「商品をアップロード」。

## 3. 階層・予定配置・モック境界

| レベル | 予定配置 | 実処理と置換・保証限界 |
| --- | --- | --- |
| U: 単体 | `src/app/upload/test/<部品名>.test.tsx`、`hooks/test/{useUpload,useFileUpload}.test.ts`、`api/test/{server,item,video}.test.ts`（hooks/apiもupload配下） | Vitest/RTL、実部品・検証・変換。制御props用の親でstate更新。HTTPはMSW、API wrapper単体のみ共通関数をspy。DOMは描画ピクセルを保証しない |
| C: コンポーネント結合 | `test/integration/components/upload/itemUploadPage/{form,categoryGender,media}/integration.test.tsx` | 実Form・子・Hooks・API、HTTPのみMSW。normal/editを展開。assign・toast・alert・ObjectURLを観測用に置換 |
| P: ページ結合 | `test/integration/pages/upload/{itemUploadPage,itemUploadEditPage}/page.spec.ts` | 本番相当Next.jsで非同期Server Componentを実行。サーバー発GETはテスト用APIサーバー、ブラウザー発通信はrouteで置換。テスト用session。DBなし |
| D: E2E | `test/E2E/upload/{itemUploadPage,itemUploadEditPage}/{saveEditing,authorization}/flow.spec.ts`、通常のみ `test/E2E/upload/itemUploadPage/saveDraft/flow.spec.ts` | 実ブラウザー→Next.js→Express→テストDB。業務APIはモックしない。ストレージ/動画変換は隔離テスト環境。代替時は保証限界を記録 |
| fixture | `test/fixtures/upload/{itemUploadPage,itemUploadEditPage}/` | fixtures.ts/setup.ts/ページ用APIサーバー。共通データは明示importし差分定義 |

単体の部品名は本書の構成表の全入力部品とuploadUIを対象とする。共通部品の単体は各本番ファイルに最も近いtestへ置き、既存テストがあれば再利用する。

MSWは未定義対象APIで失敗させる。テストごとにhandler・認証モック・timer・UUID・ObjectURL・通知spyを復元しunmount。上位layoutでSWRが関与する場合はキャッシュも隔離する（Form自身はSWRなし）。role/ラベル/テキストを優先し、ラベル未関連付けを隠すため本番DOMを改変しない。非同期更新は待機assertで確認し固定sleepを使わない。

非同期Server ComponentをVitestで直接描画する方式へ変更しない。DOM結合の遷移保証はassignの引数まで。P/Dのブラウザー自動検証は認証・通信契約・内部SSR整合性等に限定し、見た目のために重複起動しない。

## 4. 標準fixture・変換対応

- 所有者A=id7、第三者B=id8、未認証。editing id123、下書き応答id456。normal/editは対応する有効statusのデータを作成する。URLだけで所有権を保証しない。
- 基準: hasShop=true、商品名「綿シャツ」、動画タイトル「着用動画」、価格1000、全在庫2、赤/青各1、各サイズM在庫1、綿60/麻40、マスター全選択済み。親子カテゴリー、性別/年齢制約あり・なしを用意。
- 新規File一式、既存URL一式、混在、関連null/nullable値/空配列、hasShop=falseを差分とする。各画像の名前・内容を識別可能にする。
- 署名応答: 動画POST url/fields、サムネイルURL、商品画像index付きURL、属性画像map。既存のみではnull/空配列。障害注入は対象通信だけを遅延/HTTP失敗/reject/不正JSONへ変更。

| 取得元 | 初期値・送信先と共通assert |
| --- | --- |
| converted_url / original_url | converted優先、いずれかありでvideoUploaded=true。thumbnail_urlはプレビューと既存フラグ |
| テキスト・各関連 | nullは空文字等の既定値、Category/Brand/状態/配送のID・名称・階層を保持 |
| before_price / price | truthyかつNaNでないbefore_price優先、0/null/NaNはprice |
| attributes.inventory.current | all_inventory、欠落時1。色/サイズもcurrentを展開、既存uiId優先、欠落時UUID。image_urlをmap化。素材ratio欠落時1 |
| image_url | 元順序、uploaded=true/file=null。追加はFile/ObjectURL/uploaded=false |
| 入力state→body | video/thumbnail/itemImagesのname/type/uploaded、videoMeta、itemMeta、category、genderAge、brand、attributes.allInventory/colorVariants/materials、condition、shipping、Number(price)を個別比較 |
| 属性画像 | _uiId→uiId、新規File情報/既存URL末尾/なしnullを区別。画像と署名URLの対応を内容で確認 |

共通assert: 通信回数・対象ID・body、失敗時通知/loading解除/後続段階未実行、成功時のみ遷移。開始済み並列転送や先行DB保存をロールバックしたと推測しない。

## 5. 単体ケース

U/C/P/Dはレベル、Qは自動観測、Oは人間観測。P0=基本契約・境界・認可、P1=分岐・接続、P2=補助観測。各行の複数条件を独立テストに展開し、ID数を実行件数としない。

| ID・優先度 | 入力・手順 | 期待結果 |
| --- | --- | --- |
| U01 P0 | validateUploadの必須値を1つずつ欠落、タイトル/商品名に空白、複数欠落 | 動画、サムネイル、タイトル、画像、商品名、category、性別、年齢、在庫、状態、配送3項目、価格の各メッセージ。複数欠落は現行順の最初。検証で停止 |
| U02 P0 | 価格299/300/1000000/1000001/NaN、素材合計0/99/100/101 | 価格両端通過・範囲外/NaN拒否、素材100以下通過/101拒否。既存動画/サムネイルはFileなしで通過 |
| U03 P0 | 色/サイズ合計0/1/2と全在庫の等値・小・大 | 出品は合計2以上で全在庫との不一致拒否、0/1は一致検査なし。カラー判定が先 |
| U04 P0 | validateForDraftに未入力/価格0、素材101、色/サイズ合計2以上の等値・小・大 | 必須未入力/価格0通過、素材超過拒否。現行は色合計<全在庫で拒否、サイズ合計>全在庫で拒否。色条件の意味はQ01で確認 |
| U05 P0 | 新規/既存/画像なしを混ぜcreateBody | 前節全項目の値・順序・null・数値変換、商品既存画像URL末尾（空ならunknown）、入力非破壊。File/Blobやpreviewそのものをbodyへ混入しない |
| U06 P0 | 動画未選択、500MiB-1/同値/+1、動画とサムネイル差替え | 未選択は変更なし。同値まで採用、+1はalert・inputクリア・値保持。差替えuploaded=false、新規動画優先/既存/なしの表示分岐。acceptだけでMIME検証済みとしない |
| U07 P1 | タイトル/商品名49/50/51文字、概要/詳細/配送備考499/500/501文字をUI入力 | maxLength50/500とUI入力上限、他項目保持。直接stateへ長文を入れた拒否はUI属性で保証しない |
| U08 P0 | 商品画像0/9/10枚から複数追加、先頭/中間/末尾削除、再選択 | 最大10枚、超過切捨て、10枚で追加disabled、削除後追加可能。onRemove index、残存順と送信index、inputクリア |
| U09 P1 | Category初期level1/level2/未選択、親変更、子選択、選択しない、空/失敗応答 | 親子表示・GET、親変更で子表示クリア、値・制約通知。選択しないで親値へ。取得失敗通知・loading解除、空候補で例外なし |
| U10 P1 | GenderAge各enum/nullの制約と制約変更 | 汎用値/制約なしで全候補、単一制約で自動補正、ラベルとenum対応、同値の余計な更新なし、親との更新が収束 |
| U11 P1 | Brand連続入力、300ms前/到達、候補選択、空、HTTP/JSON失敗、unmount | debounce検索、選択id/name、選択中検索抑止、空/失敗で候補クリア。blur150ms/選択後500msはfake timer。IDと手入力の整合はQ03 |
| U12 P0 | 属性の全在庫0/1/2、色/サイズ追加削除、画像差替え、unmount | 在庫最低1へ補正、全在庫1で色配列クリア、2かつ空なら色生成。対象だけ更新、新規画像優先/既存map、属性ObjectURL解放 |
| U13 P1 | 素材追加・対象行変更・中間削除 | 名前空/割合1で追加、他行保持・順序維持、min/max1/100属性と合計検証を区別 |
| U14 P1 | 状態・配送初期値、別候補/同候補、空一覧、備考null | ID/名称一致、他値保持、同値変更抑止、開閉、null備考空表示。空一覧で例外なし、出品はU01で停止 |
| U15 P1 | 価格1000、カンマ付き、空、非数値 | 利益900/手数料100、カンマ表示、空→0、非数値→NaNで出品拒否。独自の丸め規則を追加しない |
| U16 P1 | UploadUI・共通入力・TopLoader・ToastBoundaryの接続 | title/children、必須表示/属性・最大長・onChange、loadingと通知。戻る要求はTitleAndBackの既存実装に従う。見た目はO系 |

## 6. API・ファイル転送ケース

パスはAPIベースURLからの相対。実サーバーでは `/api` マウントを含めて設定し、二重付与を避ける。

| ID・優先度 | 条件・通信 | 期待結果・停止位置 |
| --- | --- | --- |
| U17 P0 | fetchUploadPage('123') | GET `/item-editing/123/form`、cache=no-store、7キーの応答をそのまま返す。共通関数rejectも伝播 |
| U18 P0 | fetchMain('123',body)、fetchDraft('123',body) | PUT `/item-editing/123` + JSON body、POST `/item-draft` + bodyに数値itemEditingId=123。下書き応答itemDraftId保持。失敗伝播 |
| U19 P0 | fetchVideoConvert、fetchDraftVideoConvert | PATCH `/item-editing/123/convert` と `/item-draft/456/convert`、ID混同なし、不要bodyなし、失敗伝播 |
| U20 P0 | videoUploadAndConvertのediting/draft、新規File/署名あり | 署名fieldsと末尾fileをFormDataへ、署名URLへPOST（JSON Content-Typeを付けない）、成功後だけ対象PATCH。業務APIのBearerをストレージへ転送しない |
| U21 P0 | 動画のFileなし/署名なし、POST非2xx/reject、PATCH失敗 | どちらか欠落なら現行はtrueで転送省略。POST非2xxは動画失敗toast・false・PATCHなし、reject/PATCH例外は上位へ。欠落を無条件に正当化しない（Q05） |
| U22 P0 | thumbnailUploadの新規/既存、PUT失敗/reject | Fileと署名が揃う時だけPUT、Content-Type=File.type、body=File。非2xxで所定toast/false、rejectは上位へ |
| U23 P0 | 商品画像の疎なindex、既存混在、逆順署名、範囲外index、PUT失敗/reject | indexで対応FileへPUT。既存/Fileなし/範囲外はskip、署名空はtrue。1件失敗でtoast/false、後続属性段階なし。開始済み他PUTは取消保証なし |
| U24 P0 | 属性画像map空/null/undefined、複数画像、PUT失敗、画像不足 | 空はtrue、Fileだけ抽出してObject.values(map)順にPUT。画像不足はskip、失敗toast/false。キーによる対応はQ04で別観測 |
| C01 P0 | 実共通apiFetch経由、トークン有/無、401/403/404/429/500、ネットワーク/JSON失敗 | トークンなしはHTTP前にApiError。Bearer/JSONヘッダー、API code→ApiError。FormではApiErrorの所定失敗toast、それ以外alert、loading解除、転送・成功通知・遷移なし |
| C02 P1 | CategoryのGET `/categories/{parentId}/level2`、BrandのGET `/brands/suggest?keyword=...` | cache=no-store、category2/brandsの応答形式、空・エラー・遅延の反映。検索語の特殊文字はQ03。これらは共通apiFetchを通らない |

## 7. フォーム・ページ結合ケース

| ID・優先度 | 前提・手順 | 期待結果・後続未実行 |
| --- | --- | --- |
| C03 P0 | 標準fixture/nullable/既存のみ、hasShop true/falseでForm描画 | 第4節の初期値、全入力部品、既存ファイルflags、ショップ時のみ属性欄。非表示でも既存属性stateがbodyへ入る現行動作を識別 |
| C04 P0 | 両モードで正常入力して出品 | 実validate/createBody→PUT→第2節の順序。既存のみは転送なし。成功toast「商品データを登録しました」、該当確認先へ1回assign。1500msはfake timerで進める |
| C05 P0 | normalで必須未入力の下書き、応答draftId456、動画あり/なし | POSTのIDはediting123、変換はdraft456。保存成功toast「下書き保存しました」、一覧へassign。editには下書きボタンなし・POSTなし |
| C06 P0 | 各検証失敗、登録/下書きAPI失敗、転送各段階でfalse/throw | 検証失敗はAPIなし。API失敗は全転送なし。転送失敗は後続段階・成功toast・assignなし。ApiErrorは登録「データ作成に失敗しました」/下書き「下書き保存に失敗しました」、その他は所定alert。loading解除、入力保持 |
| C07 P0 | APIと転送を未解決にして同じボタンを連打、その後成功/失敗 | 当該ボタンdisabledと登録中/保存中、TopLoader、通常クリックで重複通信なし。失敗後再操作可能。別ボタン同時押下・成功待機中はQ02 |
| C08 P1 | カテゴリー制約変更→性別/年齢補正→送信、画像削除→追加→送信 | 子の操作が親state・body・送信Fileに反映、古い表示値だけを送らない。既存画像保持、新規分のみ転送 |
| P01 P0 | 両URLへ所有者/未認証/第三者でアクセス | 所有者はGET後に正しいmode、未認証はlogin・GETなし、取得済みseller不一致はbefore・フォーム非公開。文字列/数値IDとtrimも確認 |
| P02 P0 | form GETへ401/404/400/403/429/500、通信/不正JSON | 実apiFetchServerを通し401→login、404→notFound、その他はエラー境界へ。成功フォーム・更新通信なし。429が非JSONならJSON解析例外となる経路も識別し、独自の再試行UIを期待しない |
| P03 P1 | 両ページの初回SSR、nullable・既存メディア・属性ありの初期値 | サーバー取得とクライアント初期値の整合、hydration例外なし、metadata title/description/robotsとmodeを比較。ランダムUUID由来の不一致も検出。画面のちらつきはO04 |
| P04 P0 | 改ざんID0/-1/小数/英字/2147483648、他人ID、存在しないID | バックエンドの400/404等を用いP02の分岐へ。画面へ私有データなし。フロントに独自のID検証があると仮定しない |

## 8. E2EケースとDB・外部サービス境界

既存テスト用DBと本番相当 `next build`/`next start`、Express、テスト用認証を準備する。マイグレーションは実行しない。専用ユーザーと自作IDだけをseed/cleanupし、DB接続を終了する。認証情報・署名URL・個人情報をレポートへ転記しない。

| ID・優先度 | 手順 | 期待結果・確認範囲 |
| --- | --- | --- |
| D01 P0 | normal/edit用セッションを用意→入力/変更→出品→確認先を取得 | item_editingへ値と関連・ファイル参照が保存され、確認GETの値と一致。商品画像順・属性画像対応・変換結果を比較。この時点では公開商品itemを新規作成/更新しない |
| D02 P0 | normalで未入力/部分入力/既存メディアの下書き保存 | item_draftの値、元item_editing削除、一覧から保存データ取得。変換の対象はdraft、公開itemへの副作用なし。業務API自体の失敗時は元editing保持（バックエンド契約） |
| D03 P0 | 第三者/認証切れでform取得とPUT/POST/PATCHを直接実行、URL・bodyの所有者ID偽装 | 正規APIで拒否、非公開値なし、対象/第三者の行・メディア参照不変。UIの非表示だけで認可済みとしない |
| D04 P0 | API保存後、動画/サムネイル/商品/属性転送を各段階で失敗させる | 確認/一覧へ進まない。DB保存と外部転送は単一transactionではないため、残存editing/draftと未転送ファイル参照を記録。下書きPOST成功後はediting削除済みの場合があり、再送成功や全体rollbackを期待しない |
| D05 P1 | 既存メディアを保持して再取得、新規動画へ差替え | 既存のみでは不要な転送/変換なし、新規のみ正しいレコードを変換。変換失敗はconverted_url=null・original_url保持というAPI契約を確認。外部代替使用時は実変換品質まで保証しない |

D04はストレージ失敗を注入してもExpress/DBの業務APIを置換しない。バックエンドのトランザクション詳細は既存serverテストを参照し、本書では画面起点の永続化・停止位置を検証する。

## 9. 敵対的入力・競合と要確認事項

以下は現行コード上の注意点に対する自動観測設計。未実行であり、不具合確定・修正済み・望ましい仕様の保証とはしない。本依頼では本番コードを修正しない。Qケースは実行後に入力・実結果・仕様判断を対応レポートへ記録する。

| ID・レベル・優先度 | 手順 | 現行観測点・判定保留事項 |
| --- | --- | --- |
| Q01 U P0 | 下書き色合計2/全在庫3、色合計3/全在庫2を比較 | 現行は前者を「超過」として拒否、後者通過。条件と文言が逆方向。業務上の許容条件の確認が必要 |
| Q02 C/D P0 | 出品処理中に下書き、逆順、成功後1500ms内再クリック、同一セッション別タブ保存 | loadingは操作別で相互排他なし、成功時は待機前に解除。PUT/POSTや削除と更新の競合・二重draft作成・DB結果を観測。APIが競合拒否する場合は副作用なしも確認 |
| Q03 U/C P1 | 親A→Bを選びA応答を後着、ブランド検索語を連続変更して逆順応答、選択後手入力、`&`/`#`入り検索語 | 古い候補/制約の上書き、ブランド既存id残存、URL未encodeの影響を通信で観測。古い候補を抑制する実装があると仮定しない |
| Q04 U/C/D P0 | 属性2色の署名mapキー順を逆転、画像のない色を挟む、色削除後アップロード | 現行はmapキーでなくObject.valuesとFile抽出順で対応。別色への誤転送を内容で検出し、返却順保証の有無を確認 |
| Q05 U/C P1 | Fileあり署名なし、署名ありFileなし、成功後の再送、属性image_uploadedとFile不整合 | スキップ成功・flags未更新・再送の実際を記録。出品と下書きで属性画像resolverの条件が異なる点も比較 |
| Q06 U/C P1 | MIME偽装、負数/小数在庫・素材、価格小数/Infinity、maxlength超過をstate/HTTPへ直接注入 | UI属性とHook/APIの実拒否範囲を分ける。未定義の上限・整数制約を発明せず、サーバー確定制約のみ合否判定 |
| Q07 C/P P1 | HTML/script文字列を商品名/概要/候補へ、認証切れ、署名通信失敗 | DOMで文字として扱われscript実行なし。トークンをDOMやストレージヘッダーへ露出しない。ログの個人情報/内部値露出は別途記録 |
| Q08 U/C P2 | メディア選択を繰返し、再描画・削除・unmount、価格propsを正値→0へ変更 | ObjectURL生成/解放の対応、残留、価格派生表示の更新を観測。性能測定は生成回数等の根拠と対象環境を記録し、未合意の時間閾値を設けない |

## 10. 人間による目視観測

全件担当「人間」、状況「人間確認待ち」。記録先（予定）は `client/test/docs/report/upload/itemUpload.md`。前提は隔離テスト環境、所有者A（ショップあり/なし）、新規/既存メディアと長文入りデータ、通常/編集両URL。各観測をChromium/Firefox/WebKit、幅375/768/1440pxで必要に応じて組み合わせる。

| ID | 手順 | 目視の期待結果 |
| --- | --- | --- |
| O01 | 各幅で先頭から末尾までスクロール、長文・10画像・複数色を表示 | 横溢れ・文字切れ・ボタン重なりなし。画像比率と動画プレビューが確認できる |
| O02 | 動画/画像選択・差替え・削除、カテゴリー/候補選択、在庫/素材操作、出品/下書き→戻る/リロード | 操作対象が分かる、誤操作を誘わない、確認先がモードに対応。保存前の戻る/リロードによる未保存入力の扱いは現行仕様として記録し、保持機能を前提にしない |
| O03 | Tab/Shift+Tab/Enter/矢印で入力・候補・画像削除・戻る操作 | ラベル、到達性、フォーカス可視性・復帰を確認。操作不能があれば記録。現行のクリック要素をキーボード対応済みとみなさない |
| O04 | 遅延/失敗/空マスターを表示し、初回読込と登録・保存を行う | loading・通知・空表示が判別でき、初期ちらつき/崩れなし。ブラウザー差や動画再生差を記録 |
| O05 | 大きい動画/多数画像・色で入力とプレビュー、再選択を繰返す | 読込と入力応答の体感、固まり/劣化を記録。定量的な性能保証とは分ける |

## 11. 実装優先度・実行計画・完了条件

P0の検証・変換・転送順・認証/所有権とD01〜D04を先行し、P1の部品分岐・接続、P2観測へ進む。Qの重要競合はP0として先行する。テスト実装・本番修正・依存追加は今回の作業範囲外。

将来実装後の実行例（すべて予定。fixture/setupを整備してから実行）:

```bash
cd client
npm run test:unit -- src/app/upload
npm run test:integration -- test/integration/components/upload
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
npm run build
npm run test:pages:browser -- test/integration/pages/upload
npm run test:e2e -- E2E/upload
```

ページ結合/E2Eは既存Playwright設定のwebServer・project・認証方法と整合させる。サーバー発通信をpage.routeだけで置換しない。ブラウザーOS依存関係等はリポジトリルート `test/README.md` を参照。通常lintの対象外TSが生じた場合は既存ESLintで対象を明示して追加検査し、共有設定を検査のために変更しない。

現行 `client/tsconfig.json` は広いincludeで単体テストも含み、`client/test/tsconfig.json` はtest・src内test・ランナー設定を明示includeする。規則中の「本番型検査は単体を除外」と現設定に差があるため、実装時に収集範囲を確認して双方の結果を記録する。独断で除外設定を変えない。

自動検証の完了は、ケース各条件のassert・失敗時後続停止・DB不変範囲を確認し、対象コマンドと未実施理由、Qの結果/仕様判断を対応レポートへ記録した時点とする。ID数、表の行数、展開後の実行件数を区別する。人間観測は別の完了条件とし、結果受領まで成功件数に含めない。

今回の完了範囲は設計書作成とパス・リンク・契約・差分の確認のみ。テスト未実装・未実行、カバレッジ未取得、人間観測待ち。外部サービスの実環境検証、競合の業務上の期待値、Q系の判定は未確認として残す。

## 12. 2026-11-04 実装・実行時の補足

テスト実装・実行の最新結果と修正案は、今回のユーザー指定先 [統合レポート](../../../../docs/report/upload/itemUpload.md) に集約する。上記の予定配置・未実施表記は設計作成時点の計画であり、実装範囲・実行件数・残件は同レポートを正とする。

実Formの初期描画収束に失敗したため、全体結合の収束テストと、GenderAgeだけを置換して残る通信処理を分離する結合テストを分ける。後者の成功を実フォーム全体の成功としない。追加の既存属性uiId欠落ケースはC03/C08の補完であり、契約変更ではない。

追加ケース Q09（C、P0）: 動画変換PATCHの202受付をMSWで返し、Formが完了照会なしに確認先へ進む現行挙動を観測する。`docs/design/backend/detail/itemEditing/convertItemEditingVideo.md` の202は非同期受付であり、変換完了や業務上の成功を保証しない。U19〜U21/C04/D05の「変換成功」はHTTP応答成功と実変換完了を分ける。内部失敗をHTTP非2xxとして必ず検出できると解釈しない。
