export interface IGetAppsURLOpts {
  orgId?: string;
  clientId?: string;
}

export interface IApiV3Headers {
  'Content-Type': string;
  authorization: string;
}

interface IJSONApi {
  version: string;
}

export interface ICreateAppRes {
  jsonapi: IJSONApi;
  data: {
    type: string;
    id: string;
    attributes: {
      name: string;
      clientId: string;
      redirectUris: string[];
      scopes: string[];
      isPublic: boolean;
      clientSecret: string;
    };
    links: {
      self: string;
    };
  };
}

export interface IV3ErrorResponse {
  jsonapi: IJSONApi;
  errors: [
    {
      status: string;
      detail: string;
      source?: any;
      meta?: any;
    },
  ];
}
