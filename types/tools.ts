import { type Address } from 'viem';
import { type TransactionData } from '@/types/bridge';

// Base system result type
export interface SystemResult {
  type: 'system';
  message: 'error' | 'failed' | 'unauthenticated';
}

// Bridge-specific types
export interface TokenWithMetadata {
  address: Address;
  amount: string;
  decimals: number;
  symbol: string;
  approximateUsdValue: number;
  approximateOperatingExpense: string;
  recommendedAmount: string;
}

export interface BridgeEstimation {
  srcChainTokenIn: TokenWithMetadata;
  dstChainTokenOut: TokenWithMetadata;
}

export interface BridgeSystemResult {
  type: 'system';
  message: string;
}

export interface BridgeSuccessResult {
  type: 'bridge';
  estimation: BridgeEstimation;
  approximateDelay: number;
  srcChainNativeSymbol: string;
  nativeTokenPrice: number;
  tx: TransactionData;
  srcChainId: number;
  dstChainId: number;
  fixFee: string;
  amount: string;
}

// Add token types
export interface AddTokenToolArgs {
  chainId: number;
  token: string;
}

export interface AddTokenResult {
  chainId: number;
  tokenAddress: Address;
  symbol: string;
  decimals: number;
  message: string;
}

// Approval types
export interface ApprovalToolArgs {
  token: string;
  amount: string;
}

export interface ApprovalSuccessResult {
  token: Address;
  amount: string;
  symbol: string;
  decimals: number;
  spender: Address;
}

// Bridge tool args
export interface BridgeToolArgs {
  srcChainId: number;
  dstChainId: number;
}

export interface SwapQuoteToolArgs {
  fromToken: string;
  toToken: string;
  amount: string;
  useContract?: boolean;
}

export interface SwapQuoteResult {
  success: boolean;
  content: string;
  quote?: {
    expectedOutput: string;
    priceImpact: number;
    minOutputAmount: string;
  };
  needsApproval?: {
    fromAddress: Address;
    toAddress: Address;
    amount: string;
    symbol: string;
    decimals: number;
  };
  error?: string;
}

// Combined types for all tools
export type ToolArgs = {
  bridge: BridgeToolArgs;
  addToken: AddTokenToolArgs;
  approve: ApprovalToolArgs;
  getQuote: SwapQuoteToolArgs;
};

export type ToolResults = {
  bridge: BridgeSystemResult | BridgeSuccessResult;
  addToken: AddTokenResult | SystemResult;
  approve: ApprovalSuccessResult | SystemResult;
  getQuote: SwapQuoteResult;
};

// Tool invocation types
export interface ToolInvocation {
  toolName: keyof ToolResults | string;
  toolCallId: string;
  state: 'partial-call' | 'call' | 'result';
  step?: number;
  args: ToolArgs[keyof ToolArgs] | Record<string, any>;
  result?: ToolResults[keyof ToolResults] | Record<string, any>;
  content?: string;
}

export interface ToolResponseProps {
  toolInvocation: ToolInvocation;
}

// Type guards
export function isBridgeResult(result: ToolResults[keyof ToolResults]): result is BridgeSuccessResult {
  return 'type' in result && result.type === 'bridge';
}

export function isApprovalResult(result: ToolResults[keyof ToolResults]): result is ApprovalSuccessResult {
  return 'spender' in result && 'token' in result;
}

export function isAddTokenResult(result: ToolResults[keyof ToolResults]): result is AddTokenResult {
  return 'tokenAddress' in result && 'chainId' in result;
}

export function isSystemResult(result: ToolResults[keyof ToolResults]): result is SystemResult {
  return 'type' in result && result.type === 'system';
}
