export interface ICobreLinkAPIResponse {
  linkUrl: string;
  cashInNoveltyUuid: string;
  cashInNoveltyDetailUuid: string;
  notificationMethodsResult: NotificationMethodsResult;
}

export interface NotificationMethodsResult {
  ONLINE: string | null;
  EMAIL: string | null;
  WHATSAPP: string | null;
}
