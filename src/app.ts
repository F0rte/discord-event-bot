import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda"
import { verifyRequest } from "./services/discord.js"
import { addEvent, deleteEvent, listEvents } from "./services/database.js";
import { InteractionResponseType } from "discord-interactions";
import { access } from "fs";
import type { EventOptions } from "./types.js";

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
        const subCommand = body.data.options[0].name;

        try {
            if (commandName === "events") {
                if (subCommand === "list") {
                    const events = await listEvents();
                    const content = 
                        events.length > 0 
                            ? events.map((e) => `**${e.title}** (${e.datetime})\nID: \`${e.id}\`\n${e.url || ""}}\n`).join("\n")
                            : "登録されているイベントはありません。"
                    return buildResponse({
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: { content },
                    });
                }

                if (subCommand === "add") {
                    const options = body.data.options[0].options.reduce((acc: any, opt: any) => {
                        acc[opt.name] = opt.value;
                        return acc;
                    },
                    {}
                ) as EventOptions;
                
                const newEvent = await addEvent(options);
                return buildResponse({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: `:white_check_mark: イベント **${newEvent.title}**を追加しました (ID: \`${newEvent.id}\`)`
                    },
                });
                }

                if (subCommand === "delete") {
                    const id = body.data.options[0].options[0].value;
                    await deleteEvent(id);
                    return buildResponse({
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: { content: `:ballot_box_with_check: イベントを削除しました (ID: \`${id}\`)`},
                    });
                }
            }
        } catch (err: any) {
            console.error(err);
            return buildResponse({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: ":warning: エラーが発生しました" },
            });
        }
    }

    return { statusCode: 404, body: "Not Found" };
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
