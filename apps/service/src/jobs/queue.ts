type Task = () => Promise<void>;

/**
 * Minimal bounded-concurrency queue. AI generation runs at concurrency 1
 * (PRD §8.6 - "limit AI concurrency to 1 by default"); scan/export jobs use
 * their own queue instance with a slightly higher cap.
 */
export class JobQueue {
  private running = 0;
  private readonly pending: Task[] = [];

  constructor(private readonly concurrency = 1) {}

  enqueue(task: Task): void {
    this.pending.push(task);
    this.drain();
  }

  private drain(): void {
    while (this.running < this.concurrency && this.pending.length > 0) {
      const task = this.pending.shift()!;
      this.running += 1;
      task()
        .catch(() => {
          /* individual job error handling happens inside the task itself */
        })
        .finally(() => {
          this.running -= 1;
          this.drain();
        });
    }
  }
}
