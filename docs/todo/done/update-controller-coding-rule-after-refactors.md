# Controllerコーディング規約を現在の実行境界へ更新する

## 問題の概要

`controller.md` に、現在のController実装および完了済みリファクタと一致しない規約が残っている。

- query値によるUseCase選択をController内で行う記載があるが、一覧取得処理は上位UseCaseへ集約済みである。
- 非同期受付処理でUseCaseへ直接 `.catch(console.error)` を付ける例があるが、対象Controllerは共通の `runDetachedTask` を使用する構造へ変更済みである。

規約を参照した新規実装が、解消済みの責務混在や個別エラー処理を再導入する可能性がある。

## 原因

一覧UseCaseのディスパッチ集約と、Controllerのfire-and-forget実行境界共通化が完了した後に、Controllerコーディング規約が更新されていない。

## 修正方針

現在のController、上位UseCase、`runDetachedTask` の実装を確認し、`controller.md` を実装済みの責務境界へ合わせる。

単純なHTTP上の分岐と業務UseCaseの選択を区別し、業務フローを構成するディスパッチは上位UseCaseへ配置するルールを明記する。非同期受付処理は裸のPromiseや個別 `.catch()` を禁止し、共通実行境界を使用する規約へ変更する。

## 対象ファイル

- `/docs/codingRule/backend/controller.md`

## 参照すべきファイル

- `/docs/codingRule/backend/AGENTS.md`
- `/docs/codingRule/backend/usecase.md`
- `/server/src/controllers/items.ts`
- `/server/src/controllers/users/me/items.ts`
- `/server/src/controllers/comment.ts`
- `/server/src/controllers/video.ts`
- `/server/src/usecases/items/itemList/itemList.ts`
- `/server/src/usecases/items/itemList/recommendItems.ts`
- `/server/src/usecases/items/itemList/userItems.ts`
- `/server/src/utils/runDetachedTask.ts`
- `/docs/todo/done/centralize-controller-list-usecase-dispatch.md`
- `/docs/todo/done/centralize-detached-controller-tasks.md`

## 実装内容

- query値によるUseCase切り替えの記載を、HTTP責務と業務ディスパッチの境界が判別できる内容へ更新する。
- 業務上の組み合わせ判定と下位UseCase選択は上位UseCaseが担当することを明記する。
- 非同期受付処理の例を `runDetachedTask` を使用する現在の形式へ更新する。
- ControllerがPromiseへ直接 `.catch(console.error)` を付けないことを明記する。
- `server/AGENTS.md`、ControllerとUseCaseのAGENTS.md、他のコーディング規約との矛盾がないことを確認する。
- Markdown以外の実装ファイルは変更しない。

## 実装時の注意事項

- 現在のHTTP statusとレスポンス形式を規約変更の根拠なく変更しない。
- 特定Controllerだけの一時的な実装を一般規約として記載しない。
- 「推奨」「必要に応じて」など遵守の要否が曖昧な表現を使用しない。
