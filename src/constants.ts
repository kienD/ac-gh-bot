import path from 'path';

export enum ActionTypes {
    Hotfix = 'hotfix',
    Patch = 'patch',
    Ping = 'ping',
}

export enum HotfixStates {
    Failed = 'Hotfix Failed',
    InProgress = 'Hotfix in Progress',
    Success = 'Hotfix Completed',
}

export enum PatchStates {
    Failed = 'Patch Failed',
    InProgress = 'Patch in Progress',
    Success = 'Patch Completed',
}

export enum RequestMethods {
    Get = 'GET',
    Patch = 'PATCH',
    Post = 'POST',
}

export const ACTIONS_PATH_MAP = {
    [ActionTypes.Hotfix]: path.resolve(__dirname, 'actions/hotfix.js'),
    [ActionTypes.Patch]: path.resolve(__dirname, 'actions/patch.js'),
    [ActionTypes.Ping]: path.resolve(__dirname, 'actions/ping.js'),
};
