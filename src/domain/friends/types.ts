export type FriendshipStatus = "pending" | "accepted";

export interface Friendship {
  _id: string;
  fromPlayerId: string;
  toPlayerId: string;
  status: FriendshipStatus;
  createdAt: Date;
  acceptedAt?: Date;
}

export interface Block {
  _id: string;
  blockerId: string;
  blockedId: string;
  createdAt: Date;
}
