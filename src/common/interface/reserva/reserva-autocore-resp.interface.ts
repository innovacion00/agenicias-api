export interface IreservaAutocoreResp {
  msg: string;
  chatbot_id: string;
  no_available_rooms?: NoAvailableRoom[];
}
export interface NoAvailableRoom {
  room: string;
  product: string;
}
