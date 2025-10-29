import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    ScanCommand,
    PutCommand,
    DeleteCommand,
    GetCommand,
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

/**
 * 特定のイベントを取得
 */
export const getEvent = async (id: string): Promise<Event | null> => {
    const command = new GetCommand({
        TableName: TABLE_NAME,
        Key: { id },
    });
    const response = await docClient.send(command);
    return (response.Item as Event) || null;
};

/**
 * イベント更新
 */
export const updateEvent = async (id: string, updates: Partial<EventOptions>): Promise<Event | null> => {
    const existingEvent = await getEvent(id);
    if (!existingEvent) {
        return null;
    }
    
    const updatedEvent: Event = {
        ...existingEvent,
        ...updates
    };
    
    const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: updatedEvent,
    });
    await docClient.send(command);
    return updatedEvent;
};

/**
 * 設定を取得
 */
export const getConfig = async (configId: string): Promise<{ channelId: string; messageId: string } | null> => {
    const command = new GetCommand({
        TableName: TABLE_NAME,
        Key: { id: configId },
    });
    const response = await docClient.send(command);
    
    if (!response.Item) {
        return null;
    }
    
    return {
        channelId: response.Item.channelId,
        messageId: response.Item.messageId,
    };
};

/**
 * 設定を保存
 */
export const saveConfig = async (configId: string, channelId: string, messageId: string): Promise<void> => {
    const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: {
            id: configId,
            channelId,
            messageId,
            createdAt: new Date().toISOString(),
        },
    });
    await docClient.send(command);
};
