### Deployment
1. `yarn`
2. `yarn build`
3. `yarn start:prod` to run in production mode. This will output errors to `error-log.txt`

To stop the server you can run `yarn stop`
To restart the server you can run `yarn restart`

### Current commands
- `/patch` - Patches PR to destination branch.
- `/hotfix BRANCH_NAME` - Sends a PR to the BRANCH_NAME.
- `/ping` - Creates a new comment with "Pong" as the response.
- `/checkQueue` - Creates a new comment with the current commands in queue.

### .env file configuration
These configurations are required for this to work.

```
BASE_BRANCH="TEST"
DESTINATION_PATH_ADDITION="modules/dxp/apps/osb/test/"
GITHUB_DESTINATION_USER="testUser"
GITHUB_DESTINATION_REPO="test-repo"

GITHUB_ORIGIN_REPO="test-repo-origin"
HOTFIX_DESTINATION_PATH="/home/user/test-2"
PATCH_DESTINATION_PATH="/home/user/test"
PATCH_FILE_SAVE_LOCATION="/tmp"
PROTOCOL_OVERRIDE_USERS=["testUser", "testUser1"]

GITHUB_SECRET="TEST-SECRET"
GITHUB_ORIGIN_USER="testUser"
GITHUB_TOKEN="TEST-TOKEN"
```
