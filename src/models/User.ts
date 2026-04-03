import { Schema, model, models, type InferSchemaType } from 'mongoose'

const userSchema = new Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    userAgent: { type: String, trim: true, default: null },
    referralCode: { type: String, unique: true, sparse: true, trim: true, default: null },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    totalClaimedCusd: { type: Number, default: 0, min: 0 },
    suspiciousClaimCount: { type: Number, default: 0, min: 0 },
    lastClaimAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
)

export type UserDocument = InferSchemaType<typeof userSchema>

export const User = models.User || model('User', userSchema)
