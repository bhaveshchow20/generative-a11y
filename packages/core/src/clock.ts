export type ClockTimer = unknown;

export interface Clock {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): ClockTimer;
  clearTimeout(timer: ClockTimer): void;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (timer) =>
    globalThis.clearTimeout(timer as ReturnType<typeof globalThis.setTimeout>),
};

interface ManualTask {
  id: number;
  at: number;
  sequence: number;
  callback: () => void;
}

export class ManualClock implements Clock {
  #now: number;
  #nextId = 1;
  #sequence = 0;
  #tasks = new Map<number, ManualTask>();

  constructor(startAt = 0) {
    this.#now = startAt;
  }

  now(): number {
    return this.#now;
  }

  setTimeout(callback: () => void, delayMs: number): number {
    const id = this.#nextId++;
    this.#tasks.set(id, {
      id,
      at: this.#now + Math.max(0, delayMs),
      sequence: this.#sequence++,
      callback,
    });
    return id;
  }

  clearTimeout(timer: ClockTimer): void {
    if (typeof timer === "number") this.#tasks.delete(timer);
  }

  advanceBy(durationMs: number): void {
    this.advanceTo(this.#now + Math.max(0, durationMs));
  }

  advanceTo(timestamp: number): void {
    if (timestamp < this.#now)
      throw new Error("ManualClock cannot move backwards");
    while (true) {
      const task = this.#nextTask(timestamp);
      if (!task) break;
      this.#tasks.delete(task.id);
      this.#now = task.at;
      task.callback();
    }
    this.#now = timestamp;
  }

  runNext(): boolean {
    const task = this.#nextTask(Number.POSITIVE_INFINITY);
    if (!task) return false;
    this.#tasks.delete(task.id);
    this.#now = task.at;
    task.callback();
    return true;
  }

  runUntilIdle(maxTasks = 10_000): void {
    let count = 0;
    while (this.pendingCount() > 0) {
      if (count >= maxTasks)
        throw new Error("ManualClock exceeded the task limit");
      this.runNext();
      count += 1;
    }
  }

  pendingCount(): number {
    return this.#tasks.size;
  }

  #nextTask(beforeOrAt: number): ManualTask | undefined {
    return [...this.#tasks.values()]
      .filter((task) => task.at <= beforeOrAt)
      .sort(
        (left, right) => left.at - right.at || left.sequence - right.sequence,
      )[0];
  }
}
