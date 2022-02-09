import GitClient from "../GitClient";
import GithubRequest from "../GithubRequest";
import { Action } from "../types";
import { fixPatch } from "../utils";
import { PatchStates } from "../constants";
import { writeFileSync } from "fs";

// add check to make sure additions/deletions/changes are the same between old and new PR.
const PATCH_STATES = Object.values(PatchStates);

const patch = ({ commentId, id }: Action["payload"]) => {
  const branchName = `patch-pull-${id}`;

  const originPR = new GithubRequest({
    issueNumber: id,
    repoName: process.env.GITHUB_ORIGIN_REPO,
    repoOwner: process.env.GITHUB_ORIGIN_USER,
  });

  // TODO: Maybe just use fetchoriginPR?
  // TODO: Do we need this await and async?
  // await originPR.initialize();

  return new Promise(async (resolve, reject) => {
    const gitClient = new GitClient(process.env.PATCH_DESTINATION_PATH);

    try {
      originPR.updateComment("Starting patch process (1/6)", commentId);

      originPR.updateLabels([PatchStates.InProgress], PATCH_STATES);

      gitClient.checkoutBranch(process.env.BASE_BRANCH);

      // Update local and origin base branch
      gitClient.sync(process.env.BASE_BRANCH);

      originPR.updateComment("Rebase complete (2/6)", commentId);

      // Pull patch and fix patch file
      // TODO: Do we need this await and async?
      const patchData = await originPR.fetchPatch();

      writeFileSync(`/tmp/${branchName}.patch`, patchData);

      fixPatch(branchName);

      originPR.updateComment("Patch file updated (3/6)", commentId);

      // Apply patch to destination branch
      gitClient.applyPatch(branchName);

      originPR.updateComment("Patch applied to branch (4/6)", commentId);

      // Push updated branch to destination repo
      gitClient.push(branchName, "origin");

      originPR.updateComment(
        `Pushed ${branchName} to destination repo (5/6)`,
        commentId
      );

      // Create new PR to destination repo
      const destinationPR = new GithubRequest({
        repoName: process.env.GITHUB_DESTINATION_REPO,
        repoOwner: process.env.GITHUB_DESTINATION_USER,
      });

      const { title } = originPR.getPullRequest();

      const { number: destPullId } = await destinationPR.createPullRequest(
        branchName,
        process.env.BASE_BRANCH,
        title
      );

      destinationPR.createComment("ci:forward");

      originPR.updateComment(
        `PR forwarded to [here](https://github.com/${process.env.GITHUB_DESTINATION_USER}/${process.env.GITHUB_DESTINATION_REPO}/pull/${destPullId}) (6/6)`,
        commentId
      );

      originPR.updateLabels([PatchStates.Success], PATCH_STATES);

      gitClient.checkoutBranch(process.env.BASE_BRANCH);

      gitClient.deleteBranch(branchName);

      resolve("done");
    } catch (err) {
      try {
        gitClient.amAbort();
      } catch (err) {}

      gitClient.checkoutBranch(process.env.BASE_BRANCH);

      gitClient.deleteBranch(branchName);

      originPR.updateComment(`Patch Failed: ${err.message}`, commentId);

      originPR.updateLabels([PatchStates.Failed], PATCH_STATES);

      reject(err);
    }
  });
};

export default patch;
