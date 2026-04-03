import { Schema, model, models, type InferSchemaType } from 'mongoose'

const claimSchema = new Schema(
  {
    task: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    walletAddress: { type: String, required: true, lowercase: true, trim: true },
    fingerprint: { type: String, required: true, trim: true },
    amountCusd: { type: Number, required: true, min: 0 },
    txHash: { type: String, trim: true, default: null },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'failed'],
      default: 'pending',
    },
    claimedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
)

claimSchema.index({ task: 1, walletAddress: 1 }, { unique: true })

export type ClaimDocument = InferSchemaType<typeof claimSchema>

export const Claim = models.Claim || model('Claim', claimSchema)
