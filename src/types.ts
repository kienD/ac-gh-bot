export type Action = {
  name: string;
  payload: {
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
