import 'dotenv/config';
import EventEmitter from 'events';
import express from 'express';
import GithubRequest from './GithubRequest';
import Queue from './Queue';
import { Action } from './types';
import { ACTIONS_PATH_MAP, ActionTypes } from './constants';
import { createNodeMiddleware, Webhooks } from '@octokit/webhooks';
import { Worker } from 'worker_threads';
import { formatQueue, isOverrideProtocolUser } from './utils';

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
      comment: {
        body,
        user: { login },
      },
      issue: { number: id },
    },
  }) => {
    const [command, ...params] = body.trim().split(' ');

    const admin = isOverrideProtocolUser(login);

    if (command.startsWith('/')) {
      const formattedCommand = command.slice(1).toLowerCase();

      if (ACTIONS_PATH_MAP[formattedCommand]) {
        addToQueue({
          payload: params ? { admin, id, params } : { id, admin },
          type: formattedCommand as ActionTypes,
        });
      } else if (formattedCommand === ActionTypes.CheckQueue) {
        const originPR = new GithubRequest({
          issueNumber: id,
          repoName: process.env.GITHUB_ORIGIN_REPO,
          repoOwner: process.env.GITHUB_ORIGIN_USER,
        });

        const queue = formatQueue(actionQueue.getQueue());

        originPR.createComment(queue.join('\n'));
      }
    }
  }
);

const lrciacWebhooks = new Webhooks({
  secret: process.env.GITHUB_SECRET,
});

lrciacWebhooks.on(
  'pull_request.labeled',
  ({
    payload: {
      pull_request: {
        head: { ref },
        labels,
      },
      number,
    },
  }) => {
    const CI_TEST_FAILURE_REGEX =
      /ci:test(:(sf|stable|relevant))?\s*-\s*failure/;
    const CI_TEST_PENDING_REGEX =
      /ci:test(:(sf|stable|relevant))?\s*-\s*pending/;

    const pendingLabels = labels.filter(({ name }) =>
      CI_TEST_PENDING_REGEX.test(name)
    );

    const failureLabels = labels.filter(({ name }) =>
      CI_TEST_FAILURE_REGEX.test(name)
    );

    if (!pendingLabels.length) {
      if (!!failureLabels.length) {
        const [issueNumber] = ref.match(/[\d]+/);

        const originPR = new GithubRequest({
          issueNumber: Number(issueNumber),
          repoName: process.env.GITHUB_ORIGIN_REPO,
          repoOwner: process.env.GITHUB_ORIGIN_USER,
        });

        originPR.createComment(
          `The following failures still exist on [pull-${number}](https://github.com/liferay-continuous-integration-ac/liferay-portal-ee/pull/${number}):\n${failureLabels.map(
            ({ name }) => `${name}\n`
          )}`
        );
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

app.post(
  '/liferay-ci-ac',
  createNodeMiddleware(lrciacWebhooks, {
    path: '/liferay-ci-ac',
  })
);

app.listen(serverPort, () => {
  console.log(`Listening for hooks at / on ${serverPort}`);
});
