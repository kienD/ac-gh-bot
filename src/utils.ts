import { execSync } from "child_process";

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
