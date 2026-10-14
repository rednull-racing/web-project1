# AGENTS.md

## プロジェクト概要

動画投稿を必須とするECプラットフォームです。

現在はアパレルジャンルを中心に開発していますが、
将来的には複数ジャンルへの展開を予定しています。

## 技術スタック

### Frontend

- Next.js 16
- App Router
- React 19
- TypeScript
- CSS Modules
- SWR / SWRInfinite

### Backend

- Node.js
- Express
- TypeScript
- ESM
- Sequelize 6
- PostgreSQL

### Infrastructure

- Docker
- AWS EC2
- Amazon ECR
- Amazon S3
- NGINX
- GitHub Actions

## ディレクトリ構成

- `/client`
    - Next.jsフロントエンド
- `/client/src/app`
    - ページ・コンポーネント
- `/client/src/components`
    - 共通コンポーネント
- `/server`
    - Expressバックエンド
- `/server/src/models`
    - Sequelizeモデル
- `/server/src/routes`
    - APIルート
- `/server/src/middleware`
    - ミドルウェア（認証、レート制限、バリデーション）
- `/server/src/validators`
    - zodバリデーション
- `/server/src/usecase`
    - ユースケース層
- `/server/src/service`
    - DBアクセスや外部サービス処理
- `/server/migrations`
    - Sequelizeマイグレーション

## 基本方針

- フロントエンド、バックエンドともにTypeScriptを使用する
- CommonJSではなくESM形式で記述する
- 既存のディレクトリ構成と命名規則を優先する
- 新しいライブラリは、明示的に依頼された場合を除き追加しない
- 大規模な設計変更を独断で行わない
- 要件が不明確な場合は、推測で実装範囲を広げない
- 依頼された範囲以外のリファクタは行わない

## アーキテクチャ

バックエンドは以下の責務分離を基本とします。

- route
    - URLとHTTPメソッドを定義する、RequestとResponseを扱う
- middleware
    - 認証やレート制限、バリデーション
- usecase
    - 業務ロジックを扱う
- service
    - DBアクセスや外部サービスとの通信を扱う
- model
    - Sequelizeモデルを定義する

controllerやrouteに業務ロジックを直接書かないでください。

## Sequelizeモデル

- モデルはTypeScriptで記述する
- モデルファイルはESM形式にする
- 外部キー、allowNull、defaultValue、uniqueなど既存モデルの制約を尊重する
- リレーション変更時は、関連するassociate定義も確認する
- モデル変更だけでDBへ反映されたものとみなさない
- 本番環境ではsequelize.sync()を使用しない
- db反映まではモデル定義を唯一の正とし、反映後はdbを唯一の正とする

## マイグレーション

- マイグレーションは `/server/migrations` に作成する
- ESM形式で記述する
- `up` と `down` の両方を必ず実装する
- モデルに記述された以下の制約を反映する
    - allowNull
    - defaultValue
    - unique
    - references
    - onUpdate
    - onDelete
- マイグレーションは実行しない
- 既存のマイグレーションを参考に命名や記述形式を揃える
- 明示的な依頼がない限り、既存マイグレーションを変更しない

## データベース設計

- テーブル名とカラム名はsnake_caseを使用する
- TypeScriptのプロパティ名も、既存モデルに合わせてsnake_caseを使用する
- 外部キー削除時の挙動は既存設計を確認する
- 所有権チェックが必要なデータは、user_id等による照合を行う
- statusのwhere条件を必要とするデータについては取得条件を確認する

## コーディング規約

- 既存コードの書き方を優先する
- `any` は可能な限り使用しない
- 型アサーションは必要最小限にする
- 不要なコメントを大量に追加しない
- コメントは処理内容ではなく、設計理由や注意点を説明するために使用する
- import文の拡張子は既存コードに合わせる
- エラーには既存の `AppError` を使用する
- console.logなどのデバッグコードを残さない

## フロントエンド

- Next.js App Routerの構成を維持する
- Server ComponentとClient Componentの境界を意識する
- Client Componentが必要な場合のみ `"use client"` を使用する
- データ取得は既存のSWRまたはSWRInfiniteのパターンを参考にする
- API通信は既存の共通fetch関数を優先する
- 既存のCSS Modulesの命名と構成を維持する

## セキュリティ

- 認証・認可処理を省略しない
- URLパラメータのIDだけで所有権を判断しない
- パスワードやトークンをログへ出力しない
- シークレットや環境変数の値をコードへ直接記述しない
- SQLインジェクションやXSSにつながる実装を避ける

## テスト・確認

変更後は、変更範囲に応じて以下を確認してください。

### Backend

```bash
cd server
npm run lint
npm run typecheck
```

# スコープ管理

現在依頼されているタスクの範囲外は変更しない。

作業中にバグ・改善点・リファクタ候補を見つけた場合も、
勝手に修正してはいけない。

代わりに `/docs/todo` の運用ルールに従い、
適切なTodoを作成すること。

---

## 追記　Codexログ

codexによる作業後、作業内容について簡単に10行以内で報告する。

### 報告先

docs/log_memo/codex_log.md

### 書き方

```markdown
### タイトル

～～（内容）～～
```

### タイトルのつけ方

日付_タグ_作業内容

- 例：20261014_backend-coding_createItemEditingCopy実装

タグ例：

- frontend-components
- frontend-page
- frontend-css
- frontend-apiFetch
- frontend-architecture
- backend-architecture
- backend-coding
- backend-test
- backend-model
- backend-migration
- documents

### 報告内容例

- 作業内容
- 変更目的
- 注意点等

（各項目2~3行程度で箇条書きにするとよい）
