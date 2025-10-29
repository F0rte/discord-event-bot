# Discord Event Bot (AWS Version)

Discordチャンネルにイベントを登録・一覧表示・削除するためのBotです。
AWS Lambda, Amazon API Gateway, Amazon DynamoDB を使用して構築されています。

## ✨ 機能

-   **/events list**: 登録されているイベントの一覧を表示します。
-   **/events add**: 新しいイベントを登録します。
-   **/events delete**: 既存のイベントを削除します。
-   **/events update**: (オプション) 既存のイベントを更新します。

### イベントデータ
-   **タイトル** (必須)
-   **日時** (必須)
-   **イベントURL** (任意)
-   **メッセージリンク** (任意)

## 🛠️ 使用技術 (AWS Stack)

-   **Runtime**: **AWS Lambda** (Node.js 20.x + TypeScript)
    -   Discordからのインタラクションを処理するバックエンドロジック。
-   **API Endpoint**: **Amazon API Gateway** (HTTP API)
    -   Discord Interactions Endpoint URLとして機能し、Lambdaをトリガーします。
-   **Database**: **Amazon DynamoDB**
    -   イベント情報を格納するNoSQLデータベース。
-   **Language**: **TypeScript** (ESM modules)
-   **Infrastructure as Code (IaC)**: **AWS CloudFormation (CFn)**
    -   Lambda, API Gateway, DynamoDBテーブルなどのAWSリソースをコードで定義・デプロイします。
-   **CI/CD**: **GitHub Actions**
    -   mainブランチへのマージ時に自動でAWSリソースをデプロイし、コマンドを登録します。

## 🚀 セットアップ

### 1. Discord アプリケーションの作成

1.  [Discord Developer Portal](https://discord.com/developers/applications) にアクセスし、新規アプリケーションを作成します。
2.  **Bot** タブで「Add Bot」をクリックし、Botユーザーを作成します。
3.  **"General Information"** ページで **"PUBLIC KEY"** を控えておきます。
4.  **OAuth2 > URL Generator** タブで、以下のスコープを選択します。
    -   `bot`
    -   `applications.commands`
5.  生成されたURLにアクセスし、Botをサーバーに招待します。

### 2. AWS の準備 (IaC)

このプロジェクトでは、AWS CloudFormation (CFn) を使用します。

1.  **AWS CLI** をインストールします。
2.  AWS認証情報（IAMユーザーの `AWS_ACCESS_KEY_ID` と `AWS_SECRET_ACCESS_KEY`）を設定します。
3.  `template.yaml` (CloudFormationテンプレート) に、以下のリソースを定義します。
    * `AWS::Lambda::Function`: Botのロジックを実行するLambda関数。
    * `AWS::ApiGatewayV2::Api`: Discordと通信するAPI Gateway。
    * `AWS::DynamoDB::Table`: イベントを保存するDynamoDBテーブル。
    * Lambda関数が必要とするIAMロール（DynamoDBへの読み書き権限など）。

### 3. ローカル開発環境

1.  **リポジトリのクローンとインストール**
    ```bash
    git clone [https://github.com/F0rte/discord-event-bot.git](https://github.com/F0rte/discord-event-bot.git)
    cd discord-event-bot
    npm install
    ```
    
    **主要な依存関係:**
    - `@aws-sdk/client-dynamodb`: DynamoDB操作
    - `@aws-sdk/lib-dynamodb`: DynamoDB Document Client
    - `discord-interactions`: Discord署名検証
    - `tsx`: TypeScript実行環境

2.  **環境変数の設定**
    * `template.yml` 内で、Lambda関数に渡す環境変数を定義します。
    * `DISCORD_PUBLIC_KEY`: Discord Bot の Public Key
    * `DYNAMODB_TABLE_NAME`: 作成するDynamoDBテーブル名
    
    **コマンド登録用の環境変数 (ローカル/.env):**
    * `DISCORD_BOT_TOKEN`: Discord Bot のトークン
    * `DISCORD_APPLICATION_ID`: Discord アプリケーションID

### 4. デプロイ

1.  **TypeScriptのビルド**
    ```bash
    npm run build
    ```

2.  **AWSへのデプロイ**
    * **CloudFormation の場合:**
        ```bash
        aws cloudformation package --template-file infrastructure/template.yml --s3-bucket <your-s3-bucket> --output-template-file packaged.yml
        aws cloudformation deploy --template-file packaged.yml --stack-name <your-stack-name> --capabilities CAPABILITY_IAM --parameter-overrides DiscordPublicKey=<your-discord-public-key>
        ```

3.  デプロイが完了すると、出力として **API Gateway のエンドポイントURL** が表示されます。このURLを控えておきます。

### 5. Discord Interaction Endpoint の設定

1.  Discord Developer Portal に戻ります。
2.  "General Information" にある **"INTERACTIONS ENDPOINT URL"** の欄に、ステップ4で取得したAPI GatewayのエンドポイントURLを貼り付け、「Save Changes」をクリックします。
    * （Lambda側でDiscordの署名検証を正しく実装していないと、この保存が失敗します）

### 6. Slash Command の登録

Lambdaのコードとは別に登録スクリプトを実行します。

1.  **.env ファイルの作成**
    ```bash
    DISCORD_BOT_TOKEN=your_bot_token_here
    DISCORD_APPLICATION_ID=your_application_id_here
    ```

2.  **コマンド登録の実行**
    ```bash
    npm run register-commands
    ```
    このスクリプトは、Discord API (`/applications/{application.id}/commands`) に対し、`DISCORD_BOT_TOKEN` を使ってコマンド定義を `PUT` します。

## 📂 ファイル構成
```
.
├── .github/
│   └── workflows/
│       ├── deploy.yml              # アプリケーションデプロイ
│       └── register-commands.yml   # スラッシュコマンド登録
│
├── src/                            # Lambda関数のソースコード
│   ├── constants/
│   │   └── commands.ts             # Discord slash command定義
│   ├── services/
│   │   ├── discord.ts              # Discord署名検証
│   │   ├── database.ts             # DynamoDBへのCRUD処理
│   │   └── registerCommands.ts     # コマンド登録用スクリプト
│   ├── app.ts                      # Lambdaエントリーポイント
│   └── types.ts                    # イベントの型定義
│
├── infrastructure/
│   └── template.yml                # CloudFormationリソース定義
├── dist-package.json               # Lambda用package.json
├── package.json
├── tsconfig.json
└── README.md
```


## 🔄 開発ワークフロー (CI/CD)

このリポジトリは GitHub Actions を使用して、2つのワークフローで自動化されています：

### 1. アプリケーションデプロイ (`deploy.yml`)
- `main` ブランチへのPRマージ時に実行
- TypeScriptビルド → CloudFormationパッケージ → AWS デプロイ

### 2. スラッシュコマンド登録 (`register-commands.yml`)
- コマンド関連ファイル変更時に実行
- トリガーファイル: `src/constants/commands.ts`, `src/services/registerCommands.ts`, `package.json`, etc.

### 必要なGitHub Secrets
- `AWS_ACCOUNT_ID`: AWSアカウントID
- `S3_ARTIFACT_BUCKET_NAME`: CloudFormationアーティファクト用S3バケット
- `DISCORD_PUBLIC_KEY`: Discord Bot Public Key
- `DISCORD_BOT_TOKEN`: Discord Bot Token
- `DISCORD_APPLICATION_ID`: Discord Application ID

### AWS認証
OIDC (OpenID Connect) を使用してAWSに認証します。事前に `github-actions-role` IAMロールの設定が必要です。

## 🤝 貢献 (Contribution)

コミットメッセージは以下の形式に従ってください。
`prefix: hoge fuga` 形式です。
