import mongoose, { Schema, Document } from 'mongoose';

export type AnalyticsEventType =
  | 'page_view'
  | 'receiver_open'
  | 'post_create'
  | 'inbox_send'
  | 'comment_add'
  | 'share_click';

export interface IAnalyticsEvent extends Document {
  deviceId: string;
  eventType: AnalyticsEventType;
  route: string;
  handle?: string;
  sessionCode?: string;
  country: string;
  region: string;
  city: string;
  ipHash: string;
  dateKey: string; // YYYY-MM-DD (WAT / UTC+1 or UTC)
  hourOfDay: number; // 0..23
  source: string; // whatsapp | twitter | instagram | direct
  createdAt: Date;
}

const AnalyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    deviceId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    eventType: {
      type: String,
      enum: [
        'page_view',
        'receiver_open',
        'post_create',
        'inbox_send',
        'comment_add',
        'share_click',
      ],
      default: 'page_view',
      index: true,
    },
    route: {
      type: String,
      default: '/',
      trim: true,
    },
    handle: {
      type: String,
      trim: true,
    },
    sessionCode: {
      type: String,
      trim: true,
      index: true,
    },
    country: {
      type: String,
      default: 'NG',
      index: true,
    },
    region: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      default: 'Unknown',
      index: true,
    },
    ipHash: {
      type: String,
      default: 'unknown',
      index: true,
    },
    dateKey: {
      type: String,
      required: true,
      index: true,
    },
    hourOfDay: {
      type: Number,
      required: true,
      min: 0,
      max: 23,
      index: true,
    },
    source: {
      type: String,
      default: 'direct',
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

AnalyticsEventSchema.index({ dateKey: -1, deviceId: 1 });
AnalyticsEventSchema.index({ createdAt: -1 });

export const AnalyticsEventModel = mongoose.model<IAnalyticsEvent>(
  'AnalyticsEvent',
  AnalyticsEventSchema
);
