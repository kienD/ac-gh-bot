import GitClient from '../GitClient';
import GithubRequest from '../GithubRequest';
import { Action } from '../types';
import { fixPatch } from '../utils';
import { PatchStates } from '../constants';
import { workerData, parentPort } from 'worker_threads';
import { writeFileSync } from 'fs';

// add check to make sure additions/deletions/changes are the same between old and new PR.
const PATCH_STATES = Object.values(PatchStates);

const patch = ({ commentId, id }: Action['payload']) => {
  return new Promise(async (resolve, reject) => {
    const branchName = `patch-pull-${id}`;

    const originPR = new GithubRequest({
      issueNumber: id,
      repoName: process.env.GITHUB_ORIGIN_REPO,
      repoOwner: process.env.GITHUB_ORIGIN_USER,
    });

    // TODO: Maybe just use fetchoriginPR?
    // TODO: Do we need this await and async?
    // await originPR.initialize();

    const gitClient = new GitClient(process.env.PATCH_DESTINATION_PATH);

    try {
      await originPR.updateComment('Starting patch process (1/6)', commentId);

      await originPR.updateLabels([PatchStates.InProgress], PATCH_STATES);

      gitClient.checkoutBranch(process.env.BASE_BRANCH);

      // Update local and origin base branch
      gitClient.sync(process.env.BASE_BRANCH);

      await originPR.updateComment('Rebase complete (2/6)', commentId);

      // Pull patch and fix patch file
      // TODO: Do we need this await and async?
      const patchData = await originPR.fetchPatch();

      writeFileSync(`/tmp/${branchName}.patch`, patchData);

      fixPatch(branchName);

      await originPR.updateComment('Patch file updated (3/6)', commentId);

      // Apply patch to destination branch
      gitClient.applyPatch(branchName);

      await originPR.updateComment('Patch applied to branch (4/6)', commentId);

      // Push updated branch to destination repo
      gitClient.push(branchName, 'origin');

      await originPR.updateComment(
        `Pushed ${branchName} to destination repo (5/6)`,
        commentId
      );

      const { html_url: originPRUrl, title } = originPR.getPullRequest();

      // Create new PR to destination repo
      const destinationPR = new GithubRequest({
        repoName: process.env.GITHUB_DESTINATION_REPO,
        repoOwner: process.env.GITHUB_DESTINATION_USER,
      });

      const { html_url: patchUrl, number: destPRNumber } =
        await destinationPR.createPullRequest(
          branchName,
          process.env.BASE_BRANCH,
          title,
          `Original PR is [here](${originPRUrl})`
        );

      await destinationPR.createComment('ci:forward');

      await originPR.updateComment(
        `PR forwarded to [here](${patchUrl}) (6/6)`,
        commentId
      );

      await originPR.updateLabels([PatchStates.Success], PATCH_STATES);

      gitClient.checkoutBranch(process.env.BASE_BRANCH);

      gitClient.deleteBranch(branchName);

      parentPort.postMessage('done');
      resolve('done');
    } catch (err) {
      process.exitCode = 1;

      try {
        gitClient.amAbort();
      } catch (err) {}

      // TODO: add code to check if branch exists
      gitClient.checkoutBranch(process.env.BASE_BRANCH);

      gitClient.deleteBranch(branchName);

      await originPR.updateComment(`Patch Failed: ${err.message}`, commentId);

      await originPR.updateLabels([PatchStates.Failed], PATCH_STATES);

      reject(err);
    }
  });
};

patch(workerData.payload);
