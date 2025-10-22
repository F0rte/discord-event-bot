import { verifyKey } from "discord-interactions"

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || "";

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
