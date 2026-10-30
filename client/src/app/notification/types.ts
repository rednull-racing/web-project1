export type Notification = {
    id: string;
    message: string;
    message_image: string;
    read_flag: boolean;
    url: string;
    createdAt: Date;
};

export type NotificationResponse = {
    notificationList: Notification[];
    unreadCount: number;
    nextCursor: string | null;
    hasMore: boolean;
};
