import { execSync } from 'child_process';
import { Action } from 'types';

export const isForceFlag = (flag: string): boolean =>
  ['-f', '--force'].includes(flag);

export const createUpdatedPatch = (
  branchName: string,
  updatedLines: string
): string => {
  try {
    return execSync(
      `./create-updated-patch.sh "${process.env.PATCH_FILE_SAVE_LOCATION}/${branchName}.patch" "${updatedLines}"`
    ).toString();
  } catch (err) {
    throw err;
  }
};

export const fixPatch = (branchName: string) => {
  try {
    const updatedLines = execSync(
      `awk -f "patch.awk" -v portal_path_addition="${process.env.DESTINATION_PATH_ADDITION}" "${process.env.PATCH_FILE_SAVE_LOCATION}/${branchName}.patch"`
    ).toString();

    createUpdatedPatch(branchName, updatedLines.trim());
  } catch (err) {
    throw err;
  }
};

export const isOverrideProtocolUser = (userName: string) => {
  const protocolOverrideUsers: string[] = JSON.parse(
    process.env.PROTOCOL_OVERRIDE_USERS
  );

  return protocolOverrideUsers.includes(userName.toLowerCase());
};

export const formatQueue = (queue: Action[]): string[] => {
  if (!queue.length) {
    return ['No actions in queue'];
  }

  return queue.map(({ payload: { id }, type }, i) => {
    return `${i + 1}: ${type} - [pull-${id}](https://github.com/${
      process.env.GITHUB_ORIGIN_USER
    }/${process.env.GITHUB_ORIGIN_REPO}/pull/${id})`;
  });
};
