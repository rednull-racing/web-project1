# itemDraftPage テストレポート

## 最新結果（2026-10-29 再開）

中断・未実行だったブラウザーテストを含め、B/Eの全195件を再実行した。**成功117、失敗69、タイムアウト9、中断・skip・未着手0**。両ランナーはexit 1で正常に結果を出力し、トップレベルerrors・flakyは0。設計全体の合格ではない。詳細は[再開結果](#6-2026-10-29-中断未実行箇所の再開結果)を参照。

今回U/C/Pは再実行していない（前回：成功156・失敗32）。未実装assertや、失敗によって未到達となった後段の検証は残る。本番コード・DBスキーマは変更していない。以下の1〜5章は2026-10-28の履歴であり、旧「未実行」「提案のみ」の現在の状態は6章で更新する。

## 1. 2026-10-28実行履歴・当時の完了範囲

実行日：2026-10-28。対象：[テスト設計書](../../architecture/item/itemDraftPage.md)。以下のパスは特記がなければリポジトリルート基準。
単体・コンポーネント結合・DOMページ結合・ブラウザーページ結合・実API/DBのE2Eを実装・実行した。本番コードは変更していない。ユーザーの「残りは未実行としてレポート作成」指示に従い、3ブラウザー実行の途中でSIGINTを送り、追加実装・追加実行を停止した。設計全体の合格・実装完了とはしていない。
最新の重複しない集計：**展開383件、成功216件、失敗52件、タイムアウト1件、中断2件、未着手112件**。中断2件も完了判定上は未実行。失敗52件にはB-Q04のテストコード不備1件を含む。タイムアウト1件はB-Q03の操作手順に起因し本番判定不可。欠陥検出をexpected failure・skipへ変更していない。
カバレッジは未取得。Node.js 22.22.2を使用し、指定Node.js 26では未確認。秘密値・トークン・接続URL全体は転記しない。

| 階層 | 展開件数 | 最新結果                                       |
| ---- | -------: | ---------------------------------------------- |
| U    |      133 | 成功119、失敗14                                |
| C/P  |       55 | 成功37、失敗18                                 |
| B    |      117 | 成功26、失敗15、タイムアウト1、中断1、未実行74 |
| E    |       78 | 成功34、失敗5、中断1、未実行38                 |

ブラウザー別：

| project        | 結果                          |
| -------------- | ----------------------------- |
| e2e-chromium   | 成功21、失敗5                 |
| e2e-firefox    | 成功13、中断1、未実行12       |
| e2e-webkit     | 未実行26                      |
| pages-chromium | 成功24、失敗14、タイムアウト1 |
| pages-firefox  | 成功2、失敗1、中断1、未実行35 |
| pages-webkit   | 未実行39                      |

Playwright JSONのstats.skippedはB=75／E=39だが、内訳は未着手74／38と中断各1。コードにskipを追加した件数ではない。U/C/Pはskip・todo・未処理例外0、B/Eのトップレベルerrorsも0。中断ケース本体の未完了と、成功した先行ケースを混同しない。

## 2. テストファイルごとの結果

fixtureは `client/test/fixtures/item/itemDraftPage/` と `test/fixtures/item/itemDraftPage/`、設定変更は `client/vitest.config.mts`。下表は実ファイル単位でありdescribe数をファイル数にしていない。

| 実ファイル                                                                                   | 結果（ブラウザーは3projectを含む） |
| -------------------------------------------------------------------------------------------- | ---------------------------------- |
| `client/src/app/item/draft/api/test/client.test.ts`                                          | 成功6                              |
| `client/src/app/item/draft/api/test/server.test.ts`                                          | 成功2                              |
| `client/src/app/item/draft/test/delete.test.tsx`                                             | 成功5                              |
| `client/src/app/item/draft/test/editButton.test.tsx`                                         | 成功3                              |
| `client/src/app/item/draft/test/itemDraftPage.test.tsx`                                      | 成功4                              |
| `client/src/app/item/draft/test/itemSection.test.tsx`                                        | 成功17                             |
| `client/src/app/item/draft/test/videoSection.test.tsx`                                       | 成功11                             |
| `client/src/app/item/itemSection/test/categoryText.test.tsx`                                 | 成功3                              |
| `client/src/app/item/itemSection/test/deliverySection.test.tsx`                              | 成功9、失敗6                       |
| `client/src/app/item/itemSection/test/detail.test.tsx`                                       | 成功4                              |
| `client/src/app/item/itemSection/test/itemHeader.test.tsx`                                   | 成功8                              |
| `client/src/app/item/itemSection/test/itemName.test.tsx`                                     | 成功3                              |
| `client/src/app/item/itemSection/test/slideshow.test.tsx`                                    | 成功3、失敗1                       |
| `client/src/app/item/itemSection/test/variantsList.test.tsx`                                 | 成功13、失敗4                      |
| `client/src/app/item/videoSection/test/itemPeek.test.tsx`                                    | 成功7、失敗2                       |
| `client/src/app/item/videoSection/test/summary.test.tsx`                                     | 成功4                              |
| `client/src/app/item/videoSection/test/videoElem.test.tsx`                                   | 成功7、失敗1                       |
| `client/src/components/container/test/container.test.tsx`                                    | 成功2                              |
| `client/src/lib/test/formatRelativeTime.test.ts`                                             | 成功8                              |
| `client/test/integration/components/item/itemDraftPage/deleteItemDraft/integration.test.tsx` | 成功9、失敗2                       |
| `client/test/integration/components/item/itemDraftPage/editButton/integration.test.tsx`      | 成功9                              |
| `client/test/integration/components/item/itemDraftPage/itemSection/integration.test.tsx`     | 成功5、失敗9                       |
| `client/test/integration/pages/item/itemDraftPage/components.spec.ts`                        | 成功7、失敗10、中断1、未実行24     |
| `client/test/integration/pages/item/itemDraftPage/itemDraftPage.test.tsx`                    | 成功14、失敗7                      |
| `client/test/integration/pages/item/itemDraftPage/operations.spec.ts`                        | 失敗5、タイムアウト1、未実行12     |
| `client/test/integration/pages/item/itemDraftPage/page.spec.ts`                              | 成功19、未実行38                   |
| `test/E2E/item/itemDraftPage/createItemEditingDraft/flow.spec.ts`                            | 成功20、未実行10                   |
| `test/E2E/item/itemDraftPage/deleteItemDraft/flow.spec.ts`                                   | 成功14、失敗5、中断1、未実行28     |

## 3. 設計ケースごとの対応・判定

件数は各IDに対応する実テストの内訳。条件の一部成功を全レベル成功に読み替えない。同一IDのU/C/P/Bも分けて表示し、未着手・中断は未実行、未作成assertは未実装として下欄に記す。

| 設計ID | 実装ファイル／階層・結果                                                                                                                                                                | 判定・残る条件                                                                                                              |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| U-N01  | U（itemDraftPage.test.tsx）：成功1                                                                                                                                                      | 実装・実行した範囲は成功。                                                                                                  |
| U-V01  | U（itemDraftPage.test.tsx）：成功3                                                                                                                                                      | 実装・実行した範囲は成功。                                                                                                  |
| U-V02  | U（videoSection.test.tsx）：成功11                                                                                                                                                      | 実装・実行した範囲は成功。                                                                                                  |
| U-V03  | U（itemSection.test.tsx）：成功17                                                                                                                                                       | 実装・実行した範囲は成功。                                                                                                  |
| U-N02  | U（editButton.test.tsx）：成功1                                                                                                                                                         | 実装・実行した範囲は成功。                                                                                                  |
| U-F01  | U（editButton.test.tsx）：成功2                                                                                                                                                         | 実装・実行した範囲は成功。                                                                                                  |
| U-N03  | U（delete.test.tsx）：成功2                                                                                                                                                             | 実装・実行した範囲は成功。                                                                                                  |
| U-N04  | U（delete.test.tsx）：成功1                                                                                                                                                             | 実装・実行した範囲は成功。                                                                                                  |
| U-F02  | U（delete.test.tsx）：成功2                                                                                                                                                             | 実装・実行した範囲は成功。                                                                                                  |
| U-N05  | U（client.test.ts）：成功4                                                                                                                                                              | 実装・実行した範囲は成功。                                                                                                  |
| U-V04  | U（client.test.ts）：成功2                                                                                                                                                              | 実装・実行した範囲は成功。                                                                                                  |
| U-N06  | U（server.test.ts）：成功2                                                                                                                                                              | 実装・実行した範囲は成功。                                                                                                  |
| U-N07  | U（videoElem.test.tsx）：成功7                                                                                                                                                          | 実装・実行した範囲は成功。                                                                                                  |
| U-N08  | U（itemPeek.test.tsx）：成功6                                                                                                                                                           | 実装・実行した範囲は成功。                                                                                                  |
| U-N09  | U（detail.test.tsx / summary.test.tsx）：成功6                                                                                                                                          | 実装・実行した範囲は成功。                                                                                                  |
| U-N10  | U（slideshow.test.tsx）：成功3                                                                                                                                                          | 実装・実行した範囲は成功。                                                                                                  |
| U-N11  | U（itemHeader.test.tsx / itemName.test.tsx）：成功9                                                                                                                                     | 実装・実行した範囲は成功。                                                                                                  |
| U-N12  | U（variantsList.test.tsx）：成功2                                                                                                                                                       | 実装・実行した範囲は成功。                                                                                                  |
| U-V05  | U（variantsList.test.tsx）：成功5                                                                                                                                                       | 実装・実行した範囲は成功。                                                                                                  |
| U-N13  | U（categoryText.test.tsx / container.test.tsx / deliverySection.test.tsx）：成功12                                                                                                      | 実装・実行した範囲は成功。                                                                                                  |
| U-V06  | U（formatRelativeTime.test.ts）：成功8                                                                                                                                                  | 実装・実行した範囲は成功。                                                                                                  |
| U-S01  | U（categoryText.test.tsx / deliverySection.test.tsx / detail.test.tsx / itemHeader.test.tsx / itemName.test.tsx / itemPeek.test.tsx / summary.test.tsx / variantsList.test.tsx）：成功8 | 実装・実行した範囲は成功。                                                                                                  |
| C-N01  | C/P（editButton/integration.test.tsx）：成功1                                                                                                                                           | 実装・実行した範囲は成功。                                                                                                  |
| C-F01  | C/P（editButton/integration.test.tsx）：成功7                                                                                                                                           | 実装・実行した範囲は成功。                                                                                                  |
| C-N02  | C/P（deleteItemDraft/integration.test.tsx）：成功1                                                                                                                                      | 実装・実行した範囲は成功。                                                                                                  |
| C-F02  | C/P（deleteItemDraft/integration.test.tsx）：成功7                                                                                                                                      | 実装・実行した範囲は成功。                                                                                                  |
| C-F03  | C/P（deleteItemDraft/integration.test.tsx / editButton/integration.test.tsx）：成功2                                                                                                    | 実装・実行した範囲は成功。                                                                                                  |
| C-N03  | C/P（itemSection/integration.test.tsx）：成功2                                                                                                                                          | 実装・実行した範囲は成功。                                                                                                  |
| C-N04  | C/P（itemSection/integration.test.tsx）：成功1                                                                                                                                          | 実装・実行した範囲は成功。                                                                                                  |
| C-S01  | C/P（itemSection/integration.test.tsx）：成功1                                                                                                                                          | 実装・実行した範囲は成功。                                                                                                  |
| P-N01  | C/P（itemDraftPage.test.tsx）：成功6                                                                                                                                                    | 実装・実行した範囲は成功。                                                                                                  |
| P-N02  | C/P（itemDraftPage.test.tsx）：成功6                                                                                                                                                    | 実装・実行した範囲は成功。                                                                                                  |
| P-F01  | C/P（itemDraftPage.test.tsx）：成功2                                                                                                                                                    | 実装・実行した範囲は成功。                                                                                                  |
| B-N01  | B（page.spec.ts）：成功2、未実行4                                                                                                                                                       | Chromiumの標準／未入力SSR・Hydrationを確認。全ブラウザー保証ではない。                                                      |
| B-N02  | B（components.spec.ts）：成功3、未実行3                                                                                                                                                 | Chromiumで生成した短いcanvas動画を実再生。概要／説明の開閉・スクロールはChromium/Firefoxで確認。                            |
| B-N03  | B（components.spec.ts）：成功2、未実行1                                                                                                                                                 | 一部実施、残りはユーザー指示で未実行。                                                                                      |
| B-S01  | B（page.spec.ts）：成功1、未実行2                                                                                                                                                       | URL、非表示、GET0回を確認。未ログイン時metadata非露出の専用assertは未実装。                                                 |
| B-S02  | B（page.spec.ts）：成功3、未実行6                                                                                                                                                       | Chromiumで他人／nullの拒否とtrim後一致を確認。                                                                              |
| B-N04  | B（page.spec.ts）：成功3、未実行6                                                                                                                                                       | Chromiumで標準／未入力metadataと同一描画内GET1回を確認。                                                                    |
| B-F01  | B（page.spec.ts）：成功4、未実行8                                                                                                                                                       | Chromiumで401/404/500/接続断。非表示の全操作・CSR送信0の網羅的assertには不足あり。                                          |
| B-N05  | B（page.spec.ts）：成功4、未実行8                                                                                                                                                       | Chromiumで4画面幅・長い商品名・横overflow・確認ボタンを確認。                                                               |
| B-N06  | B（page.spec.ts）：成功1、未実行2                                                                                                                                                       | 実URLと戻る/reloadを確認。遷移先API不足により編集フォーム内容の保証なし。                                                   |
| B-S03  | B（page.spec.ts）：成功1、未実行2                                                                                                                                                       | 一部実施、残りはユーザー指示で未実行。                                                                                      |
| B-O01  | B（components.spec.ts）：成功1、未実行2                                                                                                                                                 | 画像complete＋naturalWidthと失敗要求・操作時間のみ。全画像/動画の読込・request総数・性能SLAは未実装／未確定。               |
| Q01    | C/P（deleteItemDraft/integration.test.tsx）：失敗2<br>B（operations.spec.ts）：失敗1、未実行2                                                                                           | 失敗あり。問題検出の詳細は修正案を参照。                                                                                    |
| Q02    | C/P（itemDraftPage.test.tsx）：失敗2<br>B（operations.spec.ts）：失敗2、未実行4                                                                                                         | 失敗あり。問題検出の詳細は修正案を参照。                                                                                    |
| Q03    | C/P（itemDraftPage.test.tsx）：失敗2<br>B（operations.spec.ts）：失敗1、タイムアウト1、未実行4                                                                                          | Bのdelete-editはoverlayが編集クリックを遮り30秒timeout。Bの本番判定不可。PとEでは相反HTTP送信を検出。                       |
| Q04    | C/P（itemDraftPage.test.tsx）：失敗1<br>B（operations.spec.ts）：失敗1、未実行2                                                                                                         | PとEで再送を検出。Bはclock.pauseAtの過去時刻指定でテストコードが失敗し、本番判定不可。                                      |
| Q05    | U（itemPeek.test.tsx）：失敗2<br>C/P（itemDraftPage.test.tsx）：失敗2<br>B（components.spec.ts）：失敗2、未実行1                                                                        | 削除開始／閉鎖とItemPeekをU/Pで分離。Bは削除開始のrole不足で止まり、後段は未実行。                                          |
| Q06    | B（components.spec.ts）：失敗1、中断1、未実行1                                                                                                                                          | Chromiumはdialog不存在で失敗しTab/Shift+Tab/Escape/復帰は未到達。Firefoxは中断。                                            |
| Q07    | U（deliverySection.test.tsx）：失敗6<br>C/P（itemSection/integration.test.tsx）：失敗6<br>B（components.spec.ts）：失敗2、未実行4                                                       | 失敗あり。問題検出の詳細は修正案を参照。                                                                                    |
| Q08    | U（slideshow.test.tsx / variantsList.test.tsx）：失敗2<br>B（components.spec.ts）：失敗1、未実行2                                                                                       | Uでは画像拡大とvariantsを個別検証し両方失敗。Bは画像拡大の名前付きbutton不足で止まり後段未到達。                            |
| Q09    | U（variantsList.test.tsx）：成功5、失敗3<br>C/P（itemSection/integration.test.tsx）：成功1、失敗3<br>B（components.spec.ts）：成功1、失敗3、未実行8                                     | 個別ratio=0.3を要求する追加品質契約。色current=3とサイズcurrent=2/4で失敗。業務側合意は残件。                               |
| Q10    | U（videoElem.test.tsx）：失敗1<br>B（components.spec.ts）：失敗1、未実行2                                                                                                               | UとChromiumで空converted_urlが元動画srcを設定しないことを検出。                                                             |
| E-N01  | E（createItemEditingDraft/flow.spec.ts）：成功4、未実行2                                                                                                                                | 実POST201、コピー列・管理値・元行消費・保護snapshotを確認。F-fullの動画・variantsは標準設計より簡略なseedで追加条件未実装。 |
| E-N02  | E（createItemEditingDraft/flow.spec.ts）：成功2、未実行1                                                                                                                                | 実POST201、未入力値コピーと元行消費を確認。遷移先フォーム内容・全管理値の専用assertは未実装。                               |
| E-N03  | E（deleteItemDraft/flow.spec.ts）：成功4、未実行2                                                                                                                                       | 一部実施、残りはユーザー指示で未実行。                                                                                      |
| E-N04  | E（deleteItemDraft/flow.spec.ts）：成功2、未実行1                                                                                                                                       | 実DELETE200、対象消失・編集増加0・保護snapshot。S3 SDK非通信の実監視は未実装。                                              |
| E-F01  | E（createItemEditingDraft/flow.spec.ts / deleteItemDraft/flow.spec.ts）：成功3、中断1、未実行2                                                                                          | 一部実施、残りはユーザー指示で未実行。                                                                                      |
| E-S01  | E（createItemEditingDraft/flow.spec.ts / deleteItemDraft/flow.spec.ts）：成功6、未実行6                                                                                                 | 一部実施、残りはユーザー指示で未実行。                                                                                      |
| E-S02  | E（createItemEditingDraft/flow.spec.ts / deleteItemDraft/flow.spec.ts）：成功3、未実行3                                                                                                 | 一部実施、残りはユーザー指示で未実行。                                                                                      |
| E-S03  | E（createItemEditingDraft/flow.spec.ts / deleteItemDraft/flow.spec.ts）：成功4、未実行5                                                                                                 | 一部実施、残りはユーザー指示で未実行。                                                                                      |
| E-F02  | E（createItemEditingDraft/flow.spec.ts / deleteItemDraft/flow.spec.ts）：成功3、未実行3                                                                                                 | 実レート制限の編集6回目／削除21回目。削除429は非JSONでalert、後続停止・DB不変を確認。                                       |
| E-Q01  | E（deleteItemDraft/flow.spec.ts）：失敗5、未実行10                                                                                                                                      | Chromiumで5操作すべて余分なHTTPを検出。先頭4操作はsoft assert後DB確認も実施。成功後1500ms再送は件数失敗で後段へ未到達。     |
| E-N05  | E（createItemEditingDraft/flow.spec.ts / deleteItemDraft/flow.spec.ts）：成功3、未実行3                                                                                                 | URL・戻る/reload・操作なしとDB状態。表示取得は代替のため実GETの保証なし。                                                   |

### 実装・保証が残る範囲

- 遷移先 `/upload/[id]`・`/my-page` はURLまで。対象外APIの不足によるエラーもあり、フォーム／一覧内容までは保証しない。
- EのF-fullは画像・商品・セール・配送・参照IDを含むが、動画URL・duration等はnull、色・サイズvariantsなし。設計F-media/F-attrsの全非nullコピー条件は未実装。実行成功件数からこの不足を除外できない。
- EはD2/D3/E0と7参照マスターを全列比較。公開Itemのseed・保護snapshot、S3 SDK非通信監視、owner User等の追加保護snapshotは未実装。
- schema guardは接続先test_db、主要型・nullable・コピー列・主要FK方向を検証。enum値、日時型、item_editing.item_id FK、全master型は未確認。migration・syncは未実行。
- Chromiumは全業務ケースまで到達。Firefoxは途中で打切り、WebKitは今回の最終runで未着手。過去のOS依存不足を今回のWebKit失敗とはしていない。
- Q系は最初のassertで止まった場合、後段のfocus trap・Escape・遷移・DB assertを実行済みとしない。B-Q04は時計制御のテスト不備、B-Q03逆順はoverlay操作手順の不備が残る。
- 新しい `test/fixtures/item/itemDraftPage/startNext.mjs` は再現用launcherとして作成したが、ユーザー指示後の実行・lintは未実施。現在の実行証拠は同じenvを設定した一時起動スクリプトとnpm startによる。

## 4. 実処理・モック・実行証拠

- U：対象部品を実行し、子部品・API・router・通知を境界で代替。HLS/Swiperの単体代替で実再生・レイアウトは保証しない。
- C/P：専用fetchと共通apiFetchは実処理、HTTPはMSW、認証token取得・router・通知を代替。削除sleepはC/Pでgate、実1499/1500msはUで確認。VideoTitleだけ同期代替。
- B：実Next.js、実Server/Client Component・metadata・所有者照合・SSR/Hydration。GET等は4011のテストAPI、認証はNextAuth暗号化cookie fixture。BのJWTは業務認証の実証に使わない。CSR操作APIはpage.routeによる代替。
- E：実NextAuth credentialsログイン、実access-token、実Express Router/middleware/usecase/service、実test_db。未実装GETのみDB-backed proxyで代替。重複ケースはroute.fetchで実APIを通してから応答だけgateで保留。Expressはcron起動を避けた隔離プロセスで、アプリ全体のbootstrap検証ではない。
- DB接続元はserver/.env.testに限定。pg接続とExpressのdb.ts/models側の各接続を確認。fixtureで今回作成IDを追跡し逆依存順にcleanupし、残存0を確認する。中断した最後のケースの全業務assertと、実行後の全DB横断照合は未確認。トップレベルteardown errorはJSONにない。
- 既定3000番が使用中だったため専用3011/3012へ変更。既存サービスは停止していない。今回のNext.js、APIサーバー、テストランナーは後片付けした。

集計元（/tmpの一時成果物、永続保存を保証しない）：

- `/tmp/item-draft-unit-final.json`：133件。`/tmp/item-draft-integration-final.json`：55件。
- `/tmp/item-draft-browser-final.json`：117件。`/tmp/item-draft-e2e-final.json`：78件。後者2runはユーザー指示でexit130。
- 先行probeやagentの個別実行は最新集計へ加算しない。Eの初回probeは19成功/2失敗/5未実行、その後の全runが最新。
- 静的検査：`client/npm run lint` は既存23error/35warningで失敗（`/tmp/item-draft-lint.log`）。この時点の追加コードに診断なしと、最新全ファイルのlint成功は別。
- 専用・共有単体と初期C/Pの対象lintは成功。B初期版lintは0error/2未使用引数warning。最後に補完したB/E・launcherの全対象lintはユーザー指示により未実行。
- `client/npm run typecheck` は初期U/C/P時点で成功。最新B/E TSを含む `client/tsc --noEmit -p test/tsconfig.json` と `test/npm run typecheck` は成功（`/tmp/item-draft-test-types-final.log`、`/tmp/item-draft-e2e-types-final.log`）。最新全体npm typecheckの再実行は未実施。
- build：通常Turbopackはcompile段階で11分以上進まず当該processだけ停止（exit143、原因未確定）。制限外WebpackとローカルURL固定buildは成功。Node26での検証なし。

### 再現コマンド（再開時用、指示後には実行していない）

```bash
# client/、依存導入済み・Node指定環境で
npm run test:unit -- src/app/item/draft/test/ src/app/item/draft/api/test/ src/app/item/videoSection/test/ src/app/item/itemSection/test/ src/components/container/test/ src/lib/test/formatRelativeTime.test.ts --reporter=json --outputFile=/tmp/item-draft-unit-final.json
npm run test:integration -- test/integration/components/item/itemDraftPage/ test/integration/pages/item/itemDraftPage/ --reporter=json --outputFile=/tmp/item-draft-integration-final.json
NEXT_PUBLIC_API_URL=http://127.0.0.1:5021/api API_URL=http://127.0.0.1:4011 NEXTAUTH_URL=http://127.0.0.1:3011 NEXTAUTH_SECRET=item-draft-browser-local-fixture-secret npm run build -- --webpack
# 別processでB用API（Node22なら--experimental-strip-types、Node26は環境に合わせる）
node --experimental-strip-types test/fixtures/item/itemDraftPage/apiServer.ts
# リポジトリルートのtest/で、別processにてモードごと起動
node fixtures/item/itemDraftPage/startNext.mjs browser
node fixtures/item/itemDraftPage/startNext.mjs e2e
# client/でB。今回実行はtimeout 600s、SIGINTで途中終了
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3011 ./node_modules/.bin/playwright test test/integration/pages/item/itemDraftPage/ --workers=1 --trace=off --reporter=json > /tmp/item-draft-browser-final.json
# test/でE。server/.env.testとtest_dbの反映済みschemaが必要
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 ITEM_DRAFT_E2E_EXPRESS_URL=http://127.0.0.1:5021/api ITEM_DRAFT_E2E_PROXY_URL=http://127.0.0.1:4022/api ./node_modules/.bin/playwright test E2E/item/itemDraftPage/ --workers=1 --trace=off --reporter=json > /tmp/item-draft-e2e-final.json
```

## 5. 結果に基づく修正案（すべて提案のみ）

本番修正は実施していない。既存の通常ケース・Q系の期待値を維持し、下記を実装後、元IDで再実行する。未実施部分の補完に機械的な新IDは付けない。

| 修正ID・元ケース                       | 対象・確認した原因／修正前条件                                                                        | 修正方針・修正後の契約・再検証                                                                                                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1：Q01                                | draft/delete.tsx。保留中の連打／EnterでDELETE3回（C）、実Eで2回                                       | 再入防止ref等を送信開始前に設定し、button disabledと状態を同期。失敗時のみ解除。U/C/B/Eの重複送信0を確認                                                                                     |
| F2：Q02/Q03/E-Q01                      | draft/itemDraftPage.tsx/editButton.tsx/delete.tsx。各編集state独立で上下POST2回、編集と削除も両方送信 | ページ単位の操作中状態を共有して、編集・削除の相反操作を排他。親の同期guardと子のdisabledを組み合わせる。バックエンド排他を代用品にせずHTTP1回を要求                                         |
| F3：Q04/E-Q01                          | 削除200後、1500ms待ちに再び確認を開けDELETE追加                                                       | 成功確定状態を遷移まで維持し再開放しない。通知・遷移も1回。元U-N04/C-N02とP/E-Qの成功・失敗回復を回帰                                                                                        |
| F4：Q05/Q06                            | 削除開始p、閉じるSVG、ItemPeek roleのみ。実ブラウザーでbutton/dialogが見つからない                    | 名前付きbutton、dialogのlabel/modal属性、初期focus・Tab/ShiftTab trap・Escape・復帰を実装。ItemPeekのキーボード操作も対応。テストのrole要求を弱めない                                        |
| F5：Q07                                | deliverySection.tsx。initial2〜4の三項演算子が文言でなくbooleanを返す                                 | 条件計算と描画を分け、current1=残りわずか、2以上=在庫ありを描画。SOLDと通常在庫・素材の既存assertも維持                                                                                      |
| F6：Q08                                | slideshow.tsx/variantsList.tsx。画像・閉じる・色カードがdiv/SVGのclick依存                            | 名前付き操作・keyboard・開閉状態を公開し実マウス操作も維持。Q08の前段だけでなく画像閉鎖とvariantsまで独立に検証                                                                              |
| F7：Q09                                | variantsList.tsx。色が0.2固定、サイズがratio以上で低在庫                                              | 設計で要求した「0より大きく個別閾値以下」を業務側と合意して統一。0/閾値直前/一致/直後を維持。未合意を理由に現コードへassertを書換えない                                                      |
| F8：Q10                                | videoElem.tsx。表示は論理和、source選択はnull合体で空convertedが元URLを遮断                           | 再生可能な非空URLへfallbackを統一。元URLのsrc設定・実play・HLS cleanup・集計未送信を回帰                                                                                                     |
| F9：B-Q03/Q04                          | operations.spec.ts。削除overlayが編集へのmouse操作を遮る。clock.pauseAtの+50msが操作遅延で過去となる  | overlay越しpointerを強制せず実keyboard操作等で相反要求を再現。時計は初期から固定し、成功後に相対制御する。今回はユーザー指示で修正・再実行せず、テスト不備として残す                         |
| F10：E-F02（初回テスト不備は修正済み） | 実rate limiterは既定text応答。JSON429を想定したトーストassertが不適合                                 | 既存契約のJSON解析失敗→alertを実応答で検証するようテストだけ修正し、最新runで成功。HTTP429/遷移なし/DB不変assertは維持。APIのJSON統一は別の提案で、本番未修正                                |
| F11：未実装・未実行全般                | F-full簡略seed、遷移先内容、S3実監視、B-O01不足、Firefox/WebKit残り                                   | レポート3章の不足を元IDへ補完し、未実行を再開。S3監視は実SDK境界の記録など対象処理を置き換えない方法を別途設計。取得GET実装後は代替を外した完全E2Eを追加                                     |
| F12：実行設定                          | 既存PostCSS文字列配列がViteの収集を止めた                                                             | Vitestだけcss.postcss.plugins=[]を設定済み。本番CSS未変更。DOMでは実レイアウト保証をせずBへ分離。通常ケースと型検査が通ったことを確認済み。Node26/通常Turbopack停止原因/最新全対象lintは残件 |

修正実装を再開する際は、各Fと元ID、変更ファイル、期待値の維持／追加、回帰結果をこの文書へ追記する。今回の検出は本番修正完了を意味しない。

## 6. 2026-10-29 中断・未実行箇所の再開結果

### 実行範囲・環境・変更

- B全117件、E全78件を3ブラウザーで完走。前回結果との重複加算なし。Node.js 22.22.2、既存のproduction buildをstartNext.mjsのbrowser/e2eモードで起動した。今回はbuildを再実行していない。Node26・通常Turbopack検証は残る。
- F9のテスト不備をoperations.spec.tsで修正。Q03削除→編集はoverlay越しのマウスクリックをEnter操作へ変更。Q04は時計をinstall時から固定し、操作後の過去時刻指定を除去。期待値は維持し、いずれも3ブラウザーで業務要求の排他・再送防止のassertまで到達して失敗した。Q04は期待1回に対してDELETE2回。
- 再現コマンドは4章のB/Eコマンドと同じ対象・環境変数・workers=1・trace=off・reporter=json。出力先のみ `/tmp/item-draft-browser-resume.json`、`/tmp/item-draft-e2e-resume.json`。timeoutによるrun全体の打切りは行っていない。これらは一時成果物。
- 実処理・モック境界は4章と同じ。Eはtest_dbへの実API検証、migration/sync未実施。個別fixtureのcleanup後にトップレベルエラーなし。DB全体の独立した残存検査は未実施。

### ファイル・ブラウザー別結果

| project | ファイル（各テストルート基準） | 成功 | 失敗 | timeout |
| --- | --- | ---: | ---: | ---: |
| pages-chromium | `item/itemDraftPage/components.spec.ts` | 5 | 9 | 0 |
| pages-firefox | `item/itemDraftPage/components.spec.ts` | 5 | 9 | 0 |
| pages-webkit | `item/itemDraftPage/components.spec.ts` | 4 | 10 | 0 |
| pages-chromium | `item/itemDraftPage/operations.spec.ts` | 0 | 6 | 0 |
| pages-firefox | `item/itemDraftPage/operations.spec.ts` | 0 | 6 | 0 |
| pages-webkit | `item/itemDraftPage/operations.spec.ts` | 0 | 6 | 0 |
| pages-chromium | `item/itemDraftPage/page.spec.ts` | 19 | 0 | 0 |
| pages-firefox | `item/itemDraftPage/page.spec.ts` | 19 | 0 | 0 |
| pages-webkit | `item/itemDraftPage/page.spec.ts` | 19 | 0 | 0 |
| e2e-chromium | `item/itemDraftPage/createItemEditingDraft/flow.spec.ts` | 10 | 0 | 0 |
| e2e-firefox | `item/itemDraftPage/createItemEditingDraft/flow.spec.ts` | 10 | 0 | 0 |
| e2e-webkit | `item/itemDraftPage/createItemEditingDraft/flow.spec.ts` | 1 | 6 | 3 |
| e2e-chromium | `item/itemDraftPage/deleteItemDraft/flow.spec.ts` | 11 | 5 | 0 |
| e2e-firefox | `item/itemDraftPage/deleteItemDraft/flow.spec.ts` | 11 | 5 | 0 |
| e2e-webkit | `item/itemDraftPage/deleteItemDraft/flow.spec.ts` | 3 | 7 | 6 |

### ケース対応（3ブラウザー合算）

元IDと実ファイルの対応は3章を維持。下表は今回の展開テスト数であり、ID数ではない。

| 階層 | ID | 成功 | 失敗 | timeout |
| --- | --- | ---: | ---: | ---: |
| browser | B-N02 | 5 | 1 | 0 |
| browser | B-N03 | 3 | 0 | 0 |
| browser | Q05 | 0 | 3 | 0 |
| browser | Q06 | 0 | 3 | 0 |
| browser | Q08 | 0 | 3 | 0 |
| browser | B-O01 | 3 | 0 | 0 |
| browser | Q07 | 0 | 6 | 0 |
| browser | Q09 | 3 | 9 | 0 |
| browser | Q10 | 0 | 3 | 0 |
| browser | Q01 | 0 | 3 | 0 |
| browser | Q02 | 0 | 6 | 0 |
| browser | Q03 | 0 | 6 | 0 |
| browser | Q04 | 0 | 3 | 0 |
| browser | B-N01 | 6 | 0 | 0 |
| browser | B-N04 | 9 | 0 | 0 |
| browser | B-S01 | 3 | 0 | 0 |
| browser | B-S02 | 9 | 0 | 0 |
| browser | B-F01 | 12 | 0 | 0 |
| browser | B-N05 | 12 | 0 | 0 |
| browser | B-S03 | 3 | 0 | 0 |
| browser | B-N06 | 3 | 0 | 0 |
| e2e | E-N01 | 4 | 0 | 2 |
| e2e | E-N02 | 2 | 0 | 1 |
| e2e | E-F01 | 4 | 2 | 0 |
| e2e | E-S02 | 4 | 2 | 0 |
| e2e | E-S03 | 6 | 3 | 0 |
| e2e | E-S01 | 10 | 2 | 0 |
| e2e | E-F02 | 4 | 2 | 0 |
| e2e | E-N05 | 4 | 2 | 0 |
| e2e | E-N03 | 6 | 0 | 0 |
| e2e | E-N04 | 2 | 0 | 1 |
| e2e | E-Q01 | 0 | 10 | 5 |

### 判定・残件と静的検査

- F1〜F8は本番未修正。Q系の失敗を合格やskipへ変更していない。F9はテスト修正・再検証済み。B-Q04はテスト時計のエラーではなく再送検出に更新した。
- WebKit Eは成功4、失敗13、timeout9。複数ケースでmiddlewareが設定するaccess-token cookie不存在を検出し、編集・削除操作待ちでtimeoutも発生。OSライブラリ不足ではない。認証・cookieの根本原因は未確定で、これらを業務ロジックの不具合と断定しない。前段で失敗したケースのDB・後段assertは未検証。
- F11のブラウザー未着手は解消。簡略seed、遷移先内容、S3監視、公開Item等の保護snapshot、schema guard不足、B-O01不足など3章の未実装範囲は今回追加していない。カバレッジ未取得。
- client `npm run lint`：失敗、23 errors/37 warnings。今回の修正以外の既存コードにエラー。`npm run typecheck`：失敗、53診断（生成 `.next/types` とページの同期params定義等の不整合）。`/tmp/item-draft-lint-resume.log`、`/tmp/item-draft-types-resume.log`。
- client `tsc --noEmit -p test/tsconfig.json` と test `npm run typecheck`：成功。`/tmp/item-draft-test-types-resume.log`、`/tmp/item-draft-e2e-types-resume.log`。
- client `eslint test/integration/pages/item/itemDraftPage test/fixtures/item/itemDraftPage`：0 errors/2 warnings（既存page.spec.tsの未使用request）。E2E/fixture/launcherの6ファイルは既存typescript-eslint recommendedをESLint APIで適用し0 errors/0 warnings。共有設定の変更なし。実行スクリプト `/tmp/item-draft-eslint-resume.mjs`、結果 `/tmp/item-draft-e2e-lint-resume.log`。startNext.mjsは今回両モードの起動を確認済み。
