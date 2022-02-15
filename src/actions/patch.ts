import GitClient from '../GitClient';
import GithubRequest from '../GithubRequest';
import { Action } from '../types';
import { fixPatch } from '../utils';
import { isForceFlag } from '../utils';
import { PatchStates } from '../constants';
import { workerData, parentPort } from 'worker_threads';
import { writeFileSync } from 'fs';

// add check to make sure additions/deletions/changes are the same between old and new PR.
const PATCH_STATES = Object.values(PatchStates);

const patch = ({
  admin,
  commentId,
  id,
  params,
}: Action['payload']): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    const [flag] = params;

    const branchName = `patch-pull-${id}`;

    const originPR = new GithubRequest({
      issueNumber: id,
      repoName: process.env.GITHUB_ORIGIN_REPO,
      repoOwner: process.env.GITHUB_ORIGIN_USER,
    });

    const gitClient = new GitClient(process.env.PATCH_DESTINATION_PATH);

    try {
      const validForPatch = admin || (await originPR.checkPermissions());

      if (!validForPatch) {
        throw new Error(
          'PR reviews 2 approvals from anyone or a single over protocol reviewer'
        );
      }

      await originPR.updateLabels([PatchStates.InProgress], PATCH_STATES);

      await originPR.updateComment('Starting patch process (1/6)', commentId);

      await gitClient.checkoutBranch(process.env.BASE_BRANCH);

      // Update local and origin base branch
      await gitClient.sync(process.env.BASE_BRANCH);

      await originPR.updateComment('Rebase complete (2/6)', commentId);

      await gitClient.copyBranch(branchName);

      await gitClient.checkoutBranch(branchName);

      const patchData = await originPR.fetchPatch();

      writeFileSync(`/tmp/${branchName}.patch`, patchData);

      fixPatch(branchName);

      await originPR.updateComment('Patch file updated (3/6)', commentId);

      // Apply patch to destination branch
      gitClient.applyPatch(branchName);

      await originPR.updateComment('Patch applied to branch (4/6)', commentId);

      // Push updated branch to destination repo
      await gitClient.push(branchName, 'origin', isForceFlag(flag));

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

      const { html_url: patchUrl } = await destinationPR.createPullRequest({
        base: process.env.BASE_BRANCH,
        body: `Original PR is [here](${originPRUrl})`,
        branch: branchName,
        title,
        username: process.env.GITHUB_DESTINATION_USER,
      });

      await destinationPR.createComment('ci:forward');

      await originPR.updateComment(
        `PR forwarded to [here](${patchUrl}) (6/6)`,
        commentId
      );

      await originPR.updateLabels([PatchStates.Success], PATCH_STATES);

      await gitClient.checkoutBranch(process.env.BASE_BRANCH);

      await gitClient.deleteBranch(branchName);

      parentPort.postMessage('done');

      resolve();
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
