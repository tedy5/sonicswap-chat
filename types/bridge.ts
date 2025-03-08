export interface Token {
  address: string;
  chainId: number;
  symbol: string;
  decimals: number;
}

export interface TransactionData {
  to: `0x${string}`;
  data: string;
  value?: string;
  allowanceTarget?: string;
}

export interface BridgeButtonProps {
  srcChainId: number;
  dstChainId: number;
  data: TransactionData;
  messageId?: string;
  tokenIn: Token;
  tokenOut: Token;
  amount: string;
}

export interface BridgeStatus {
  txHash: string;
  userId: string;
  status: 'pending' | 'completed' | 'failed';
  tokenIn: Token;
}

export interface BridgeRequestBody {
  txHash: string;
  error?: boolean;
  tokenIn: Token;
  tokenOut: Token;
  amount: string;
  errorMessage?: string;
}
