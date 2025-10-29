/**
 * エラーメッセージ生成のユーティリティ関数
 */

export type ErrorContext = 'setup' | 'add' | 'delete';

/**
 * エラーの種類とコンテキストに基づいて詳細なエラーメッセージを生成する
 * 
 * @param err - 発生したエラーオブジェクト
 * @param context - エラー発生のコンテキスト（'setup', 'add', 'delete'）
 * @returns ユーザー向けの詳細なエラーメッセージ
 */
export const getDetailedErrorMessage = (err: unknown, context: ErrorContext): string => {
    // デフォルトエラーメッセージ
    const defaultMessages = {
        setup: "❌ セットアップ中にエラーが発生しました。",
        add: "❌ イベント追加中にエラーが発生しました。",
        delete: "❌ イベント削除中にエラーが発生しました。"
    };

    if (!(err instanceof Error)) {
        return defaultMessages[context];
    }

    const errorMessage = err.message.toLowerCase();

    // チャンネル/メッセージ関連エラー
    if (errorMessage.includes('channels') || errorMessage.includes('sendmessage')) {
        if (context === 'setup') {
            return "❌ ダッシュボードメッセージの作成に失敗しました。チャンネルの権限を確認してください。";
        }
        return "❌ メッセージの送信に失敗しました。チャンネルの権限を確認してください。";
    }

    // ダッシュボード更新関連エラー
    if (errorMessage.includes('dashboard') || errorMessage.includes('edit')) {
        return "❌ ダッシュボードの更新に失敗しました。";
    }

    // データベース関連エラー
    if (errorMessage.includes('dynamodb') || errorMessage.includes('saveconfig')) {
        if (context === 'setup') {
            return "❌ 設定の保存に失敗しました。データベース接続を確認してください。";
        } else if (context === 'add') {
            return "❌ イベントの保存に失敗しました。";
        } else if (context === 'delete') {
            return "❌ イベントの削除に失敗しました。";
        }
    }

    // 認証関連エラー
    if (errorMessage.includes('token') || errorMessage.includes('ssm')) {
        return "❌ Bot認証に失敗しました。設定を確認してください。";
    }

    // その他のエラー
    return defaultMessages[context];
};