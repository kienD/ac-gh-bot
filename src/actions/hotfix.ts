import GitClient from '../GitClient';
import GithubRequest from '../GithubRequest';
import { Action } from '../types';
import { HotfixStates } from '../constants';
import { isForceFlag } from '../utils';
import { workerData, parentPort } from 'worker_threads';
import { writeFileSync } from 'fs';

const HOTFIX_STATES = Object.values(HotfixStates);

const hotfix = ({ commentId, id, params }: Action['payload']) => {
  return new Promise(async (resolve, reject) => {
    const [hotfixBranch, flag] = params;

    const branchName = `hotfix-pull-${id}`;

    const originPR = new GithubRequest({
      issueNumber: id,
      repoName: process.env.GITHUB_ORIGIN_REPO,
      repoOwner: process.env.GITHUB_ORIGIN_USER,
    });

    const gitClient = new GitClient(process.env.HOTFIX_DESTINATION_PATH);

    try {
      if (!hotfixBranch) {
        const err = new Error(
          'Hotfix destination branch required. e.g. `/hotfix 3.1.x`'
        );

        throw err;
      }

      await originPR.updateComment('Starting hotfix process (1/5)', commentId);

      await originPR.updateLabels([HotfixStates.InProgress], HOTFIX_STATES);

      gitClient.checkoutBranch(hotfixBranch);

      gitClient.pullRebase(hotfixBranch, 'upstream');

      await originPR.updateComment('Rebase complete (2/5)', commentId);

      gitClient.checkoutBranch(branchName, true);

      const patchData = await originPR.fetchPatch();

      writeFileSync(`/tmp/${branchName}.patch`, patchData);

      gitClient.applyPatch(branchName);

      await originPR.updateComment(`Patch applied to branch (3/5)`, commentId);

      gitClient.push(branchName, 'origin', isForceFlag(flag));

      await originPR.updateComment(
        `Pushed ${branchName} to origin repo (4/5)`,
        commentId
      );

      const { html_url: originPRUrl, title } = originPR.getPullRequest();

      const { html_url: hotfixUrl } = await originPR.createPullRequest({
        base: hotfixBranch,
        body: `Original PR is [here](${originPRUrl})`,
        branch: branchName,
        title: `HOTFIX|${title}`,
        username: process.env.GITHUB_DESTINATION_USER,
      });

      await originPR.updateComment(
        `PR forwarded to [here](${hotfixUrl}) (5/5)`,
        commentId
      );

      await originPR.updateLabels([HotfixStates.Success], HOTFIX_STATES);

      gitClient.checkoutBranch(hotfixBranch);

      gitClient.deleteBranch(branchName);

      resolve('done');
      parentPort.postMessage('done');
    } catch (err) {
      process.exitCode = 1;

      try {
        gitClient.amAbort();
      } catch (err) {}

      if (hotfixBranch) {
        gitClient.checkoutBranch(hotfixBranch);

        gitClient.deleteBranch(branchName);
      }

      await originPR.updateComment(
        `
									Hotfix Failed:
									Error: ${err.message}
								`,
        commentId
      );

      await originPR.updateLabels([HotfixStates.Failed], HOTFIX_STATES);

      reject(err);
    }
  });
};

hotfix(workerData.payload);
