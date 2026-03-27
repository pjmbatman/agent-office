export interface QueuedTask {
  id: string
  description: string
  createdAt: number
}

export class TaskQueue {
  private queue: QueuedTask[] = []
  private currentTask: QueuedTask | null = null

  enqueue(description: string): QueuedTask {
    const task: QueuedTask = {
      id: Date.now().toString(),
      description,
      createdAt: Date.now()
    }
    this.queue.push(task)
    return task
  }

  dequeue(): QueuedTask | null {
    const task = this.queue.shift() || null
    this.currentTask = task
    return task
  }

  peek(): QueuedTask | null {
    return this.queue[0] || null
  }

  cancel(taskId: string): boolean {
    const idx = this.queue.findIndex((t) => t.id === taskId)
    if (idx >= 0) {
      this.queue.splice(idx, 1)
      return true
    }
    return false
  }

  getCurrent(): QueuedTask | null {
    return this.currentTask
  }

  clearCurrent(): void {
    this.currentTask = null
  }

  size(): number {
    return this.queue.length
  }

  isEmpty(): boolean {
    return this.queue.length === 0
  }

  list(): QueuedTask[] {
    return [...this.queue]
  }
}
