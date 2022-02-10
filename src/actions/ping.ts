import GithubRequest from '../GithubRequest';
import { Action } from '../types';
import { workerData, parentPort } from 'worker_threads';

const ping = ({ commentId, id }: Action['payload']) => {
  return new Promise(async (resolve, reject) => {
    try {
      const pullRequest = new GithubRequest({
        issueNumber: id,
        repoName: process.env.GITHUB_ORIGIN_REPO,
        repoOwner: process.env.GITHUB_ORIGIN_USER,
      });

      await pullRequest.updateComment('pong', commentId);

      resolve('done');
      parentPort.postMessage('done');
    } catch (err) {
      process.exitCode = 1;

      reject(err);
    }
  });
};

ping(workerData.payload);
