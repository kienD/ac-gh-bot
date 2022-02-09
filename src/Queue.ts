import { Action } from "./types";

export default class Queue {
  queue: Action[];

  constructor(initialQueue: Action[] = []) {
    this.queue = initialQueue;
  }

  public clearAll(): void {
    this.queue = [];
  }

  public dequeue(): Action {
    console.log("dequeue", this.queue);
    return this.queue.shift();
  }

  public enqueue(action: Action): void {
    console.log("enqueue", this.queue);
    this.queue.push(action);
  }

  public peek(): Action {
    console.log("peek", this.queue);
    return this.queue[0];
  }

  public getCount(): number {
    return this.queue.length;
  }

  public isEmpty(): boolean {
    return this.getCount() === 0;
  }
}
