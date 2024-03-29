import { ActionTypes } from './constants';

export type Action = {
  type: ActionTypes;
  payload: {
    admin: boolean;
    commentId?: number;
    id: number;
    params?: string[];
  };
};

export type Label = {
  color: string;
  default: boolean;
  description: string;
  id: number;
  name: string;
  node_id: string;
  url: string;
};

export type RequestHeaders = {
  accept?: string;
  authorization: string;
};
