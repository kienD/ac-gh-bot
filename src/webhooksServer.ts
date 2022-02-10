import 'dotenv/config';
import EventEmitter from 'events';
import express from 'express';
import GithubRequest from './GithubRequest';
import Queue from './Queue';
import { Action } from './types';
import { ACTIONS_PATH_MAP, ActionTypes } from './constants';
import { createNodeMiddleware, Webhooks } from '@octokit/webhooks';
import { Worker } from 'worker_threads';

let serverPort = 80;

if (process.argv.length > 2) {
    serverPort = Number(process.argv[2]);
}

const faroWebhooks = new Webhooks({
    secret: process.env.GITHUB_SECRET,
});

const actionQueue = new Queue();

let processing = false;

const createWorker = ({ payload, type }: Action): Promise<any> => {
    return new Promise((resolve, reject) => {
        const filePath = ACTIONS_PATH_MAP[type];

        const worker = new Worker(filePath, {
            workerData: { payload },
        });

        worker.on('message', resolve);

        worker.on('error', val => {
            reject(val);
        });

        worker.on('exit', code => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
    });
};

const processQueueEmitter = new EventEmitter();

processQueueEmitter.on('processQueue', () => {
    const action = actionQueue.peek();

    if (ACTIONS_PATH_MAP[action?.type]) {
        processing = true;

        createWorker(action)
            .catch(err => {
                console.error(`Ping Error: ${err.message}`);
            })
            .finally(() => {
                actionQueue.dequeue();

                processing = false;

                if (!actionQueue.isEmpty()) {
                    processQueueEmitter.emit('processQueue');
                }
            });
    }
});

const addToQueue = async (action: Action) => {
    const pullRequest = new GithubRequest({
        issueNumber: action.payload.id,
        repoName: process.env.GITHUB_ORIGIN_REPO,
        repoOwner: process.env.GITHUB_ORIGIN_USER,
    });

    const { id: commentId } = await pullRequest.createComment('queued');

    actionQueue.enqueue({
        ...action,
        payload: { ...action.payload, commentId },
    });

    if (!processing) {
        processQueueEmitter.emit('processQueue');
    }
};

faroWebhooks.on(
    'issue_comment.created',
    ({
        payload: {
            comment: { body },
            issue: { number: id },
        },
    }) => {
        const [command, ...params] = body.trim().split(' ');

        if (command.startsWith('/')) {
            const formattedCommand = command.slice(1).toLowerCase();

            if (ACTIONS_PATH_MAP[formattedCommand]) {
                addToQueue({
                    payload: params ? { id, params } : { id },
                    type: formattedCommand as ActionTypes,
                });
            }
        }
    }
);

const app = express();

app.use(express.json());

app.post(
    '/',
    createNodeMiddleware(faroWebhooks, {
        path: '/',
    })
);

// addToQueue({
// 	type: 'ping',
// 	payload: { commentId: 1033238873, id: 65, params: [] },
// });

// TODO: Add listener for changes to ci repo
// app.post(
//   "/hooks",
//   createNodeMiddleware(faroWebhooks, {
//     path: "/",
//   })
// );
// app.on(
//   "request",
//   createNodeMiddleware(webhooks, {
//     onUnhandledRequest: (req, res) => {
//       console.log("unhandled", res);
//     },
//     path: "/",
//   })
// );

// app.on(
//   "request",
//   createNodeMiddleware(webhooks, {
//     onUnhandledRequest: (req, res) => {
//       console.log("unhandled", res);
//     },
//     path: "/hooks",
//   })
// );

app.listen(serverPort, () => {
    console.log(`Listening for hooks at / on ${serverPort}`);
});
