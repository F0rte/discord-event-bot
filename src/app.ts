import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda"
import { verifyRequest, sendMessage, editMessage, editInteractionResponse } from "./services/discord.js"
import { addEvent, deleteEvent, listEvents, getConfig, saveConfig } from "./services/database.js";
import { InteractionResponseType } from "discord-interactions";
import type { EventOptions, Event } from "./types.js";

// 定数定義
const DASHBOARD_CONFIG_SUFFIX = '_dashboard_config';
const ADMIN_DASHBOARD_CONFIG = 'admin_dashboard_config';
const PUBLIC_DASHBOARD_CONFIG = 'public_dashboard_config';

/**
 * Lambda handler
 * Discord Interactionを受信し、適切なコマンドハンドラーにルーティングする
 * 
 * サポートするコマンド:
 * - /events list: イベント一覧を表示
 * - /events setup: ダッシュボードをセットアップ
 * - /events add: イベントを追加し、ダッシュボードを更新
 * - /events delete: イベントを削除し、ダッシュボードを更新
 */
export const handler = async (
    event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
    // Header, Body取得
    const signature = event.headers["x-signature-ed25519"] || "";
    const timestamp = event.headers["x-signature-timestamp"] || "";
    const rawBody = event.body || "";

    // 署名検証
    const isValid = await verifyRequest(rawBody, signature, timestamp);
    if (!isValid) {
        return {
            statusCode: 401,
            body: "Invalid signature",
        };
    }

    // Bodyの形式チェック
    let body;
    try {
        body = JSON.parse(rawBody);
    } catch (err) {
        console.error("Bad Request:", err)
        return {
            statusCode: 400,
            body: "Bad Request"
        }
    }

    // PINGへの応答 (type = 1)
    if (body.type === 1) {
        return buildResponse({
            type: InteractionResponseType.PONG
        })
    }

    // Slash Commandへの応答 (type = 2)
    if (body.type === 2) {
        const commandName = body.data.name;
        
        // Guard check for options array
        if (!Array.isArray(body.data.options) || body.data.options.length === 0) {
            return buildResponse({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: ":warning: コマンドのオプションが不足しています。" },
            });
        }
        
        const subCommand = body.data.options[0].name;

        try {
            if (commandName === "events") {
                if (subCommand === "list") {
                    const content = await generateEventListContent(true); // 管理者として表示
                    return buildResponse({
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: { content },
                    });
                }

                if (subCommand === "setup") {
                    const options = body.data.options[0].options.reduce((acc: Record<string, any>, opt: { name: string; value: any }) => {
                        acc[opt.name] = opt.value;
                        return acc;
                    }, {});
                    
                    const adminChannelId = options.admin_channel;
                    const publicChannelId = options.public_channel;
                    
                    // 一時応答
                    const setupPromise = (async () => {
                        try {
                            await createDashboardMessagesAndSaveConfig(adminChannelId, publicChannelId);
                            
                            // インタラクション応答を更新
                            await editInteractionResponse(
                                body.token,
                                "✅ ダッシュボードのセットアップが完了しました！"
                            );
                        } catch (err) {
                            console.error("Setup error:", err);
                            let errorMessage = "❌ セットアップ中にエラーが発生しました。";
                            
                            // より具体的なエラーメッセージを提供
                            if (err instanceof Error) {
                                if (err.message.includes('sendMessage') || err.message.includes('channels')) {
                                    errorMessage = "❌ ダッシュボードメッセージの作成に失敗しました。チャンネルの権限を確認してください。";
                                } else if (err.message.includes('saveConfig') || err.message.includes('DynamoDB')) {
                                    errorMessage = "❌ 設定の保存に失敗しました。";
                                }
                            }
                            
                            await editInteractionResponse(body.token, errorMessage);
                        }
                    })();
                    
                    // 即座に応答し、バックグラウンドで処理を継続
                    setImmediate(() => { setupPromise.catch(console.error); });
                    
                    return buildResponse({
                        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
                    });
                }

                if (subCommand === "add") {
                    const options = body.data.options[0].options.reduce((acc: Record<string, any>, opt: { name: string; value: any }) => {
                        acc[opt.name] = opt.value;
                        return acc;
                    }, {}) as EventOptions;
                
                    // 一時応答
                    const addPromise = (async () => {
                        try {
                            const newEvent = await addEvent(options);
                            
                            // ダッシュボード更新
                            await updateDashboardMessage(ADMIN_DASHBOARD_CONFIG);
                            await updateDashboardMessage(PUBLIC_DASHBOARD_CONFIG);
                            
                            // インタラクション応答を更新
                            await editInteractionResponse(
                                body.token,
                                `✅ イベント **${newEvent.title}**を追加し、ダッシュボードを更新しました (ID: \`${newEvent.id}\`)`
                            );
                        } catch (err) {
                            console.error("Add event error:", err);
                            await editInteractionResponse(
                                body.token,
                                "❌ イベント追加中にエラーが発生しました。"
                            );
                        }
                    })();
                    
                    // 即座に応答し、バックグラウンドで処理を継続
                    setImmediate(() => { addPromise.catch(console.error); });
                    
                    return buildResponse({
                        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
                    });
                }

                if (subCommand === "delete") {
                    // Guard checks for nested options
                    const optionsArr = Array.isArray(body.data.options) ? body.data.options : [];
                    const subOptionsArr = optionsArr.length > 0 && Array.isArray(optionsArr[0].options) ? optionsArr[0].options : [];
                    if (subOptionsArr.length === 0 || typeof subOptionsArr[0].value === "undefined") {
                        return buildResponse({
                            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                            data: { content: ":warning: 削除するイベントIDが指定されていません。" },
                        });
                    }
                    const id = subOptionsArr[0].value;
                    
                    // 一時応答
                    const deletePromise = (async () => {
                        try {
                            await deleteEvent(id);
                            
                            // ダッシュボード更新
                            await updateDashboardMessage(ADMIN_DASHBOARD_CONFIG);
                            await updateDashboardMessage(PUBLIC_DASHBOARD_CONFIG);
                            
                            // インタラクション応答を更新
                            await editInteractionResponse(
                                body.token,
                                `✅ イベントを削除し、ダッシュボードを更新しました (ID: \`${id}\`)`
                            );
                        } catch (err) {
                            console.error("Delete event error:", err);
                            await editInteractionResponse(
                                body.token,
                                "❌ イベント削除中にエラーが発生しました。"
                            );
                        }
                    })();
                    
                    // 即座に応答し、バックグラウンドで処理を継続
                    setImmediate(() => { deletePromise.catch(console.error); });
                    
                    return buildResponse({
                        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
                    });
                }
            }
        } catch (err: unknown) {
            if (err instanceof Error) {
                console.error(err.message, err.stack);
            } else {
                console.error("Unknown error:", err);
            }
            return buildResponse({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: ":warning: エラーが発生しました" },
            });
        }
    }

    return { statusCode: 404, body: "Not Found" };
};

/**
 * イベント一覧をフォーマットして返す共通関数
 * 
 * @param isAdmin - 管理者表示かどうか（trueの場合はイベントIDも表示）
 * @returns フォーマット済みのイベント一覧文字列
 */
const generateEventListContent = async (isAdmin: boolean): Promise<string> => {
    const events = await listEvents();
    
    // 設定IDで始まるアイテムは除外（実際のイベントのみを表示）
    const actualEvents = events.filter(item => !item.id.endsWith(DASHBOARD_CONFIG_SUFFIX));
    
    if (actualEvents.length === 0) {
        return ":information_source: 登録されているイベントはありません。";
    }

    // 日時順でソート
    actualEvents.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

    let content = isAdmin 
        ? "**🔧 管理者用イベント一覧**\n\n" 
        : "**📅 イベント一覧**\n\n";

    content += actualEvents.map((event) => {
        let eventText = `**${event.title}** (${event.datetime})`;
        if (isAdmin) {
            eventText += `\nID: \`${event.id}\``;
        }
        if (event.url) {
            eventText += `\n${event.url}`;
        }
        if (event.message_link) {
            eventText += `\n${event.message_link}`;
        }
        return eventText;
    }).join("\n\n");

    return content;
};

/**
 * 指定されたダッシュボードメッセージを更新する共通関数
 * 
 * @param configId - 設定ID（ADMIN_DASHBOARD_CONFIG または PUBLIC_DASHBOARD_CONFIG）
 */
const updateDashboardMessage = async (configId: string): Promise<void> => {
    const config = await getConfig(configId);
    if (!config) {
        console.log(`Configuration ${configId} not found, skipping update.`);
        return;
    }

    const isAdmin = configId === ADMIN_DASHBOARD_CONFIG;
    const content = await generateEventListContent(isAdmin);
    
    try {
        await editMessage(config.channelId, config.messageId, content);
    } catch (err) {
        console.error(`Failed to update dashboard ${configId}:`, err);
    }
};

/**
 * ダッシュボードメッセージを作成して設定を保存するヘルパー関数
 * 管理者用と全体用の両方のダッシュボードを作成し、初期コンテンツで更新する
 * 
 * @param adminChannelId - 管理者用ダッシュボードを作成するチャンネルID
 * @param publicChannelId - 全体用ダッシュボードを作成するチャンネルID
 */
const createDashboardMessagesAndSaveConfig = async (
    adminChannelId: string,
    publicChannelId: string
): Promise<void> => {
    // 管理者用ダッシュボード作成
    const adminMessage = await sendMessage(
        adminChannelId, 
        "🔧 管理者用イベント一覧を読み込み中...", 
        4 // SUPPRESS_EMBEDS
    );
    await saveConfig(ADMIN_DASHBOARD_CONFIG, adminChannelId, adminMessage.id);
    
    // 全体用ダッシュボード作成
    const publicMessage = await sendMessage(
        publicChannelId, 
        "📅 イベント一覧を読み込み中...", 
        4 // SUPPRESS_EMBEDS
    );
    await saveConfig(PUBLIC_DASHBOARD_CONFIG, publicChannelId, publicMessage.id);
    
    // ダッシュボード更新
    await updateDashboardMessage(ADMIN_DASHBOARD_CONFIG);
    await updateDashboardMessage(PUBLIC_DASHBOARD_CONFIG);
};

/**
 * Response構築のヘルパー
 */
const buildResponse = (body: object): APIGatewayProxyResultV2 => {
    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    };
};
