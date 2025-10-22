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

-   **Runtime**: **AWS Lambda** (Node.js + TypeScript)
    -   Discordからのインタラクションを処理するバックエンドロジック。
-   **API Endpoint**: **Amazon API Gateway** (HTTP API)
    -   Discord Interactions Endpoint URLとして機能し、Lambdaをトリガーします。
-   **Database**: **Amazon DynamoDB**
    -   イベント情報を格納するNoSQLデータベース。
-   **Language**: **TypeScript**
-   **Infrastructure as Code (IaC)**: **AWS CloudFormation (CFn)**
    -   Lambda, API Gateway, DynamoDBテーブルなどのAWSリソースをコードで定義・デプロイします。
-   **CI/CD**: **GitHub Actions**
    -   mainブランチへのマージ時に自動でAWSリソースをデプロイします。

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
    (必要なライブラリ例: `aws-sdk`, `discord-verify`, `axios`)

2.  **環境変数の設定**
    * `template.yaml` 内で、Lambda関数に渡す環境変数を定義します。
    * `DISCORD_PUBLIC_KEY`: (Discord Bot の Public Key)
    * `DYNAMODB_TABLE_NAME`: (作成するDynamoDBテーブル名)

### 4. デプロイ

1.  **TypeScriptのビルド**
    ```bash
    npm run build
    ```

2.  **AWSへのデプロイ**
    * **CloudFormation の場合:**
        ```bash
        aws cloudformation package --template-file template.yaml --s3-bucket <your-s3-bucket> --output-template-file packaged-template.yaml
        aws cloudformation deploy --template-file packaged-template.yaml --stack-name <your-stack-name> --capabilities CAPABILITY_IAM
        ```

3.  デプロイが完了すると、出力として **API Gateway のエンドポイントURL** が表示されます。このURLを控えておきます。

### 5. Discord Interaction Endpoint の設定

1.  Discord Developer Portal に戻ります。
2.  "General Information" にある **"INTERACTIONS ENDPOINT URL"** の欄に、ステップ4で取得したAPI GatewayのエンドポイントURLを貼り付け、「Save Changes」をクリックします。
    * （Lambda側でDiscordの署名検証を正しく実装していないと、この保存が失敗します）

### 6. Slash Command の登録

GASの時とは異なり、Lambdaのコードとは別に登録スクリプトを実行します。

1.  `npm script` (例: `npm run register-commands`) を用意します。
2.  このスクリプトは、Discord API (`/applications/{application.id}/commands`) に対し、`DISCORD_BOT_TOKEN` を使ってコマンド定義 (JSON) を `PUT` します。
3.  ローカルから一度だけ実行します。

## 📂 ファイル構成 (例: CloudFormation)
.
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions (CI/CD)
│
├── src/                    # Lambda関数のソースコード
│   ├── handlers/           # コマンド別ロジック
│   │   ├── add.ts
│   │   ├── list.ts
│   │   └── delete.ts
│   ├── services/
│   │   ├── discord.ts      # Discord署名検証・APIリクエスト
│   │   └── database.ts     # DynamoDBへのCRUD処理
│   ├── app.ts              # Lambdaエントリーポイント (eventを捌く)
│   └── types.ts            # イベントの型定義など
│
├── scripts/
│   └── registerCommands.ts # コマンド登録用スクリプト
│
├── infrastructure/
│   └── template.yaml       # CloudFormationリソース定義（インフラ管理用）
├── package.json
├── tsconfig.json
└── README.md


## 🔄 開発ワークフロー (CI/CD)

このリポジトリは GitHub Actions を使用して、`main` ブランチにマージされると自動的に `aws cloudformation deploy` が実行されるように設定されています。

-   GitHub Secrets に `AWS_ACCESS_KEY_ID` と `AWS_SECRET_ACCESS_KEY` を設定する必要があります。

## 🤝 貢献 (Contribution)

コミットメッセージは以下の形式に従ってください。
`prefix: hoge fuga` 形式です。
