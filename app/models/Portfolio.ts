export interface IPortfolioResponse {
  [_id: string]: {
    portfoliValue?: string;
    tokenBalance: number;
    exchangeRate: string;
  };
}

export interface IPortfolioRequest {
  all?: boolean;
  date?: string;
  token?: string;
  sync?: boolean;
}
