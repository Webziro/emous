import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  deviceId: string;
  handle: string;
  handleLower: string;
  handleHistory: string[];
  handleHistoryLower: string[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    handle: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    handleLower: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    handleHistory: {
      type: [String],
      default: [],
    },
    handleHistoryLower: {
      type: [String],
      index: true,
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const UserModel = mongoose.model<IUser>('User', UserSchema);
