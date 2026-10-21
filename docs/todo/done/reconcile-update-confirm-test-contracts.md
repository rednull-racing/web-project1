# updateConfirmテストの旧契約と依存モックを見直す

優先度: P3-techdebt。

## 問題と確認結果

2026-10-16のテスト配置変更時、DB非接続のテストで451件成功・57件失敗、controllerのsuiteは収集時に停止した。移動前の元ファイルを同じコード・環境で比較実行し、全テスト名と成否が一致した。今回の配置変更では期待値・本番コードを変更していない。DBテスト106件は未実行。

- `server/src/usecases/shared/test/updateConfirm.signedUrls.test.ts`：S15の1件が失敗。署名関数のundefinedを許容する旧期待値に対し、現在のbuildSignedUrlsはVIDEO_SIGNED_URL_UNAVAILABLE/500を返す。
- `server/test/integration/usecases/itemEditing/updateConfirm/masterBrand.test.ts`：数値変換と実helperの接続で34件失敗。0・負数・小数・Infinityの許容や空白を0へ変換する旧期待値に対し、現在のvalidateNumberは正整数の上限を検査し、空白をnullにする。
- `server/test/integration/usecases/itemEditing/updateConfirm/route.test.ts`：対象外createItemEditingCopyのモック漏れでDB設定読込みへ進み、DATABASE_URL未設定のため22件すべてが検証前に停止。
- `server/src/controllers/itemEditing/test/updateConfirm.test.ts`：同様のモック漏れで収集時に停止。旧報告では5ケースだったが今回は未収集。既存の `isolate-item-editing-controller-tests-from-db.md` も参照する。

## 修正方針・参照先

`server/src/usecases/shared/{buildSignedUrls,validateNumber}.ts`、`server/src/controllers/itemEditing/itemEditing.ts` と、`server/test/docs/{architecture,report}/itemEditing/updateConfirm.md` を確認する。元のケースID・過去の観測・現行仕様の変更根拠を照合し、確定済みの契約に従って旧観測テストを移行する。現行実装に合わせる目的だけで期待値を変更しない。

Router・controllerは対象外usecaseを現在の実ファイルパスでモックし、DB非接続で実行できるようにする。DB環境変数を追加してモック漏れを回避しない。

## 検証・注意事項

server/で対象テスト、lint・typecheck、`./node_modules/.bin/tsc --noEmit -p test/tsconfig.json` を確認し、件数とケースIDの対応を報告書へ追記する。実行対象の一覧は設計書冒頭にある。HTTP待受けがサンドボックスで拒否された場合は承認手順に従って再実行する。DB接続・migration・本番コードの変更を本Todoから拡大しない。

## 解決結果（2026-10-16）

DB初期化修正後もRouter22件と旧契約35件の失敗が残ることを再現。共有helperを修正したe31f97a6およびcreateItemDraft修正報告F4/F5を根拠に、S15の署名欠落拒否・I03/I04等の正整数範囲と空白null化へ期待値を移行した。数値上限境界・null署名・後続未実行も検証し、Router/controllerの対象外usecaseを実パスでモックした。

updateConfirm8ファイル533件、Draft/Copy controller回帰9件の計542件が成功。lint・本番/テスト全体型検査・結合TS追加lintも成功。DB接続・migration・本番コード変更なし。詳細は [最新レポート](../../../server/test/docs/report/itemEditing/updateConfirm.md#contracts-20261016) を参照。
