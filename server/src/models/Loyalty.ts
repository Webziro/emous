import mongoose, { Schema, Document } from 'mongoose';
import { LOYALTY_REWARD_NAIRA, LOYALTY_TARGET_DEVICES } from '../../../shared';

export interface IHostSession extends Document {
  sessionCode: string;
  hostDeviceId: string;
  hostHandle: string;
  hostHandleLower: string;
  groupName: string;
  uniqueDevices: string[];
  uniqueIpHashes: string[];
  cities: string[];
  eventTimestamps: Date[];
  targetDevices: number;
  rewardNaira: number;
  status: 'active' | 'qualified' | 'claimed' | 'paid' | 'rejected';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const HostSessionSchema = new Schema<IHostSession>(
  {
    sessionCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    hostDeviceId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    hostHandle: {
      type: String,
      required: true,
      trim: true,
    },
    hostHandleLower: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
      trim: true,
    },
    groupName: {
      type: String,
      default: 'WhatsApp Group Game',
      trim: true,
      maxlength: 80,
    },
    uniqueDevices: {
      type: [String],
      default: [],
    },
    uniqueIpHashes: {
      type: [String],
      default: [],
    },
    cities: {
      type: [String],
      default: [],
    },
    eventTimestamps: {
      type: [Date],
      default: [],
    },
    targetDevices: {
      type: Number,
      default: LOYALTY_TARGET_DEVICES,
    },
    rewardNaira: {
      type: Number,
      default: LOYALTY_REWARD_NAIRA,
    },
    status: {
      type: String,
      enum: ['active', 'qualified', 'claimed', 'paid', 'rejected'],
      default: 'active',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

export interface IRewardClaim extends Document {
  sessionCode: string;
  hostDeviceId: string;
  hostHandle: string;
  groupName: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  whatsappNumber: string;
  uniqueDeviceCount: number;
  uniqueIpCount: number;
  sessionMinutes: number;
  cities: string[];
  fraudRisk: 'low' | 'medium' | 'high';
  rewardNaira: number;
  status: 'pending' | 'paid' | 'rejected';
  paymentReference?: string;
  adminNote?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RewardClaimSchema = new Schema<IRewardClaim>(
  {
    sessionCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    hostDeviceId: {
      type: String,
      required: true,
      index: true,
    },
    hostHandle: {
      type: String,
      required: true,
      trim: true,
    },
    groupName: {
      type: String,
      default: 'WhatsApp Group',
      trim: true,
      maxlength: 80,
    },
    bankName: {
      type: String,
      required: true,
      trim: true,
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
    },
    accountName: {
      type: String,
      required: true,
      trim: true,
    },
    whatsappNumber: {
      type: String,
      required: true,
      trim: true,
    },
    uniqueDeviceCount: {
      type: Number,
      required: true,
    },
    uniqueIpCount: {
      type: Number,
      required: true,
    },
    sessionMinutes: {
      type: Number,
      default: 0,
    },
    cities: {
      type: [String],
      default: [],
    },
    fraudRisk: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
    },
    rewardNaira: {
      type: Number,
      default: LOYALTY_REWARD_NAIRA,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'rejected'],
      default: 'pending',
      index: true,
    },
    paymentReference: {
      type: String,
      trim: true,
    },
    adminNote: {
      type: String,
      trim: true,
    },
    paidAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export const HostSessionModel = mongoose.model<IHostSession>(
  'HostSession',
  HostSessionSchema
);

export const RewardClaimModel = mongoose.model<IRewardClaim>(
  'RewardClaim',
  RewardClaimSchema
);
