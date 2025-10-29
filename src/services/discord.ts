import { verifyKey } from "discord-interactions"
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm"

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || "";
const SSM_PARAMETER_NAME_BOT_TOKEN = process.env.SSM_PARAMETER_NAME_BOT_TOKEN || "/discord-event-bot/DISCORD_BOT_TOKEN";

let cachedBotToken: string | null = null;
const ssmClient = new SSMClient({});

/**
 * SSMからBot Tokenを取得してキャッシュする
 */
export const getBotToken = async (): Promise<string> => {
    if (cachedBotToken) {
        return cachedBotToken;
    }

    try {
        const command = new GetParameterCommand({
            Name: SSM_PARAMETER_NAME_BOT_TOKEN,
            WithDecryption: true,
        });
        const response = await ssmClient.send(command);
        
        if (!response.Parameter?.Value) {
            throw new Error("Bot token not found in SSM Parameter Store");
        }
        
        cachedBotToken = response.Parameter.Value;
        return cachedBotToken;
    } catch (err) {
        console.error("Failed to get bot token from SSM:", err);
        throw err;
    }
};

/**
 * Discordにメッセージを送信
 */
export const sendMessage = async (
    channelId: string, 
    content: string, 
    flags?: number
): Promise<{ id: string }> => {
    const botToken = await getBotToken();
    
    const payload: { content: string; flags?: number } = { content };
    if (flags !== undefined) {
        payload.flags = flags;
    }
    
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bot ${botToken}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to send message: ${response.status} ${error}`);
    }

    return await response.json();
};

/**
 * Discordのメッセージを編集
 */
export const editMessage = async (
    channelId: string, 
    messageId: string, 
    content: string
): Promise<void> => {
    const botToken = await getBotToken();
    
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bot ${botToken}`,
        },
        body: JSON.stringify({ content }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to edit message: ${response.status} ${error}`);
    }
};

/**
 * インタラクションの応答を編集
 */
export const editInteractionResponse = async (
    interactionToken: string,
    content: string
): Promise<void> => {
    if (!process.env.DISCORD_APPLICATION_ID) {
        throw new Error("DISCORD_APPLICATION_ID is not set.");
    }
    
    const botToken = await getBotToken();
    
    const response = await fetch(`https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${interactionToken}/messages/@original`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bot ${botToken}`,
        },
        body: JSON.stringify({ content }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to edit interaction response: ${response.status} ${error}`);
    }
};

/**
 * Discordリクエストの署名検証
 * @param rawBody - Discordから受信したbody文字列
 * @param signature - Discordのx-signature-ed25519ヘッダー値
 * @param timestamp - Discordのx-signature-timestampヘッダー値
 * @returns 検証結果
 */
export const verifyRequest = async (
    rawBody: string,
    signature: string,
    timestamp: string,
): Promise<boolean> => {
    if (!PUBLIC_KEY) {
        console.error("DISCORD_PUBLIC_KEY is not set.");
        return false;
    }

    try {
        return await verifyKey(rawBody, signature, timestamp, PUBLIC_KEY);
    } catch (err) {
        console.error("Signature verification failed:", err);
        return false;
    }
};
