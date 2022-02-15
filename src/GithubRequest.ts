import { isOverrideProtocolUser } from './utils';
import { request } from '@octokit/request';
import { RequestHeaders } from './types';
import { RequestMethods, ReviewStates } from './constants';

// TODO: Rename to like GithubPRRequest.  Probably should extend the original  GithubRequest.   maybe rename to GithubClient
export default class GithubRequest {
  private headers: RequestHeaders = {
    authorization: `token ${process.env.GITHUB_TOKEN}`,
  };
  private issueNumber: string;
  private pullRequest: any;
  private repoName: string;
  private repoOwner: string;

  constructor({
    issueNumber,
    repoName,
    repoOwner,
  }: {
    issueNumber?: number;
    repoName: string;
    repoOwner: string;
  }) {
    this.repoName = repoName;
    this.repoOwner = repoOwner;
    this.issueNumber = issueNumber ? String(issueNumber) : undefined;
  }

  public async initialize() {
    await this.fetchPullRequest();
  }

  public async createComment(comment: string) {
    const url = '/repos/{owner}/{repo}/issues/{issue_number}/comments';

    const { data } = await this.createRequest(url, RequestMethods.Post, {
      body: comment,
      issue_number: this.issueNumber,
    });

    return data;
  }

  public async fetchComment(commentId: number) {
    const url = '/repos/{owner}/{repo}/issues/comments/{comment_id}';

    const { data } = await this.createRequest(url, RequestMethods.Get, {
      comment_id: String(commentId),
    });

    return data;
  }

  public getUserName() {
    const {
      user: { login: userName },
    } = this.getPullRequest();

    return userName;
  }

  public async getReviews() {
    const { data } = await this.createRequest(
      '/repos/{owner}/{repo}/pulls/{pull_number}/reviews',
      RequestMethods.Get,
      {
        pull_number: this.issueNumber,
      }
    );

    return data;
  }

  public async checkPermissions() {
    const reviews = await this.getReviews();

    return reviews.length >= 2 || this.hasOverrideUserApproval(reviews);
  }

  public async updateComment(comment: string, commentId: number) {
    const url = '/repos/{owner}/{repo}/issues/comments/{comment_id}';

    const { data } = await this.createRequest(url, RequestMethods.Patch, {
      body: comment,
      comment_id: String(commentId),
    });

    return data;
  }

  public async createPullRequest({
    base,
    body,
    branch,
    title,
    username,
  }: {
    base: string;
    body?: string;
    branch: string;
    title: string;
    username: string;
  }) {
    const url = '/repos/{owner}/{repo}/pulls';

    const { data } = await this.createRequest(url, RequestMethods.Post, {
      base,
      body,
      head: `${username}:${branch}`,
      title,
    });

    if (!this.getPullRequest()) {
      this.setPullRequest(data);
    }

    if (!this.issueNumber) {
      this.setIssueNumber(data.number);
    }

    return data;
  }

  public async fetchPatch() {
    const url = '/repos/{owner}/{repo}/pulls/{pull_number}';

    const { data } = await this.createRequest(
      url,
      RequestMethods.Get,
      { pull_number: this.issueNumber },
      { ...this.headers, accept: 'application/vnd.github.v3.patch' }
    );

    return data;
  }

  public async fetchPullRequest() {
    try {
      const url = '/repos/{owner}/{repo}/pulls/{pull_number}';

      const { data } = await this.createRequest(url, RequestMethods.Get, {
        pull_number: this.issueNumber,
      });

      this.setPullRequest(data);
    } catch (error) {
      console.log(error);
    }
  }

  public getPullRequest() {
    return this.pullRequest;
  }

  public setIssueNumber(issueNumber: number) {
    this.issueNumber = String(issueNumber);
  }

  public setPullRequest(pullRequest: any) {
    this.pullRequest = pullRequest;
  }

  public async updateLabels(newLabels: string[], removeLabels: string[]) {
    // TODO: Do we need this await and async?
    await this.fetchPullRequest();

    const { labels: originalLabels } = this.getPullRequest();

    const filteredLabelNames: string[] = originalLabels
      .filter(({ name }) => !removeLabels.includes(name))
      .map(({ name }) => name);

    this.updatePullRequest({
      labels: [...filteredLabelNames, ...newLabels],
    });
  }

  public async updatePullRequest(params: { [key: string]: any }) {
    const url = '/repos/{owner}/{repo}/issues/{issue_number}';

    const { data } = await this.createRequest(url, RequestMethods.Patch, {
      issue_number: this.issueNumber,
      ...params,
    });

    console.log(data);
  }

  private hasOverrideUserApproval(reviews): boolean {
    const approvals = reviews.map(({ state, user: { login: userName } }) => {
      if (state === ReviewStates.Approved) {
        return userName;
      }
    });

    return !!approvals.filter(isOverrideProtocolUser).length;
  }

  private async createRequest(
    url: string,
    requestMethod: RequestMethods,
    requestParams: { [key: string]: string } = {},
    headers = this.headers
  ) {
    const response = await request({
      headers,
      method: requestMethod,
      owner: this.repoOwner,
      repo: this.repoName,
      url,
      ...requestParams,
    });

    return response;
  }
}
