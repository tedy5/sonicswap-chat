// Error response type
export interface DLNErrorResponse {
  message: string;
  errorCode: number;
}

// Main DLN order response with discriminated union
export type DLNResponse = DLNOrderResponse | DLNErrorResponse;

// Basic value types from DLN API
export interface DLNValue {
  bytesValue?: string;
  bytesArrayValue?: string;
  stringValue: string;
  bigIntegerValue?: number;
  Base64Value?: string | null;
}

// Token metadata
export interface TokenMetadata {
  decimals: number;
  name: string;
  symbol: string;
  logoURI: string;
}

// Token offer structure
export interface TokenOffer {
  chainId: DLNValue;
  tokenAddress: DLNValue;
  amount: DLNValue;
  finalAmount: DLNValue;
  metadata: TokenMetadata;
  decimals: number;
  name: string;
  symbol: string;
  logoURI: string;
}

// Event metadata
export interface EventMetadata {
  transactionHash: DLNValue;
  blockNumber: number;
  blockHash: DLNValue;
  blockTimeStamp: number;
  initiator: DLNValue;
}

export interface PreswapData {
  chainId: DLNValue;
  inTokenAddress: DLNValue;
  inAmount: DLNValue;
  tokenInMetadata: TokenMetadata;
  outTokenAddress: DLNValue;
  outAmount: DLNValue;
  tokenOutMetadata: TokenMetadata;
}

// Main DLN order response
export interface DLNOrderResponse {
  orderId: DLNValue;
  makerOrderNonce: number;
  giveOfferWithMetadata: TokenOffer;
  takeOfferWithMetadata: TokenOffer;
  state: 'Fulfilled' | 'OrderCancelled' | 'ClaimedOrderCancel' | 'Cancelled' | 'SentUnlock' | 'ClaimedUnlock';
  externalCallState: string;
  percentFee: DLNValue;
  fixFee: DLNValue;
  createdSrcEventMetadata: EventMetadata;
  fulfilledDstEventMetadata: EventMetadata;
  claimedUnlockSrcEventInfo: {
    transactionMetadata: EventMetadata | null;
  };
  preswapData?: PreswapData;
}

export function isDLNError(response: DLNResponse): response is DLNErrorResponse {
  return 'errorCode' in response && 'message' in response;
}
