import GitClient from "../GitClient";
import GithubRequest from "../GithubRequest";
import { Action } from "../types";
import { HotfixStates } from "../constants";
import { writeFileSync } from "fs";

const HOTFIX_STATES = Object.values(HotfixStates);

const hotfix = ({ commentId, id, params }: Action["payload"]) => {
  const [hotfixBranch] = params;

  const branchName = `hotfix-pull-${id}`;

  const originPR = new GithubRequest({
    issueNumber: id,
    repoName: process.env.GITHUB_ORIGIN_REPO,
    repoOwner: process.env.GITHUB_ORIGIN_USER,
  });

  const gitClient = new GitClient(process.env.HOTFIX_DESTINATION_PATH);

  return new Promise(async (resolve, reject) => {
    try {
      await originPR.updateComment("Starting hotfix process (1/5)", commentId);

      await originPR.updateLabels([HotfixStates.InProgress], HOTFIX_STATES);

      gitClient.checkoutBranch(hotfixBranch);

      gitClient.pullRebase(hotfixBranch, "upstream");
      await originPR.updateComment("Rebase complete (2/5)", commentId);

      const patchData = await originPR.fetchPatch();

      writeFileSync(`/tmp/${branchName}.patch`, patchData);

      gitClient.applyPatch(branchName);

      await originPR.updateComment(`Patch applied to branch (3/5)`, commentId);

      gitClient.push(branchName, "origin");

      await originPR.updateComment(
        `Pushed ${branchName} to origin repo (4/5)`,
        commentId
      );

      const { title } = originPR.getPullRequest();

      const data = await originPR.createPullRequest(
        branchName,
        hotfixBranch,
        `HOTFIX|${title}`
      );

      console.log("hotfix data", data);

      const { number: hotfixPRId } = data;

      await originPR.updateComment(
        `PR forwarded to [here](https://github.com/${process.env.GITHUB_DESTINATION_USER}/${process.env.GITHUB_ORIGIN_REPO}/pull/${hotfixPRId}) (5/5)`,
        commentId
      );

      await originPR.updateLabels([HotfixStates.Failed], HOTFIX_STATES);

      gitClient.checkoutBranch(hotfixBranch);

      gitClient.deleteBranch(branchName);

      resolve("done");
    } catch (err) {
      try {
        gitClient.amAbort();
      } catch (err) {}

      gitClient.checkoutBranch(hotfixBranch);

      gitClient.deleteBranch(branchName);

      originPR.updateComment(`Hotfix Failed: ${err.message}`, commentId);

      await originPR.updateLabels([HotfixStates.Failed], HOTFIX_STATES);

      reject(err);
    }
  });
};

export default hotfix;
