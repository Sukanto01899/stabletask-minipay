import { NextResponse } from 'next/server'

import { connectToDatabase } from '@/lib/mongodb'
import { DEFAULT_TASKS } from '@/lib/default-tasks'
import { Task } from '@/models/Task'

export async function GET() {
  try {
    await connectToDatabase()

    const existingCount = await Task.countDocuments()
    if (existingCount === 0) {
      await Task.insertMany(DEFAULT_TASKS)
    }

    const tasks = await Task.find({ isActive: true }).sort({ createdAt: 1 }).lean()
    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('GET /api/tasks failed:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks.' }, { status: 500 })
  }
}
