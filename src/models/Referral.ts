import { Schema, model, models, type InferSchemaType } from 'mongoose'

const referralSchema = new Schema(
  {
    referrer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    referee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    code: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'pending',
    },
    rewardCusd: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
  },
)

referralSchema.index({ referrer: 1, referee: 1 }, { unique: true })

export type ReferralDocument = InferSchemaType<typeof referralSchema>

export const Referral = models.Referral || model('Referral', referralSchema)
