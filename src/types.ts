export interface EventOptions {
    title: string;
    datetime: string;
    url?: string;
    message_link?: string;
}

export interface Event extends EventOptions {
    id: string;
    createdAt: string;
}
