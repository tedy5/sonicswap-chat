import { TransactionData } from '@/types/bridge';

export interface ToolInvocation {
  toolName: string;
  toolCallId: string;
  state: 'partial-call' | 'call' | 'result';
  step?: number;
  args: ToolArgs[keyof ToolArgs];
  result?: ToolResults[keyof ToolResults];
}

export interface TypedToolInvocation extends ToolInvocation {
  toolName: keyof ToolResults;
  args: ToolArgs[keyof ToolArgs];
  result?: ToolResults[keyof ToolResults];
}

export function isTypedToolInvocation(toolInvocation: ToolInvocation): toolInvocation is TypedToolInvocation {
  return ['bridge', 'showSwap', 'checkPrice', 'getCurrentPrice', 'resolveToken', 'resolveChain'].includes(
    toolInvocation.toolName
  );
}

export interface ToolResponseProps {
  toolInvocation: ToolInvocation;
}

// Token interface used across different tools
export interface Token {
  address: string;
  chainId: number;
  symbol: string;
  decimals: number;
}

export interface BridgeToolArgs {
  srcChainId: number;
  dstChainId: number;
}

// Tool-specific result types
export interface TokenWithMetadata extends Token {
  approximateOperatingExpense: string;
  approximateUsdValue: number;
  amount: string;
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

export type ToolArgs = {
  bridge: BridgeToolArgs;
  resolveChain: { chainId: number };
};

export type ToolResults = {
  showSwap: { result: { data: any } }; // Replace with specific data type
  checkPrice: { result: { formattedPrice: string } };

  bridge: BridgeSystemResult | BridgeSuccessResult;
  resolveChain: { chainId: number };
};

export interface SystemResult {
  type: 'system';
  message: 'error' | 'failed' | 'unauthenticated';
}

export type ToolResult = BridgeSuccessResult | SystemResult;
