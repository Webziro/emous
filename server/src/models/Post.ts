import mongoose, { Schema, Document } from 'mongoose';
import { CardBackground } from '../../../shared';

export interface IPostComment {
  _id: string;
  authorHandle: string;
  authorDeviceId?: string;
  text: string;
  isOp?: boolean;
  createdAt: Date;
}

export interface IPost extends Document {
  authorDeviceId: string;
  authorHandle: string;
  content: string;
  tag: string;
  tagLower: string;
  categories: string[];
  keywords: string[];
  background: CardBackground;
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
    label?: string;
  };
  reactions: {
    fire: number;
    skull: number;
    eyes: number;
    heart: number;
  };
  reactedBy: {
    fire: string[];
    skull: string[];
    eyes: string[];
    heart: string[];
  };
  comments: IPostComment[];
  poll?: {
    optionA: { text: string; votes: number; votedBy: string[] };
    optionB: { text: string; votes: number; votedBy: string[] };
  };
  qaCard?: {
    question: string;
    reply: string;
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
    categories: {
      type: [String],
      default: [],
      index: true,
    },
    keywords: {
      type: [String],
      default: [],
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
    reactions: {
      fire: { type: Number, default: 0 },
      skull: { type: Number, default: 0 },
      eyes: { type: Number, default: 0 },
      heart: { type: Number, default: 0 },
    },
    reactedBy: {
      fire: { type: [String], default: [] },
      skull: { type: [String], default: [] },
      eyes: { type: [String], default: [] },
      heart: { type: [String], default: [] },
    },
    comments: {
      type: [
        {
          _id: { type: String, required: true },
          authorHandle: { type: String, required: true },
          authorDeviceId: { type: String },
          text: { type: String, required: true, maxlength: 180 },
          isOp: { type: Boolean, default: false },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    poll: {
      optionA: {
        text: { type: String },
        votes: { type: Number, default: 0 },
        votedBy: { type: [String], default: [] },
      },
      optionB: {
        text: { type: String },
        votes: { type: Number, default: 0 },
        votedBy: { type: [String], default: [] },
      },
    },
    qaCard: {
      question: { type: String },
      reply: { type: String },
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
