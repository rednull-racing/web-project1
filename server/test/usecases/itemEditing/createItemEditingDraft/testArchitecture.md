# 下書きから商品編集セッション作成：テストコード設計書

## 1. 目的・根拠・作業範囲

対象は `createItemEditingDraftUseCase()`。下書きの所有者だけが編集セッションを生成でき、データコピーと元下書きの削除が原子的に実行されること、同一下書きへの並行操作が行ロックで直列化されることを確認する。

根拠は [createItemEditingDraft 詳細設計](../../../../../docs/design/backend/detail/itemEditing/createItemEditingDraft.md)、特に「8. テスト設計」と、2026-10-13時点の本番コード。本書はテスト実装前の設計であり、実行結果を示さない。詳細設計の契約と現行挙動を区別し、不一致をテストの期待値変更で隠さない。

記述・分割・fixture・DB検証は [usecases/AGENTS.md](../../AGENTS.md)、[updateConfirm/testArchitecture.md](../updateConfirm/testArchitecture.md)、同ディレクトリの `fixtures.ts`、`usecase.test.ts`、`services.test.ts`、`controller.test.ts`、`route.test.ts`、`databaseSetup.ts`、`databaseFixtures.ts`、`databaseConcurrency.test.ts` を参考にする。参照元の `testReport.md`、`afterFix.md` の過去報告は現行仕様と混同せず、2026-10-12の修正後契約を区別する。

今回編集するのは本書のみ。テストコード・fixture・報告書の作成、本番コード・詳細設計・設定・Todoの変更、DB接続、migration実行は対象外。フロント遷移、公開商品更新、S3アップロード、動画変換も対象usecaseの責務ではない。

### 調査した関連ファイル

以下のパスの基準は `server/`。

| 責務 | ファイル・関数 |
| --- | --- |
| 業務処理・transaction | `src/usecases/itemEditing/createItemEditingDraft.ts`：`createItemEditingDraftUseCase` |
| 所有者条件付き取得・行ロック | `src/services/itemDraft/query.ts`：`getMyItemDraft` |
| 編集セッション生成 | `src/services/itemEditing/command.ts`：`createItemEditingDraft` |
| 元下書き削除 | `src/services/itemDraft/command.ts`：`deleteItemDraft` |
| 入出力の型 | `src/types/serviceType/{itemDraft,itemEditing}.ts`、`src/types/itemAttributes.ts` |
| HTTP接続 | `src/controllers/itemEditing.ts`、`src/routes/itemEditing.ts`、`src/routes/index.ts` |
| 入力検証 | `src/validators/body/itemEditing.ts`：`createItemEditingDraftBodySchema`、`src/middleware/validate/validateBody.ts` |
| 認証・制限・エラー | `src/middleware/authMiddleware.ts`、`src/middleware/rateLimit/itemEditingRateLimit.ts`、`src/errors.ts`、`src/middleware/errorHandler.ts` |
| モデル・関連付け | `src/models/{item_draft,item_editing}.ts`、`src/models/index.ts` |
| DB初期化 | `src/db.ts`、`src/config/config.ts` |
| DB定義資料 | `migrations/20261005114144-create-item-editing.js`、`migrations/20261006044008-create-table-item-draft.js`、`migrations/20261006044423-update-column-item-editing.js` |
| 実行・検査設定 | `package.json`、`test/tsconfig.json`、`eslint.config.mjs` |

実DBの反映済みスキーマは今回未確認。実装時にモデル・migrationと照合し、差があればスキーマを自動補正せず報告する。

## 2. 処理フロー・責務の境界

1. 実アプリではRouterが `/api/item-editing` に登録され、`POST /draft` を受ける。詳細設計の `/item-editing/draft` にAPI共通prefixが付く。
2. `authenticateToken` → `createItemEditingDraftRateLimit` → `validateBody(createItemEditingDraftBodySchema)` → controllerの順。認証失敗は401、同一ユーザーの10分間の6回目は429、body不正は `INVALID_BODY / 400`。いずれもusecase・transactionを開始しない。
3. controllerは `req.user.id` と `req.validatedBody.itemDraftId` をusecaseへ渡す。未検証bodyやparamsの値は採用しない。
4. usecaseはmanaged transactionを開始し、そのcallback内で `getMyItemDraft({ itemDraftId, userId, transaction })` をawaitする。
5. serviceは `where: { id: itemDraftId, seller_id: userId }`、同一transaction、`lock: transaction.LOCK.UPDATE` で取得する。取得列にseller_idは含めず、所有者照合はwhere条件で行う。未存在・他人所有はともにnullとなり `ITEM_DRAFT_NOT_FOUND / 404`。statusの絞り込みはない。
6. 取得値を明示した作成dataへコピーし、`createItemEditingDraft` → `ItemEditing.create(data, { transaction })` をawaitする。
7. 取得した同じ下書きインスタンスを `deleteItemDraft` へ渡し、`itemDraft.destroy({ transaction })` をawaitする。
8. callbackは新規編集セッションIDを返す。managed transactionが成功してからusecaseが数値IDを返し、controllerが201・`{ itemEditingId }` を返す。

入力schemaはusecase外であり、usecase直接呼出しで400を期待しない。DB例外はusecaseで500のAppErrorへ変換されず、元の例外が伝播してcontrollerの `next` へ渡る。HTTP上の500整形は共通errorHandlerの責務として分ける。

商品画像は配列カラム、属性はJSONBでコピーする。独立した関連行のINSERTや関連行のFK付替えは実装されていない。既存の `item_id`、マスター・ブランドIDは保持し、参照先を新しい編集セッションIDへ書き換えない。新規IDは別テーブルで採番するため、元下書きIDと数値が必ず異なるとは期待しない。

## 3. テストレベル・構成・モック

下表は将来の実装構成。今回は各ファイルを作成しない。

| 記号 | ファイル | 実処理／モックと確認範囲 |
| --- | --- | --- |
| U | `usecase.test.ts` | 実usecase、3serviceと `src/db.ts` をモック。引数、全コピー項目、順序、await、例外伝播。実commit/rollback・行ロックは保証しない |
| S | `services.test.ts` | 実3service、モデルのfindOne/createと取得インスタンスのdestroyをモック。where・取得列・UPDATEロック・transactionの引渡し |
| V | `validation.test.ts` | 実schemaとvalidateBody。受理・拒否・未知キー除去・validatedBodyとnext。実DBなし |
| C | `controller.test.ts` | 実controller、対象usecaseをモック。認証ID・検証済みID、201応答、nextへの伝播 |
| R | `route.test.ts` | 最小Express＋JSON parser＋実Router、認証・制限・validatorを実処理、usecaseをモック。Supertestで入口と打切りを確認 |
| D | `database.test.ts` | 実usecase・service・モデル・PostgreSQL。コピー・削除・所有権・状態・再実行を別接続のSELECTで確認 |
| D | `databaseTransactions.test.ts` | 実処理を呼ぶspyで障害・保留を注入し、commit/rollback、可視性、再試行を確認 |
| D | `databaseConcurrency.test.ts` | 独立transaction・接続の実ロック競合。取得、待機、commit/rollbackの順を制御 |
| 共通 | `fixtures.ts` | 標準入力／取得値factory、AppError検証、deferred Promise |
| DB共通 | `databaseSetup.ts`、`databaseFixtures.ts` | 接続ガード、fixture・行追跡、observer、後片付け |

対象にshared helperや署名処理はないためhelper専用ファイルは不要。C/Rでは同じcontrollerモジュールがimportする他usecaseも境界でモックし、実DB・AWSのimportへ進まない。Sは `src/models/index.ts` をモックし、Uはserviceとdbのモックを初期化前に適用する。

Uのtransactionモックはcallbackへ同一tを渡しcallbackのPromiseをawaitする。成功・callback失敗・transaction自体の失敗を別に扱い、モックでrollback済みと報告しない。S用tには `LOCK.UPDATE` を用意する。

`vi.hoisted`、型付き `vi.fn`、`vi.mock`、`vi.spyOn` を使用。beforeEachで履歴・実装とfixtureを初期化する。spy、時間操作、環境変数は復元し、Routerのレートストアはモジュール再importで分離する。TypeScript・ESM・相対import `.js`、型のみ `import type` とし、新規ライブラリは追加しない。

## 4. 標準fixture・共通アサーション

- U/S/C/Rの標準値は所有者A=7、別ユーザーB=8、下書きID=11、返却編集ID=456、body=`{ itemDraftId: 11 }`。DBでは実採番IDを使い、存在しないIDもfixtureから不存在を確認して選ぶ。
- 全項目入り下書きに異なるname/title/detail/summary、画像3枚、商品・分類・ブランド・配送の有効参照ID、動画のoriginal/converted/thumbnailの別URLを設定する。price=800、before_price=1200、discount_rate=25、discount_amount=400、sale_flag=true、recommend=true、duration=30とし、再計算やデフォルト置換を検出する。
- attributesは在庫initial=10/current=4/low_stock_ratio=0.5、色2件・サイズ2件、異なるuiId/色画像、日本語素材名・小数ratio、分類・fitを含む。JSONの任意項目を失わず、在庫を初期化しないことを確認する。
- DBにはAの別下書き、Bの下書き、既存編集セッション、参照元Item・マスター・ブランドも用意してスナップショットを保存する。元下書きの日時は十分古い既知日時とする。
- body、配列、JSON、モデル相当値はケースごとにfactoryで新しく作る。ケース別に対象条件だけ変え、fixture内でコピー処理を再実装して期待値を算出しない。
- 公開応答・serviceへのdataは完全一致で検証する。transaction、削除対象インスタンス、作成serviceへ渡すimage_url/attributesは参照同一性も確認する。DBではJSON・配列の値と順序を新規SELECTで確認し、参照同一性は期待しない。
- AppErrorは型・code・statusCode、予期しない例外は元のErrorとの同一性を確認する。異常系では後続未実行と全対象行の不変／不存在を確認する。
- DBの件数はfixture・作成IDに限定する。テーブル全件数、連続ID、下書きIDと編集IDの不一致を成功条件にしない。

### N02：保存項目の対応表

以下の全項目をUの作成dataとDの保存値で確認する。dataのキー集合も固定し、項目漏れと余分な項目を検出する。

| 保存先 | コピー元・期待する扱い |
| --- | --- |
| seller_id | 認証済みuserId。取得値や未検証bodyのseller_idを採用しない |
| item_id | itemDraft.item_id（nullも保持） |
| name、detail | 同名下書き値。nullを空文字へ補完しない |
| image_url、first_image_url | 同名値。順序と独立した値をそのまま保持し、先頭から再計算しない |
| price、before_price、discount_rate、discount_amount、sale_flag | 同名値。価格・割引を再計算しない |
| item_condition_id、category_id、brand_id、brand_aliases_id | 同名参照ID。既存の参照先を維持する |
| gender_type、age_type、recommend | 同名値。許容値・false・nullは列制約に応じて保持 |
| attributes | JSON全体。在庫、色、サイズ、画像、素材、分類、fit、キー有無と順序を保持 |
| thumbnail_url、title、summary、duration | 同名値。空値・null・0を補完しない |
| original_url、converted_url、video_status | 同名値。動画URLの優先選択やstatus変更を行わない |
| shipping_day_id、shipping_service_id、shipping_place_id、shipping_service_free_text | 同名値。nullable IDと空文字も保持 |
| id、createdAt、updatedAt | 作成dataに含めない。編集テーブルの新規採番・新規日時。元の管理値はコピーしない |

## 5. 正常系・任意項目・コピー境界

| ID | レベル | 条件／入力／手順 | 期待結果 |
| --- | --- | --- | --- |
| N01 | U/D | 所有者が全項目入り下書きから作成 | 取得→作成→削除、Uは各1回・同じt。Dは編集1行増加・元下書き不存在、返却IDの行がコピー結果と一致 |
| N02 | U/D | 4節の全保存項目を区別できる値で設定 | 全項目一致、余分な管理項目なし。seller_id=A、既存参照ID保持、価格・在庫・動画を加工しない |
| N03 | U/D | nullable列をnull、attributes={}、gender/age・sale_flagは有効値 | nullをそのまま保持し作成可能。空オブジェクトをデフォルトの別構造へ変えない |
| N04 | U/D | TEXT/文字列列は空文字、image_url=[]、attributesに空配列 | 空値と空配列を保持。メディア必須チェックや空値拒否を新たに期待しない |
| N05 | U/D | price等nullable数値・duration=0、recommend=false、sale_flag=false | 0/falseを欠落扱いせず保持。recommend=nullは別条件にする |
| N06 | U/D | attributesの任意キーなし／全キーあり／配列内optionalなし | キーの有無を保持。素材・色・サイズの順とuiId対応が一致。DB fixtureは保存済みJSONを比較元にする |
| N07 | U/D | gender=men/women/unisex、age=adult/kids/both、video_status=null/既存文字列 | 各定義値と状態を保持し作成。statusによる取得制限・公開遷移なし。値ごとに独立展開 |
| N08 | D | item_idあり／null、brand_id・brand_aliases_idあり／片方／両方null | 有効なFKまたは許可されたnullを保持。公開Item・マスター・ブランドを新規作成／更新しない |
| N09 | D | 古い元日時、既存編集セッションを併置して成功 | 新規編集行を返し、元日時をコピーしない。日時は呼出前後の範囲で確認し、連番や異テーブルIDの大小を仮定しない |
| B01 | U/D | name/title/video_status/shipping_service_free_textを各0/254/255文字 | 保存可能な最大長まで完全一致。各列個別展開、日本語も確認 |
| B02 | U/D | image_url=null/0/1/10件 | 配列順と全URLを保持。first_image_urlは元値を保持する独立カラムとして検証 |
| B03 | U/D | detail/summary/各TEXT URLに空文字・日本語を含む長文 | 元値を保持。TEXTに未定義の最大長を追加しない |

境界外256文字はE07、画像11件はE08に分離する。DBのコピー境界は下書きとして永続化できる値を使い、型上NOT NULLのgender/age・attributes・sale_flagを通常fixtureでnullにしない。

## 6. 異常系・停止位置

| ID | レベル | 条件／入力／手順 | 期待結果・後続未実行 |
| --- | --- | --- | --- |
| E01 | U/D | 下書き不存在（Uは取得null） | ITEM_DRAFT_NOT_FOUND/404。作成・削除なし。Dは既存編集・他下書き不変 |
| E02 | S/D | BがAの下書きIDを指定 | 所有者whereで除外され同じ404。Aの下書き・編集は不変。存在情報を別エラーで返さない |
| E03 | U | transaction開始時にreject | 元Error伝播、3service未実行 |
| E04 | U/S/D | 取得をreject（Dは取得境界に障害注入） | 元Error伝播、作成・削除なし。Dはtransaction終了後に下書き保持・編集増加なし |
| E05 | U/S/D | 編集作成をreject（Dは実INSERT後のthrowもT03） | 元Error伝播、削除なし。Dは途中編集が残らず下書き全列保持 |
| E06 | U/S/D | 下書き削除をreject／実destroy後にthrow | 元Error伝播、成功ID・201なし。Dは編集INSERTと削除をrollbackし下書き復元（T04） |
| E07 | D | 正常下書き取得後、作成直前spyで対象文字列列を256文字へ変更 | 元の制約例外伝播、削除なし、編集残存なし・元下書き保持。通常の永続化済み下書きからは到達しない障害注入と明記 |
| E08 | S/D | 下書き取得後、作成dataのimage_urlを11件へ変更 | 編集モデルvalidationで失敗し削除なし・rollback。DB CHECKの存在を保証しない。故意の境界外入力として分離 |
| E09 | U | callback成功後のtransaction完了をrejectするモック | 元Error伝播、成功IDなし。実commit障害・接続断時のDB成否は未検証と明記 |

E07/E08は実usecaseを呼ぶserviceラッパーで作成引数のみ変更し、下書きfixtureの値を変更しない。DBの失敗はモデルvalidation・SQL制約・注入したErrorを区別して報告する。

## 7. 入力検証・ID境界

| ID | レベル | 条件／入力／手順 | 期待結果 |
| --- | --- | --- | --- |
| V01 | V/R | itemDraftId=1/2/通常の正整数 | 受理、型変換なしで同じ数値IDをcontroller/usecaseへ渡す |
| V02 | V/R | 0/-1/1.5を各指定 | 拒否、INVALID_BODY/400。usecase・transaction未実行 |
| V03 | V/R | "11"/""/true/null/配列/オブジェクト/欠落 | 数値へcoerceせず拒否、INVALID_BODY/400。各値を独立展開 |
| V04 | V | body自体null/配列/undefined、itemDraftId=NaN/±Infinity | schema拒否。NaN/Infinity/undefinedはschema直呼出しで、通常JSON経路と区別 |
| V05 | V/C/R | 有効IDにuserId/seller_id/未知キーを追加 | schemaは未知キーを除去。validatedBodyはitemDraftIdのみ、所有者は認証ID |
| V06 | V | validateBody成功／失敗を直接呼ぶ | 成功はparse後値をvalidatedBodyへ設定しnext1回。失敗はAppErrorをthrow、validatedBody設定・正常nextなし |
| O01 | V | DB INTEGER最大2147483647と2147483648等の正整数 | 業務上限未定、schemaにmaxなし。schemaの実受理結果を記録し、DBへの収容可能性や404/400を保証しない |

上限の直前・一致・直後の業務テストは、詳細設計9節で仕様が確定してから追加する。O01は現行schemaの観測であり、DB型上限をAPIの仕様上限に採用しない。

## 8. service契約

| ID | レベル | 条件／入力／手順 | 期待結果 |
| --- | --- | --- | --- |
| S01 | S | getMyItemDraftにID・userId・tを渡す。取得あり／null | findOne1回、where完全一致、同じt、lock=t.LOCK.UPDATE。取得結果を同じ参照で返す |
| S02 | S | 取得attributesを確認 | id＋N02のコピー元29列を明示して取得。seller_id/createdAt/updatedAtは選択なし。不要なinclude/status条件なし |
| S03 | S | createItemEditingDraftにdata・tを渡す | ItemEditing.create(data,{transaction:t})1回、data/tの参照維持、返却インスタンス同一。Item.createなし |
| S04 | S | deleteItemDraftに取得インスタンス・tを渡す | 同インスタンス.destroy({transaction:t})1回、完了をawaitし戻り値undefined。別IDの一括削除なし |
| S05 | S | findOne/create/destroyを各reject・保留 | 元Errorのまま伝播。保留中はservice未完了、解放後のみ完了。各依存を独立展開 |

Sの引数検証だけで実行ロックやDB保存結果を確認済みとしない。属性29列はN02のseller_id・管理項目を除いたコピー元列と対応させる。

## 9. 状態遷移・重複実行

| ID | レベル | 操作前→入力／手順 | 期待する保存後 |
| --- | --- | --- | --- |
| ST01 | D | 所有下書き1行→成功 | 下書き0・新規編集1。コピー値・seller・参照が一致 |
| ST02 | D | 下書き1行→取得／作成／削除で各失敗 | 下書き全列保持・編集増加0。処理済みINSERT/DELETEもrollbackで戻る |
| ST03 | R/D | 未認証／不正body／超過／他人所有で操作 | 前3条件はRでusecase未実行、Dで同経路を実usecaseへ接続しDB全列不変。他人所有は実Dで404・不変 |
| ST04 | D | 成功後、同じuserId/itemDraftIdを逐次再実行 | 2回目404、編集追加なし。既存成功行の全列不変 |
| ST05 | D | rollback確認後、同じ入力で障害解除して再試行 | 正常に編集1行生成・下書き削除。失敗回の残存なし、採番の巻戻しは期待しない |
| ST06 | D | 対象とA別下書き・B下書き・既存編集・Item・参照先を併置 | 成功／失敗の双方で対象外全列不変。ブランド別名新規生成などはない |

ST03用のHTTP→DB結合はdatabase.test.ts内に実認証・実validator・実制限・実controller・実usecaseを接続する最小アプリを用意する。DBガード後に起動し、JWT専用鍵・時間・ストアを分離する。Rのusecaseモックによる未実行確認と、実DBでの不変確認を分けて記録する。

## 10. transaction・await・DB可視性

| ID | レベル | 条件／入力／手順 | 期待結果 |
| --- | --- | --- | --- |
| T01 | U/S | 正常作成 | transaction1回。取得・作成・削除からfindOne/create/destroyまで同一t。取得はcallback内 |
| T02 | U | 取得、作成、削除、transaction完了を個別gateで保留 | 取得前に作成なし、作成前に削除なし、削除・transaction完了前に返却なし。解放後N01の順序 |
| T03 | D | 実編集INSERT完了後にthrow | observerで編集行なし・元下書き全列保持。INSERT済みをtransaction内SELECTで確認してから失敗させる |
| T04 | D | 実編集INSERT後に削除直前throw／実destroy後throw | 各条件独立。別接続で編集なし・下書き保持。後者はtransaction内で下書き不存在を確認してからthrow |
| T05 | D | 実INSERTと実destroy完了後、callback終了前で保留→解放 | transaction内は編集あり・下書きなし、observerは編集なし・下書きあり。commit後に編集あり・下書きなし |
| T06 | D | E04/E05/E06後に別接続で対象行へFOR UPDATE NOWAIT | rollback後にロック取得可能。成功commit後は対象下書き不存在。他ケースへロックを持ち越さない |
| T07 | D | 作成失敗または削除失敗後、通常再試行 | ST05の状態を確認。自動再試行は期待しない |

managed transactionのcallback内で呼んだ事実だけで参加を保証しない。T01の引数契約とT03〜T05の実結果を両方確認する。全ケースを外側のtransactionで包んで常にrollbackする方式は使わず、実commitとobserverの可視性を維持する。commit障害の実再現は対象外で、E09は例外伝播のモック確認に限定する。

## 11. 並行処理・行ロック

各呼出しは独立transaction・物理接続を使用する。任意のsleepや単なるPromise.allではなく、開始通知・解放用deferredを分け、実SELECT/INSERT/DELETE後のserviceラッパーで順序を固定する。待機する処理がロック取得後に到達するgateを、先行解放条件にしない。

待機の確認は接続PID、`pg_blocking_pids` 等で対象transactionが先行transactionにブロックされていることを確認し、未完了・未INSERTも併せて確認する。検査には上限時間を設け、実行順は時刻経過で決めない。SQLで所有者条件とFOR UPDATEも確認する。観測用接続の枯渇を避けるプール構成と実分離レベルを事前検査する。特に後続SELECTの再評価はREAD COMMITTEDを前提とし、異なる環境なら期待結果への影響を報告する。

| ID | レベル | 再現する順序／条件 | 期待結果 |
| --- | --- | --- | --- |
| P01 | D | Aが取得・行ロック→Bが同じIDを要求し待機→A作成/削除commit→B解放。A/Bの開始順を逆にも展開 | 成功1件、後続ITEM_DRAFT_NOT_FOUND/404、新規編集1行、下書きなし。Bは作成・削除未実行 |
| P02 | D | A取得→B待機→Aが実INSERT後に削除失敗でrollback→B取得/作成commit | A編集なし、B編集1行、下書きなし。Bはrollback後に残る全値をコピーできる |
| P03 | D | 別接続Uが下書き更新・ロック保持→Aが取得待機→U commit→A作成 | Aは更新後のname/price/画像/attributesを一貫してコピー。古い値の混在なし |
| P04 | D | 別接続Uが下書きDELETE・ロック保持→A取得待機→U commit | Aは404、編集なし。削除前snapshotから作成しない |
| P05 | D | A取得・ロック→別接続UのUPDATEが待機→A作成/削除commit | 編集はAがロック取得した値。Uは対象行0件更新となり下書きは復活しない。SQL影響行数を確認 |
| P06 | D | A取得・ロック→別接続UのDELETEが待機→Aをcommit／rollback | commit時はU削除0件、編集1行。rollback時はUが残った下書きを削除、A編集なし。条件を独立展開 |
| P07 | D | UのUPDATE／DELETEが先行しA待機→U rollback→A作成 | Aはrollback後の元値から編集1行作成。未commit変更をコピーしない |
| P08 | D | 所有者変更のUPDATEが先行→A待機→所有者Bへの変更commit | 所有者where再評価によりAは404、編集なし。B所有の変更後下書きを保持 |
| P09 | D | AとBが異なる所有下書きを取得→片方保留中に他方commit | 両方成功、編集2行、元2行削除。値・所有者・参照先が混ざらず別行を不要にブロックしない |

P03/P04/P07/P08は別処理のSQLによる競合を再現するもので、全更新・削除APIの結合検証済みとはしない。全Promiseは開始時にsettled/reject検証を登録し、finallyでgate解放・回収・transaction終了・hook解除を行う。並行処理後にobserverで対象行・非対象行を再取得する。

## 12. controller・Router・レート境界

| ID | レベル | 条件／入力／手順 | 期待結果・後続未実行 |
| --- | --- | --- | --- |
| C01 | C | req.user.id=A、validatedBodyのID=11、body/paramsに別ID・別所有者 | usecaseへ `{ userId:A, itemDraftId:11 }` を1回だけ渡す |
| C02 | C/R | usecaseが456を返す | 201、JSON完全一致 `{ itemEditingId:456 }`。余分なコピー値・下書きIDなし、nextなし |
| C03 | C | AppError／通常Errorでusecase reject | 同じErrorをnext1回、status/jsonなし |
| C04 | C | usecaseをdeferredで保留 | 保留中は201送信なし、解放後C02 |
| R01 | R | トークンなし／Bearer不正／署名不正／期限切れ | 実認証の401応答、validator・usecase未実行。未認証はレート枠を消費しない |
| R02 | R | 正常認証でPOST /api/item-editing/draft、正常body | 実middleware→controller接続、C01/C02。params ID検証は不要 |
| R03 | R | 認証済み＋V02/V03の不正body | INVALID_BODY/400、usecase未実行。正常認証＋不正bodyは枠を消費 |
| R04 | R | 同じuserIdを異なるトークンで5回→6回、別userIdで送信 | 最初5回は201、6回目429、別ユーザーは201。同ユーザーは同じ枠。超過時usecase未実行 |
| R05 | R | 不正bodyを5回→正常bodyの6回目 | 5回400、6回目429。成功要求だけを数えるとは期待しない |
| R06 | R | 固定時刻で5回→10分の直前→10分経過時→直後 | 直前429、期間切替後は新しい枠で201。境界ごとにストアを分離し、JWTは窓全体で有効にする |
| R07 | R | 無認証＋不正body／制限超過＋不正body | それぞれ401／429が先。validator・usecase未実行 |
| R08 | R | usecaseがITEM_DRAFT_NOT_FOUND／通常Errorをreject | controllerから同じ例外がエラーmiddlewareへ渡り成功応答なし。観測用middlewareの404／500整形と共通handlerを区別 |

Rでは `express.json()` と実Routerを `/api/item-editing` に接続する。JWT専用鍵を生成し `vi.stubEnv` とdotenvモックで実鍵の読込みを防ぐ。時刻操作はDate・ストアintervalなどに限定しHTTP I/Oを維持する。5回/6回・切替境界で呼出し数も確認し、429はレートmiddleware既定応答に合わせる。UNAUTHORIZEDのAppError形式を認証に強制しない。

共通errorHandlerは現行ソースが3引数のため、Expressが4引数エラーmiddlewareとして扱うかに注意が必要。Rのテスト専用4引数handlerで通常Errorを500に変換しても、実アプリの500契約の確認済みとはしない。この入口外の確認事項は本書へ記録し、本番コード・Todoは変更しない。

## 13. 実DB環境・制約・後片付け

実装時は既存の専用PostgreSQL `test_db` と反映済みスキーマを使用する。DB作成、migration、sync、truncate、全件削除は行わない。

1. `server/` を実行ディレクトリとし、DBモジュールimport前に `.env.test` のみを読み、NODE_ENV=test・接続URLのDB名=test_dbを検査する。継承されたenvや引数なしdotenvによる `.env` 読込みをそのまま信用しない。
2. `src/db.ts`、モデル初期化用 `db.sequelize`、observer、競合用の全接続を接続前に検査し、接続後の `SELECT current_database()` でtest_dbを確認する。全検査終了までfixture書込みなし。別env読込み・URL差替えも停止させる。
3. item_draft/item_editingとuser/item/categories/item_condition_option/brands/brand_aliases/shipping_day_option/shipping_service_option/todouhuken_optionの必要列・FKを検査する。編集item_idのnullable変更、ENUM、attributes/sale_flagのNOT NULL、STRING(255)、ARRAY・JSONBを確認する。画像10件上限はモデルvalidationでありDB CHECKと推定しない。
4. fixture親行を依存順に作成し、固有名・作成IDを記録する。usecaseが作る編集行も追跡し、実生成IDと返却IDの対応を検証する。既存共有データや固定DB IDに依存しない。
5. 結果はobserverの新規SELECTで取得する。rollback前のインスタンスを判定に使わず、下書き・編集全列、JSONキー有無・配列順、非対象行を確認する。
6. finallyで処理回収後に、作成したIDだけを編集・下書き→Item→ブランド別名・マスター→ユーザーのFK依存順に削除し、残存なしを確認する。全hook/spy・接続を終了しenvを復元する。失敗時も既存行は削除しない。

ガードの不一致・読込元不明はDB処理を中断しユーザー判断へ委ねる（[usecases/AGENTS.md](../../AGENTS.md)「条件に違反したときの中断」）。秘密情報・接続URLはログに出さず、読込元パス・DB名・検査結果のみを記録する。未確認の接続へ後片付けの削除を行わない。

## 14. 詳細設計「8. テスト設計」との対応・差分確認

本書作成後、8節の全列挙項目を以下へ照合した。対応ありは設計への反映を意味し、実装・実行済みではない。

| 詳細設計の区分 | 観点（各箇条書き） | 対応ケース | 照合結果 |
| --- | --- | --- | --- |
| 正常系 | 所有者が生成できる | N01、R02、ST01 | 対応あり |
| 正常系 | 入力データ引継ぎ | N02〜N08、B01〜B03 | 全コピー列を明示 |
| 正常系 | 元下書き削除 | N01、ST01、T05 | commit後SELECTで確認 |
| 正常系 | 新itemEditingId返却 | N01、N09、C02、R02 | 新規行IDとの対応、異テーブルIDの不一致は要求しない |
| 異常系 | 不存在ID | E01 | 404＋後続未実行・不変 |
| 異常系 | 他人ID | E02 | where認可、同じ404 |
| 異常系 | ID型不正 | V03/V04、R03 | schema・HTTPを分離 |
| 異常系 | 編集作成DBエラー | E05、T03 | 実INSERT後rollbackを含む |
| 異常系 | 下書き削除失敗 | E06、T04 | DELETE前後の失敗を分離 |
| 並行処理 | 同一IDで重複生成なし | P01 | 実ロック待機と最終1件 |
| 並行処理 | 先行commit後に後続404 | P01 | 待機→commit→再評価 |
| 並行処理 | 先行rollback後に後続成功 | P02 | 待機→rollback→取得成功 |
| 並行処理 | 更新・削除競合で最新コピー／404 | P03〜P07 | 先行・後続とcommit/rollback双方 |
| 境界値 | ID下限・整数・上限確定後 | V01〜V04、O01 | 下限・整数は対応。業務上限は仕様未定で保留 |
| 境界値 | レート回数・期間切替 | R04、R06 | 5/6回・直前/一致/直後 |
| 境界値 | コピー未入力・空・最大長 | N03〜N06、B01〜B03、E07/E08 | nullable/空値/255文字/画像10件を具体化、TEXT上限は未定義 |
| 条件分岐 | 認証・入力・存在・所有者 | R01/R03/R07、V、E01/E02 | 各失敗の打切りと優先順位 |
| 条件分岐 | ユーザー別レート・不正入力加算 | R04/R05 | 認証IDの同一枠・別枠 |
| 条件分岐 | 任意項目有無と値の引継ぎ | N03〜N08 | 加工・補完しないコピー |
| 条件分岐 | 各DB失敗rollback | E04〜E06、T03/T04、ST02 | 取得・作成・削除を個別化 |
| 状態遷移 | 成功時下書き削除・編集生成 | ST01、T05 | 両テーブルのcommit可視性 |
| 状態遷移 | 失敗時下書き保持・途中データなし | ST02、T03/T04 | 別接続で全列確認 |
| 状態遷移 | 認証・入力・認可・レートエラー時不変 | ST03、E02、R01/R03/R04 | 入口の未実行とHTTP→実DB不変を分ける |
| 状態遷移 | 成功後再送で追加なし | ST04 | 2回目404と既存行不変 |
| 状態遷移 | rollback後再試行 | ST05、T07 | 障害解除後成功、失敗回残存なし |
| 状態遷移 | 対象外下書き・既存編集不変 | ST06 | 成功・失敗双方の全列比較 |

8節の確定観点に対する設計上の漏れ・期待仕様の変更はなし。追加の具体化はservice引数・選択列（S）、await・commit可視性（T）、controller/Router接続（C/R）、所有者変更と別行競合（P08/P09）、非通常入力による保存境界障害（E07/E08）。対象業務を広げる保証は追加していない。

8節以外を含む詳細設計との留意差分は、API共通prefix、所有者照合をwhereで実施する点、画像・属性がカラム内データで関連行コピーがない点、DB例外が元Errorで伝播する点。成功応答は現行controllerで201・`{ itemEditingId }` に確定している。業務ID上限・独立した関連レコードの移行・実アプリの共通エラー応答は、未確定／責務外／未検証の範囲を混同しない。

## 15. 優先度・実行方法・完了条件

| 優先度 | ケース群 | 理由 |
| --- | --- | --- |
| P0 | N01/N02、E01〜E06、V01〜V04/V06、T01〜T05、ST01〜ST03、C01〜C03、P01/P02 | 基本動作・所有権・入力境界・原子性・重複生成防止。並行処理でも必須契約P01/P02は先に確認 |
| P1 | 残りN、B、S、C04、R全件、残りT/ST、E07/E08 | コピー境界・各層接続・状態・再試行 |
| P2 | P03〜P09、O01、E09、V05 | 更新削除競合の詳細・観測・追加境界。必須観点のためP2も未実施のまま全体完了にしない |

テスト名はケースID・日本語の条件・期待結果を含め、複数条件は `it.each` 等で独立展開する。ケースID数とランナーの展開後件数を分けて報告し、モック成功だけでDB観点を完了にしない。

将来のテスト実装後、DBガード確認を経て `server/` で実行する。

```bash
npm run test:run -- test/usecases/itemEditing/createItemEditingDraft/ --maxWorkers=1
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

`--maxWorkers=1` はDB fixture/hook・レート状態のファイル間干渉を抑えるため。ケース内の独立transactionによる並行処理はPで実行する。lintの実対象を確認し、テストTSが対象外なら既存ESLint/typescript-eslintによる追加検査方法を報告し、設定は独断で変更しない。

実装完了条件は、全確定観点のケースとテストファイルの対応、コピー全項目、後続未実行、await、別接続のcommit/rollback、ロック待機と再評価、非対象行不変、後片付けの確認が追えること。未実装・未実行・環境制約・観測・仕様保留を成功と混ぜず、DB非接続検査とDB検査の結果を分ける。

**今回の完了範囲は本設計書の作成、詳細設計8節との照合、リンク・ケース対応・編集範囲の確認のみ。テスト・lint・型検査の実行およびDB接続は行っていない。**
