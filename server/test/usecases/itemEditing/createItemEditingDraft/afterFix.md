# 下書きから商品編集セッション作成：修正案

## 1. 対象と判断

[testReport.md](./testReport.md) のレビュー・実行結果に基づく提案。対象206件は成功したが、本番共通エラー処理、設計に対する検証不足、追加lintに修正が必要である。**本書は修正案のみで、本番コード・テストの修正や修正後の再実行は行っていない。**

パスは `server/` 基準。下書きコピー・取得where・行ロック・同一transaction・削除の業務処理は維持する。入力ID上限の決定、他機能のimportエラー、スキーマ変更は対象外。

## 2. 本番コードの修正案

### F1（P0）：共通errorHandlerを4引数で登録する

根拠はPR01・R08。現行handlerが3引数なので、Express 4はエラー処理時にスキップする。Routerテストは別の4引数handlerを使うため、この問題を検出できなかった。

対象は `src/middleware/errorHandler.ts`。`ErrorRequestHandler` 型で `(err, req, res, next)` の4引数を明示し、既存のAppErrorと通常ErrorのJSON形式・statusを保持する。利用しない引数もlintに適合する形で明示的に扱い、引数の削除・デフォルト引数化・rest引数化で関数lengthを減らさない。

修正後は、本Routerが渡すINVALID_BODY/400・ITEM_DRAFT_NOT_FOUND/404と、通常Error/500が共通handlerから返る。201応答、認証middleware自身の401、レートmiddleware自身の429、DBの原子性は変更しない。

対象usecase/service/modelに、本テスト結果を理由とした追加修正は提案しない。

## 3. テストコードの修正案

### F2（P1）：実共通handlerの接続テストを追加する

対象は `test/usecases/itemEditing/createItemEditingDraft/route.test.ts`。既存R08の観測handlerテストは維持し、実Router＋実共通errorHandlerの最小アプリを別に組む。usecaseだけをモックしてAppError/通常Errorを返し、statusに加えて既存JSON形式を完全一致で確認する。DBやapp全体の起動は不要。

修正前は共通handlerの登録Layerがエラーを処理せず次へ渡る。修正後はエラーJSONを返し、正常201には影響しないことを確認する。

### F3（P1）：非対象行・要求識別・service境界を補う

根拠はRV01〜RV03。対象は同ディレクトリの `databaseConcurrency.test.ts`、`databaseFixtures.ts`、`services.test.ts`。

- P01〜P08で別下書き・既存編集・Item・参照先の事前snapshotを取り、並行処理後に全列一致を確認する。P09ではBの下書きが操作対象になるため、それを保護対象から除き、残る非対象行を比較する。
- P01はA/Bごとの開始・取得・transaction・完了結果を記録する。A先行/B先行それぞれで、指定した要求が成功し他方が404になることをassertする。入力は同一のまま、ラベルの入替えだけで逆順確認済みとしない。
- E08のSケースでは画像11件の配列をserviceへ渡し、モデルcreateへの同じdata/tの引渡しと、モデル側のValidationErrorの同一参照での伝播を確認する。拒否そのものの保証は既存Dテストに置く。

### F4（P1）：4引数を維持して追加lintを通す

根拠はRV04。対象は `route.test.ts:31` と `database.test.ts:90` の観測用handler。`_next` を削除せず、例えば `void _next;` で未使用が意図的であることを示す。テストに必要な4引数の関数lengthと既存観測結果を維持し、共有ESLint設定は変更しない。

## 4. 追加・移行するケース

| 追加ID | 元ID・根拠 | レベル | 入力・手順 | 修正後の期待結果 |
| --- | --- | --- | --- | --- |
| AF-R01 | V02/V03・PR01 | R | 正常認証＋不正ID、実共通handlerを接続 | 400、`{ code: "INVALID_BODY", message: "INVALID_BODY" }`、usecase未実行 |
| AF-R02 | E01/E02/R08・PR01 | R | usecaseがITEM_DRAFT_NOT_FOUND/404を返す | 共通handlerから404とcode/messageのJSON、201なし |
| AF-R03 | E04〜E06/R08・PR01 | R | usecaseが通常Errorを返す | 500、既存のerror/messageのJSON。内部Errorの詳細なし |
| AF-R04 | C02/R02 | R | F1後に正常要求 | 201・`{ itemEditingId }` を維持 |
| AF-DB01 | P01〜P08/ST06・RV01 | D | 既存の各競合を実行し非対象snapshotも比較 | commit/rollback後も非対象行全列不変 |
| AF-DB02 | P09/ST06・RV01 | D | 別所有者・別下書きの成功を交差 | 対象2行は移行、対象外下書き・既存編集・参照先は不変 |
| AF-DB03 | P01・RV02 | D | A先行/B先行を要求別traceで独立展開 | 指定した先行要求だけ成功、後続404、編集1行、実ロック待機あり |
| AF-S01 | E08・RV03 | S | モデルcreateにValidationErrorを設定し画像11件を渡す | 同じ配列/data/tを引き渡し、同じ例外を伝播。DB拒否は既存E08で別確認 |
| AF-R05 | R08/ST03・RV04 | R/D | 未使用引数を明示した4引数handlerで既存要求を再実行 | 既存結果と関数length=4を維持し、追加lintエラー0 |

既存206件は原則維持する。P01は手順とassertを補強し、P01〜P09は非対象行assertを追加する。E08のD検証・R08の観測用handlerの期待値は変更しない。初回の通信制限を理由にskip化や期待値変更を行わない。

## 5. 修正後の確認と完了条件

F1/F2 → F3/F4の順に実施する。対象Vitest、npm run lint、npm run typecheck、テストTSの型検査と追加lintを再実行する。DB検査は引き続き `.env.test`・test_dbの全接続ガードを通し、別接続の結果と後片付けを確認する。

完了条件は、共通handlerの400/404/500と正常201、要求別の競合結果、並行後の非対象行不変、E08のS/D責務、追加lint成功が確認できること。ケースID・追加テスト・実行件数の対応を報告し、対象外の既知importエラーを全体成功へ混ぜない。未確定のID上限と実commit障害の検証は引き続き保留／対象外とする。
