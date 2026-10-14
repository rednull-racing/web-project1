# UseCase内部で切り離されている副作用の完了保証を整理する

## 問題の概要

複数のUseCaseが、通知作成、ランキング値更新、トークン削除、S3オブジェクト削除などを `await` せず、個別の `.catch(console.error)` で失敗を握りつぶしている。

UseCaseが正常終了しても必要な副作用が失敗している可能性があり、呼び出し元や共通の非同期実行境界が処理結果を把握できない。

## 原因

各副作用について、業務処理の完了条件に含めるか、失敗を許容する補助処理とするかが定義されていない。HTTPレスポンスから処理を切り離す共通境界は導入済みだが、その境界より内側のUseCaseにもfire-and-forget処理が残っている。

## 修正方針

各副作用を「成功がUseCaseの完了条件となる処理」と「失敗を許容して別管理する処理」に分類する。完了条件となる処理は必ずawaitし、必要なDB更新は既存トランザクションへ含める。

失敗を許容する処理は、個別の `.catch(console.error)` を残さず、処理名と対象IDを記録できる既存の共通実行境界へ集約する。HTTPレスポンスから切り離す必要がある場合はController側でUseCase全体を起動し、UseCase内部では下位処理をさらに切り離さない。

## 対象ファイル

- `/server/src/usecases/auth/*.ts`
- `/server/src/usecases/cart/*.ts`
- `/server/src/usecases/comment/*.ts`
- `/server/src/usecases/commentLike/*.ts`
- `/server/src/usecases/itemLike/*.ts`
- `/server/src/usecases/itemReport/create.ts`
- `/server/src/usecases/commentReport/create.ts`
- `/server/src/usecases/items/delete/*.ts`
- `/server/src/usecases/items/restore/*.ts`
- `/server/src/usecases/items/search/*.ts`
- `/server/src/usecases/items/upload/*.ts`
- `/server/src/usecases/shopInfo/edit/*.ts`
- `/server/src/usecases/shopInfoEdit/create/*.ts`
- `/server/src/usecases/shopInfoEdit/update/*.ts`
- `/server/src/usecases/transfer/*.ts`
- `/server/src/usecases/users/edit/*.ts`
- `/server/src/usecases/admin/users/deleteUriage.ts`

## 参照すべきファイル

- `/server/src/utils/runDetachedTask.ts`
- `/docs/todo/done/centralize-detached-controller-tasks.md`
- `/docs/codingRule/backend/usecase.md`
- 各UseCaseから呼び出されるServiceとController

## 実装内容

- `/server/src/usecases` 配下の `.catch(...)` を列挙し、処理ごとの完了要件を確認する。
- 必須の通知、DB更新、トークン削除、S3削除、ランキング更新をawaitする。
- 同一業務処理として原子性が必要なDB更新は、同じトランザクションへ含める。
- 失敗許容の副作用は共通の実行・記録方法へ統一し、処理名と対象IDを含める。
- 同じUseCase内で後続処理が依存するPromiseは必ず完了を待つ。
- 同期throwと非同期rejectが未処理Promiseにならないテストを追加する。
- 主要な成功・副作用失敗・トランザクション失敗のテストを追加する。
- `cd server && npm run lint && npm run typecheck` を実行する。

## 実装時の注意事項

- HTTP status、レスポンスキー、既存の業務結果を独断で変更しない。
- 通知などの副作用をトランザクションへ含める場合は、既存Serviceがtransactionを受け渡せることを確認する。
- S3操作とDBトランザクションの整合性は、失敗時の補償処理を含めて判断する。
- 永続ジョブキューや新しいライブラリを独断で追加しない。
- 一度に全機能を機械的に変更せず、機能ごとのAPI契約を確認する。

---

## 結果

失敗許容処理を問題点としてtodoリストに載せていた。何も変更せず終了する。なお、今後は `await` がついていないという理由だけで失敗許容処理を問題点として指摘しない方針を`AGENTS.md`に追加した。
