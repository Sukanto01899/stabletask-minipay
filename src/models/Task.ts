import { Schema, model, models, type InferSchemaType } from 'mongoose'

const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    rewardCusd: { type: Number, required: true, min: 0 },
    tag: { type: String, trim: true, default: null },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      default: 'Easy',
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  },
)

export type TaskDocument = InferSchemaType<typeof taskSchema>

export const Task = models.Task || model('Task', taskSchema)
