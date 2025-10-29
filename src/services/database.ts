import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    ScanCommand,
    PutCommand,
    DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Event, EventOptions } from "../types.js";
import crypto from "node:crypto";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;
if (!TABLE_NAME) {
    throw new Error("Environment variable DYNAMODB_TABLE_NAME is not set. Please set it to the name of your DynamoDB table.");
}

/**
 * イベント一覧取得
 */
export const listEvents = async (): Promise<Event[]> => {
    const command = new ScanCommand({
        TableName: TABLE_NAME,
    });
    const response = await docClient.send(command);
    return (response.Items as Event[]) || [];
};

/**
 * イベント追加
 */
export const addEvent = async (options: EventOptions): Promise<Event> => {
    const newEvent: Event = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        ...options
    };
    const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: newEvent,
    });
    await docClient.send(command);
    return newEvent;
};

/**
 * イベント削除
 */
export const deleteEvent = async (id: string): Promise<boolean> => {
    const command = new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { id },
    });
    await docClient.send(command);
    return true;
};
