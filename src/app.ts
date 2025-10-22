import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda"
import { verifyRequest } from "./services/discord.js"

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
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: 1 }),
        };
    }

    // Requestへの応答
    // fixme: MVP実装
    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            type: 4,
            data: {
                content: "test",
            },
        }),
    };
};
