import simpleGit, { SimpleGit } from 'simple-git';
import { execSync } from 'child_process';

const BRANCH_NAME_REGEX = /^((hotfix|patch)-pull-[\-\d\W]+$)/;

export default class GitClient {
  cwd: string;
  git: SimpleGit;
  // TODO: Maybe add the githubRequest instance here too so we can fire off comments

  constructor(cwd: string) {
    this.cwd = cwd;
    this.git = simpleGit({
      baseDir: cwd,
    });
  }

  public am(branchName: string): void {
    this.execSyncCommand(
      `git am ${process.env.PATCH_FILE_SAVE_LOCATION}/${branchName}.patch`
    );
  }

  public amAbort(): void {
    this.execSyncCommand(`git am --abort`);
  }

  public applyPatch(branchName: string): void {
    this.am(branchName);
  }

  public async checkoutBranch(
    branchName: string,
    create: boolean = false
  ): Promise<any> {
    let options = [];

    if (create) {
      options = ['-b'];
    }

    console.log('checkout');

    return this.git.checkout(branchName, options);
  }

  public async deleteBranch(branchName: string): Promise<any> {
    const currentBranch = await this.getCurrentBranch();

    const branchNameRegex = new RegExp(BRANCH_NAME_REGEX);

    try {
      if (branchNameRegex.test(branchName)) {
        return await this.git.deleteLocalBranch(branchName, true);
      } else if (currentBranch === branchName) {
        throw new Error('Cannot delete current branch.');
      } else {
        throw new Error('Cannot delete branch that was not created by bot');
      }
    } catch (err) {
      throw err;
    }
  }

  public async copyBranch(branchName: string) {
    return await this.git.branch(['-C', branchName]);
  }

  public async getCurrentBranch(): Promise<string> {
    const curBranch = await this.git.revparse(['--abbrev-ref', 'HEAD']);

    return curBranch.trim();
  }

  public async pullRebase(branchName: string, remote: string) {
    await this.git.pull(remote, branchName, ['--no-tags', '--rebase']);
  }

  public async push(
    branchName: string,
    remote: string,
    force: boolean = false
  ) {
    let options = [];

    if (force) {
      options = ['--force-with-lease'];
    }

    await this.git.push(remote, branchName, options);
  }

  public async sync(branchName: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        await this.pullRebase(branchName, 'upstream');

        await this.push(branchName, 'origin');

        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  private checkIfBranchExists(branchName: string) {
    return this.execSyncCommand(`git rev-parse --verify ${branchName}`);
  }

  private execSyncCommand(command: string): string {
    try {
      const response = execSync(command, {
        cwd: this.cwd,
      });

      return response.toString();
    } catch (err) {
      throw err;
    }
  }
}
