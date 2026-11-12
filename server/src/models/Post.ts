import mongoose, { Schema, Document } from 'mongoose';
import { CardBackground } from '../../../shared';

export interface IPost extends Document {
  authorDeviceId: string;
  authorHandle: string;
  content: string;
  tag: string;
  tagLower: string;
  background: CardBackground;
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
    label?: string;
  };
  flagsCount: number;
  flaggedBy: string[];
  isHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    authorDeviceId: {
      type: String,
      required: true,
      index: true,
    },
    authorHandle: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 300,
      trim: true,
    },
    tag: {
      type: String,
      required: true,
      default: '#Confessions',
      trim: true,
    },
    tagLower: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    background: {
      id: { type: String, required: true },
      type: { type: String, enum: ['gradient', 'image'], required: true },
      name: { type: String, required: true },
      value: { type: String, required: true },
      colors: { type: [String], required: true },
      textColor: { type: String, enum: ['#FFFFFF', '#0D0D11'], default: '#FFFFFF' },
      badgeBg: { type: String, default: '#CCFF00' },
      badgeText: { type: String, default: '#0D0D11' },
      attribution: { type: String },
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
      label: {
        type: String,
      },
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

// Geospatial 2dsphere index for MongoDB $near 5-mile radius queries
PostSchema.index({ location: '2dsphere' });
PostSchema.index({ isHidden: 1, createdAt: -1 });

export const PostModel = mongoose.model<IPost>('Post', PostSchema);
