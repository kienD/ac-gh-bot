import GithubRequest from "../GithubRequest";
import { Action } from "types";

const ping = ({ commentId, id }: Action["payload"]) => {
  const pullRequest = new GithubRequest({
    issueNumber: id,
    repoName: process.env.GITHUB_ORIGIN_REPO,
    repoOwner: process.env.GITHUB_ORIGIN_USER,
  });

  return pullRequest.updateComment("pong", commentId);
};

export default ping;
