export const DISCORD_COMMANDS = [
    {
        name: "events",
        description: "イベント管理コマンド",
        type: 1, // CHAT_INPUT
        options: [
            {
                name: "add",
                description: "新しいイベントを追加",
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: "title",
                        description: "イベントのタイトル",
                        type: 3, // STRING
                        required: true
                    },
                    {
                        name: "datetime",
                        description: "イベントの日時 (例: 2025/10/29 14:30)",
                        type: 3, // STRING
                        required: true
                    },
                    {
                        name: "location",
                        description: "イベントの場所（または vcチャンネルリンク)",
                        type: 3, // STRING
                        required: false
                    },
                    {
                        name: "url",
                        description: "イベントのURL",
                        type: 3, // STRING
                        required: false
                    },
                    {
                        name: "message_link",
                        description: "メッセージリンク",
                        type: 3, // STRING
                        required: false
                    }
                ]
            },
            {
                name: "list",
                description: "イベント一覧を表示",
                type: 1 // SUB_COMMAND
            },
            {
                name: "delete",
                description: "イベントを削除",
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: "event_id",
                        description: "削除するイベントのID",
                        type: 3, // STRING
                        required: true
                    }
                ]
            },
            {
                name: "update",
                description: "既存のイベントを更新",
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: "event_id",
                        description: "更新するイベントのID",
                        type: 3, // STRING
                        required: true
                    },
                    {
                        name: "title",
                        description: "新しいタイトル（省略可）",
                        type: 3, // STRING
                        required: false
                    },
                    {
                        name: "datetime",
                        description: "新しい日時（省略可）",
                        type: 3, // STRING
                        required: false
                    },
                    {
                        name: "location",
                        description: "新しい場所（省略可）",
                        type: 3, // STRING
                        required: false
                    },
                    {
                        name: "url",
                        description: "新しいURL（省略可）",
                        type: 3, // STRING
                        required: false
                    },
                    {
                        name: "message_link",
                        description: "新しいメッセージリンク（省略可）",
                        type: 3, // STRING
                        required: false
                    }
                ]
            },
            {
                name: "setup",
                description: "イベント一覧ダッシュボードをセットアップ",
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: "admin_channel",
                        description: "管理者用ダッシュボードを設置するチャンネル",
                        type: 7, // CHANNEL
                        required: true
                    },
                    {
                        name: "public_channel",
                        description: "全体用ダッシュボードを設置するチャンネル",
                        type: 7, // CHANNEL
                        required: true
                    }
                ]
            }
        ]
    }
];
