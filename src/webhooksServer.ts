import "dotenv/config";
import EventEmitter from "events";
import express from "express";
import GithubRequest from "./GithubRequest";
import Queue from "./Queue";
import { Action } from "./types";
import { createNodeMiddleware, Webhooks } from "@octokit/webhooks";
import { hotfix, patch, ping } from "./actions";

let serverPort = 8080;

if (process.argv.length > 2) {
  serverPort = Number(process.argv[2]);
}

const faroWebhooks = new Webhooks({
  secret: process.env.GITHUB_SECRET,
});

const actionQueue = new Queue();

let processing = false;

const processQueueEmitter = new EventEmitter();

processQueueEmitter.on("processQueue", () => {
  processing = true;

  const { name, payload } = actionQueue.peek() || {};

  switch (name) {
    case "ping":
      ping(payload)
        .then((val) => {
          console.log(val);
          actionQueue.dequeue();

          processing = false;

          if (!actionQueue.isEmpty()) {
            processQueueEmitter.emit("processQueue");
          }
        })
        .catch((err) => {
          actionQueue.dequeue();

          console.error(`Ping Error: ${err.message}`);
        });

      break;
    case "patch":
      patch(payload)
        .then(() => {
          actionQueue.dequeue();

          processing = false;

          if (!actionQueue.isEmpty()) {
            processQueueEmitter.emit("processQueue");
          }
        })
        .catch((err) => {
          actionQueue.dequeue();

          console.error(`Patch Error: ${err.message}`);
        });

      break;
    case "hotfix":
      hotfix(payload)
        .then(() => {
          actionQueue.dequeue();

          processing = false;

          if (!actionQueue.isEmpty()) {
            processQueueEmitter.emit("processQueue");
          }
        })
        .catch((err) => {
          actionQueue.dequeue();

          console.error(`Hotfix Error: ${err.message}`);
        });

      break;
    default:
      break;
  }
});

const addToQueue = async (action: Action) => {
  const pullRequest = new GithubRequest({
    issueNumber: action.payload.id,
    repoName: process.env.GITHUB_ORIGIN_REPO,
    repoOwner: process.env.GITHUB_ORIGIN_USER,
  });

  const { id: commentId } = await pullRequest.createComment("queued");

  actionQueue.enqueue({
    ...action,
    payload: { ...action.payload, commentId },
  });

  if (!processing) {
    processQueueEmitter.emit("processQueue");
  }
};

faroWebhooks.on(
  "issue_comment.created",
  ({
    payload: {
      comment: { body },
      issue: { number: id },
    },
  }) => {
    const [command, ...params] = body.trim().split(" ");

    if (command.startsWith("/")) {
      addToQueue({
        payload: params ? { id, params } : { id },
        name: command.slice(1),
      });
    }
  }
);

const app = express();

app.use(express.json());

app.post(
  "/",
  createNodeMiddleware(faroWebhooks, {
    path: "/",
  })
);

// addToQueue({
//   name: "hotfix",
//   payload: { commentId: 1033238873, id: 4014, params: ["3.1.x"] },
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
