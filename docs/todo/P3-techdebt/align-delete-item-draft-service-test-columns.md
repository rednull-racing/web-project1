# deleteItemDraft共有serviceテストの取得カラム契約を照合する

発見日: 2026-10-22 / 優先度: P3-techdebt

## 問題と原因

`cd server && npm run test:run -- src/services/itemDraft/test/deleteItemDraft.test.ts` のS01/S02/S04相当2ケースが失敗する。
fixtureの`draftColumns`には`item_id`があるが、`getMyItemDraft`のattributesにはない。
Node.js 20.20.2と26.12.1の両方で同一の失敗が再現する。

## 対象・参照

- `server/src/services/itemDraft/query.ts`
- `server/src/services/itemDraft/test/deleteItemDraft.test.ts`
- `server/test/fixtures/itemDraft/deleteItemDraft/fixtures.ts`
- 現行ItemDraftモデル・対応テスト設計書・適用先AGENTS.md

## 修正方針・実装内容

現行モデルと削除処理の契約を照合して、正しい取得カラムを確定する。
fixtureの共有範囲を調べ、根拠に従い本番コードまたはfixtureを修正する。
対象テスト、関連回帰テスト、lint・型検査を実行する。

## 注意事項

Node.js更新作業では取得仕様やテスト期待値を変更せず、既存不一致として記録した。
