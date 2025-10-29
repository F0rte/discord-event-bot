import { fetch } from "undici"
import "dotenv/config"
import { DISCORD_COMMANDS } from "../constants/commands.js"

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;

if (!TOKEN || !APPLICATION_ID) {
    throw new Error(
        "DISCORD_BOT_TOKEN or DISCORD_APPLICATION_ID is not set"
    )
}

const url = `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`;

const registerCommands = async () => {
    try {
        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bot ${TOKEN}`,
            },
            body: JSON.stringify(DISCORD_COMMANDS),
        });

            if (response.ok) {
                console.log("registered Slash Commands successfully")
                const data = await response.json();
                console.log(JSON.stringify(data, null, 2));
            } else {
                console.error("failed to register commands:", await response.text());
            }
    } catch (error) {
        console.error("error:", error);
    }
};

registerCommands()
