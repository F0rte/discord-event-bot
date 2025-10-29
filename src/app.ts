import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda"
import { verifyRequest, sendMessage, editMessage, editInteractionResponse } from "./services/discord.js"
import { addEvent, deleteEvent, listEvents, getConfig, saveConfig } from "./services/database.js";
import { InteractionResponseType } from "discord-interactions";
import type { EventOptions, Event } from "./types.js";

/**
 * Lambda handler
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
                            // 管理者用ダッシュボード作成
                            const adminMessage = await sendMessage(
                                adminChannelId, 
                                "🔧 管理者用イベント一覧を読み込み中...", 
                                4 // SUPPRESS_EMBEDS
                            );
                            await saveConfig('admin_dashboard_config', adminChannelId, adminMessage.id);
                            
                            // 全体用ダッシュボード作成
                            const publicMessage = await sendMessage(
                                publicChannelId, 
                                "📅 イベント一覧を読み込み中...", 
                                4 // SUPPRESS_EMBEDS
                            );
                            await saveConfig('public_dashboard_config', publicChannelId, publicMessage.id);
                            
                            // ダッシュボード更新
                            await updateDashboardMessage('admin_dashboard_config');
                            await updateDashboardMessage('public_dashboard_config');
                            
                            // インタラクション応答を更新
                            await editInteractionResponse(
                                body.token,
                                "✅ ダッシュボードのセットアップが完了しました！"
                            );
                        } catch (err) {
                            console.error("Setup error:", err);
                            await editInteractionResponse(
                                body.token,
                                "❌ セットアップ中にエラーが発生しました。"
                            );
                        }
                    })();
                    
                    // 即座に応答し、バックグラウンドで処理を継続
                    setImmediate(() => setupPromise);
                    
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
                            await updateDashboardMessage('admin_dashboard_config');
                            await updateDashboardMessage('public_dashboard_config');
                            
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
                    setImmediate(() => addPromise);
                    
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
                            await updateDashboardMessage('admin_dashboard_config');
                            await updateDashboardMessage('public_dashboard_config');
                            
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
                    setImmediate(() => deletePromise);
                    
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
 */
const generateEventListContent = async (isAdmin: boolean): Promise<string> => {
    const events = await listEvents();
    
    // 設定IDで始まるアイテムは除外（実際のイベントのみを表示）
    const actualEvents = events.filter(item => !item.id.endsWith('_dashboard_config'));
    
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
 */
const updateDashboardMessage = async (configId: string): Promise<void> => {
    const config = await getConfig(configId);
    if (!config) {
        console.log(`Configuration ${configId} not found, skipping update.`);
        return;
    }

    const isAdmin = configId === 'admin_dashboard_config';
    const content = await generateEventListContent(isAdmin);
    
    try {
        await editMessage(config.channelId, config.messageId, content);
    } catch (err) {
        console.error(`Failed to update dashboard ${configId}:`, err);
    }
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
