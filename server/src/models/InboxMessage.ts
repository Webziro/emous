import mongoose, { Schema, Document } from 'mongoose';
import { BRAND } from '../../../shared';

export interface IInboxMessage extends Document {
  recipientHandle: string;
  recipientHandleLower: string;
  senderDeviceId?: string;
  question: string;
  reply?: string;
  repliedAt?: Date;
  themeId: string;
  isRead: boolean;
  flagsCount: number;
  flaggedBy: string[];
  isHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InboxMessageSchema = new Schema<IInboxMessage>(
  {
    recipientHandle: {
      type: String,
      required: true,
      trim: true,
    },
    recipientHandleLower: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
      trim: true,
    },
    senderDeviceId: {
      type: String,
      select: false, // Never returned in public/recipient queries to preserve strict sender anonymity
    },
    question: {
      type: String,
      required: true,
      maxlength: 300,
      trim: true,
    },
    reply: {
      type: String,
      maxlength: 300,
      trim: true,
    },
    repliedAt: {
      type: Date,
    },
    themeId: {
      type: String,
      default: 'story-pink-lime',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    flagsCount: {
      type: Number,
      default: 0,
    },
    flaggedBy: {
      type: [String],
      default: [],
    },
    isHidden: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-Burn: MongoDB TTL index automatically deletes inbox messages after 30 days (2,592,000 seconds)
InboxMessageSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: BRAND.inboxBurnSeconds }
);

InboxMessageSchema.index({ recipientHandleLower: 1, isHidden: 1, createdAt: -1 });

export const InboxMessageModel = mongoose.model<IInboxMessage>(
  'InboxMessage',
  InboxMessageSchema
);
