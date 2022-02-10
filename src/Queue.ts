import { Action } from './types';

export default class Queue {
    queue: Action[];

    constructor(initialQueue: Action[] = []) {
        this.queue = initialQueue;
    }

    public clearAll(): void {
        console.log('Queue Cleared');

        this.queue = [];
    }

    public dequeue(): Action {
        console.log('dequeuing');

        return this.queue.shift();
    }

    public enqueue(action: Action): void {
        console.log('Queuing', action);

        this.queue.push(action);
    }

    public peek(): Action {
        console.log('Peeking', this.queue[0]);

        return this.queue[0];
    }

    public getCount(): number {
        return this.queue.length;
    }

    public isEmpty(): boolean {
        return this.getCount() === 0;
    }
}
