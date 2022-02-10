import { execSync } from 'child_process';

const BRANCH_NAME_REGEX = /^((hotfix|patch)-pull-[\-\d\W]+$)/;

export default class GitClient {
    cwd: string;
    // TODO: Maybe add the githubRequest instance here too so we can fire off comments

    constructor(cwd: string) {
        this.cwd = cwd;
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
        this.checkoutBranch(branchName, true);

        this.am(branchName);

        // TODO: Add comment
    }

    public checkoutBranch(branchName: string, create: boolean = false): string {
        const createFlag = create ? '-b' : '';

        return this.execSyncCommand(`git checkout ${createFlag} ${branchName}`);
    }

    public deleteBranch(branchName: string): string {
        const currentBranch = this.getCurrentBranch();

        const branchNameRegex = new RegExp(BRANCH_NAME_REGEX);

        try {
            if (branchNameRegex.test(branchName)) {
                return this.execSyncCommand(`git branch -D ${branchName}`);
            } else if (currentBranch === branchName) {
                throw new Error('Cannot delete current branch.');
            } else {
                throw new Error(
                    'Cannot delete branch that was not created by bot'
                );
            }
        } catch (err) {
            throw err;
        }
    }

    public getCurrentBranch(): string {
        return this.execSyncCommand('git rev-parse --abbrev-ref HEAD').trim();
    }

    public pullRebase(branchName: string, remote: string) {
        this.execSyncCommand(
            `git pull --no-tags --rebase ${remote} ${branchName}`
        );
    }

    public push(branchName: string, remote: string) {
        this.execSyncCommand(`git push ${remote} ${branchName}`);
    }

    public sync(branchName: string): void {
        this.pullRebase(branchName, 'upstream');

        this.push(branchName, 'origin');
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
