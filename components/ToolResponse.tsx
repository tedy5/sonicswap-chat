'use client';

import { memo } from 'react';
import { formatUnits, maxUint256 } from 'viem';
import { AddTokenButton } from '@/components/AddTokenButton';
import { ApproveButton } from '@/components/ApproveButton';
import { BridgeButton } from '@/components/BridgeButton';
import { MarkdownContent } from '@/components/MarkdownContent';
import { Card } from '@/components/ui/card';
import { ASSISTANT_CONTRACT_ADDRESS } from '@/config/contracts';
import { AddTokenResult, BridgeSuccessResult, BridgeToolArgs, SwapQuoteResult, SystemResult, type ToolResponseProps } from '@/types/tools';
import type { DepositResult } from '@/types/tools';
import { getChainName } from '@/utils/chains';
import { DepositButton } from './DepositButton';

const getTimeDisplay = (seconds: number): string => {
  if (seconds < 60) {
    return `~${Math.ceil(seconds)} seconds`;
  }
  return `~${Math.floor(seconds / 60)} minutes`;
};

const formatFixedFee = (amount: string, decimals: number, symbol: string): string => {
  const value = Number(formatUnits(BigInt(amount), decimals));

  // Define max decimals based on symbol
  const maxDecimals =
    {
      ETH: 3,
      AVAX: 2,
      BNB: 3,
      MATIC: 1,
      SOL: 3,
      NEON: 2,
      xDAI: 0,
      METIS: 2,
      BROCK: 0,
      S: 0,
      XFI: 0,
      zkCRO: 0,
      BERA: 2,
      FTM: 0,
    }[symbol] ?? 4; // default to 4 decimals if symbol not found

  // Format with fixed decimals
  const formattedValue = value.toFixed(maxDecimals);

  // Only trim trailing zeros after the decimal point
  const trimmedValue = formattedValue.replace(/\.?0+$/, (match) => (match.includes('.') ? '' : match));

  return `${trimmedValue} ${symbol}`;
};

const formatTokenAmount = (amount: string, decimals: number, symbol: string): string => {
  const formattedNumber = Number(formatUnits(BigInt(amount), decimals));
  const isWholeNumber = formattedNumber % 1 === 0;
  return `${isWholeNumber ? formattedNumber.toString() : formattedNumber.toFixed(4)} ${symbol}`;
};

function ToolResponseBase({ toolInvocation }: ToolResponseProps) {
  console.log('🛠️ Tool Invocation:', {
    state: toolInvocation.state,
    step: toolInvocation.step,
    toolName: toolInvocation.toolName,
    args: toolInvocation.args,
    ...(toolInvocation.state === 'result' && { result: toolInvocation.result }),
  });

  const { toolName, args, result } = toolInvocation;

  if (!result || (result as SystemResult).type === 'system') {
    return null;
  }

  switch (toolName) {
    case 'bridge': {
      const bridgeResult = result as BridgeSuccessResult;
      const { estimation, approximateDelay, srcChainNativeSymbol, nativeTokenPrice, tx, srcChainId, dstChainId, fixFee, message } =
        bridgeResult;

      const { srcChainTokenIn, dstChainTokenOut } = estimation;

      // Calculate solver gas costs
      const solverGasCosts = formatTokenAmount(
        srcChainTokenIn.approximateOperatingExpense,
        srcChainTokenIn.decimals,
        srcChainTokenIn.symbol
      );

      const solverGasCostsUsd =
        Number(formatUnits(BigInt(srcChainTokenIn.approximateOperatingExpense), srcChainTokenIn.decimals)) *
        (srcChainTokenIn.approximateUsdValue / Number(bridgeResult.amount));

      const deBridgeFee = formatFixedFee(fixFee, 18, srcChainNativeSymbol);
      const deBridgeFeeUsd = Number(formatUnits(BigInt(fixFee), 18)) * nativeTokenPrice;

      return (
        <div className="space-y-4">
          <Card className="mb-5 rounded-2xl rounded-bl-sm bg-card px-4 py-3">
            <div className="text-base">{message}</div>
          </Card>

          <Card className="mt-4 w-96 rounded-tl-sm p-4">
            <div className="text-base font-medium">Bridge Details</div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="font-medium">You send</div>
                <div className="text-right">
                  <div>{formatTokenAmount(srcChainTokenIn.amount, srcChainTokenIn.decimals, srcChainTokenIn.symbol)}</div>
                  <div className="text-xs text-muted-foreground">≈ ${srcChainTokenIn.approximateUsdValue.toFixed(2)}</div>
                </div>
              </div>

              <div className="flex items-center justify-between border-b pb-3">
                <div className="font-medium">You receive</div>
                <div className="text-right">
                  <div>{formatTokenAmount(dstChainTokenOut.recommendedAmount, dstChainTokenOut.decimals, dstChainTokenOut.symbol)}</div>
                  <div className="text-xs text-muted-foreground">≈ ${dstChainTokenOut.approximateUsdValue.toFixed(2)}</div>
                </div>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Solver gas costs</span>
                  <div className="text-right">
                    <div>
                      <span className="text-primary">{solverGasCosts}</span>{' '}
                      <span className="text-xs">~${solverGasCostsUsd.toFixed(4)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span>deBridge Fee</span>
                  <div className="text-right">
                    <div>
                      <span className="text-primary">{deBridgeFee}</span> <span className="text-xs">~${deBridgeFeeUsd.toFixed(4)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <span>Total spent</span>
                  <div className="text-right">
                    <div>
                      <span className="font-medium text-primary">
                        {srcChainTokenIn.symbol === srcChainNativeSymbol ? (
                          // If both are native tokens, combine the amounts
                          formatFixedFee(
                            (
                              BigInt(srcChainTokenIn.amount) * BigInt(10) ** BigInt(18 - srcChainTokenIn.decimals) +
                              BigInt(fixFee)
                            ).toString(),
                            18,
                            srcChainNativeSymbol
                          )
                        ) : (
                          // Otherwise show both separately
                          <>
                            {formatTokenAmount(srcChainTokenIn.amount, srcChainTokenIn.decimals, srcChainTokenIn.symbol)}
                            {' + '}
                            {formatFixedFee(fixFee, 18, srcChainNativeSymbol)}
                          </>
                        )}
                      </span>{' '}
                      <span className="text-xs">~${(srcChainTokenIn.approximateUsdValue + deBridgeFeeUsd).toFixed(4)}</span>
                    </div>
                  </div>
                </div>

                {approximateDelay && (
                  <div className="flex justify-between">
                    <span>Estimated time</span>
                    <span>{getTimeDisplay(approximateDelay)}</span>
                  </div>
                )}
              </div>
            </div>
            {tx && (
              <div className="mt-4 border-t pt-2">
                <BridgeButton
                  srcChainId={srcChainId}
                  dstChainId={dstChainId}
                  data={tx}
                  messageId={toolInvocation.toolCallId}
                  tokenIn={{
                    address: srcChainTokenIn.address,
                    chainId: (args as BridgeToolArgs).srcChainId,
                    symbol: srcChainTokenIn.symbol,
                    decimals: srcChainTokenIn.decimals,
                  }}
                  tokenOut={{
                    address: dstChainTokenOut.address,
                    chainId: (args as BridgeToolArgs).dstChainId,
                    symbol: dstChainTokenOut.symbol,
                    decimals: dstChainTokenOut.decimals,
                  }}
                  amount={srcChainTokenIn.amount}
                />
              </div>
            )}
          </Card>
        </div>
      );
    }

    case 'addToken': {
      const result = toolInvocation.result as AddTokenResult;
      if ('type' in result) return null;

      const { chainId, tokenAddress, symbol, decimals, message } = result;
      return (
        <div className="space-y-4">
          <Card className="mb-5 rounded-2xl rounded-tl-sm bg-card px-4 py-3">
            <div className="text-base">{message}</div>
          </Card>

          <Card className="w-96 rounded-tl-sm p-4">
            <div className="text-base font-medium">Add Token to Wallet</div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="font-medium">Token</div>
                <div className="text-right">
                  <div className="flex flex-col items-end">
                    <div className="group/tooltip relative">
                      <span className="underline decoration-dotted underline-offset-2">{symbol}</span>
                      <div className="invisible absolute bottom-full right-0 z-50 mb-2 w-[400px] rounded-lg bg-slate-700/80 p-4 text-sm text-white shadow-lg backdrop-blur-sm group-hover/tooltip:visible">
                        <div>
                          <p className="mb-1 text-left font-semibold text-gray-300">Contract Address:</p>
                          <p className="text-left font-medium text-white">{tokenAddress}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-b pb-3">
                <div className="font-medium">Network</div>
                <div>{getChainName(chainId)}</div>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Decimals</span>
                  <span>{decimals}</span>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <AddTokenButton
                chainId={chainId}
                tokenAddress={tokenAddress}
                tokenSymbol={symbol}
                tokenDecimals={decimals}
              />
            </div>
          </Card>
        </div>
      );
    }

    case 'getQuote': {
      const result = toolInvocation.result as SwapQuoteResult;

      if (!result.needsApproval) {
        return null;
      }

      return (
        <div className="space-y-4">
          <Card className="mb-5 rounded-2xl rounded-bl-sm bg-card px-4 py-3">
            <div className="text-base">{result.content}</div>
          </Card>
          <Card className="w-96 rounded-tl-sm p-4">
            <div className="mb-7 text-base font-medium">Token Approval Required</div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="font-medium">Token</div>
                <div>{result.needsApproval.symbol}</div>
              </div>

              <div className="flex items-center justify-between border-b pb-3">
                <div className="font-medium">Amount</div>
                <div>{formatTokenAmount(result.needsApproval.amount, result.needsApproval.decimals, result.needsApproval.symbol)}</div>
              </div>

              <div className="mt-4 space-y-2">
                <p>Choose approval type:</p>
                <div className="flex gap-2">
                  <div className="w-1/2">
                    <ApproveButton
                      fromAddress={result.needsApproval.fromAddress}
                      toAddress={result.needsApproval.toAddress}
                      spender={ASSISTANT_CONTRACT_ADDRESS}
                      amount={result.needsApproval.amount}
                      symbol={result.needsApproval.symbol}
                      decimals={result.needsApproval.decimals}
                    />
                  </div>
                  <div className="w-1/2">
                    <ApproveButton
                      fromAddress={result.needsApproval.fromAddress}
                      toAddress={result.needsApproval.toAddress}
                      spender={ASSISTANT_CONTRACT_ADDRESS}
                      amount={maxUint256.toString()}
                      symbol={result.needsApproval.symbol}
                      decimals={result.needsApproval.decimals}
                      isMaxApproval
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    case 'deposit': {
      const result = toolInvocation.result as DepositResult;

      return (
        <div className="space-y-4">
          {/* Always show the content card if it exists */}
          {result.content && (
            <Card className="rounded-bl-sm p-4">
              <div className="text-base">
                <MarkdownContent content={result.content} />
              </div>
            </Card>
          )}

          {/* Show deposit card if deposit data exists */}
          {result.deposit && (
            <Card className="w-96 rounded-tl-sm p-4">
              <div className="mb-7 text-base font-medium">Deposit Details</div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="font-medium">Token</div>
                  <div>{result.deposit.symbol}</div>
                </div>

                <div className="flex items-center justify-between border-b pb-3">
                  <div className="font-medium">Amount</div>
                  <div>{formatTokenAmount(result.deposit.amount, result.deposit.decimals, result.deposit.symbol)}</div>
                </div>

                <div className="mt-4">
                  {result.needsApproval ? (
                    <div className="space-y-2">
                      <p>Choose approval type:</p>
                      <div className="flex gap-2">
                        <div className="w-1/2">
                          <ApproveButton
                            fromAddress={result.needsApproval.fromAddress}
                            toAddress={result.needsApproval.toAddress}
                            spender={ASSISTANT_CONTRACT_ADDRESS}
                            amount={result.needsApproval.amount}
                            symbol={result.needsApproval.symbol}
                            decimals={result.needsApproval.decimals}
                          />
                        </div>
                        <div className="w-1/2">
                          <ApproveButton
                            fromAddress={result.needsApproval.fromAddress}
                            toAddress={result.needsApproval.toAddress}
                            spender={ASSISTANT_CONTRACT_ADDRESS}
                            amount={maxUint256.toString()}
                            symbol={result.needsApproval.symbol}
                            decimals={result.needsApproval.decimals}
                            isMaxApproval
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <DepositButton
                      token={result.deposit.token}
                      amount={result.deposit.amount}
                      isNative={result.deposit.isNative}
                    />
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}

export const ToolResponse = memo(ToolResponseBase, (prevProps, nextProps) => {
  return (
    prevProps.toolInvocation.state === nextProps.toolInvocation.state &&
    prevProps.toolInvocation.toolCallId === nextProps.toolInvocation.toolCallId &&
    prevProps.toolInvocation.step === nextProps.toolInvocation.step &&
    JSON.stringify(prevProps.toolInvocation.result) === JSON.stringify(nextProps.toolInvocation.result)
  );
});
