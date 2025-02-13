'use client';

import { formatUnits } from 'viem';
import { BridgeButton } from '@/components/BridgeButton';
import { TypingIndicator } from '@/components/TypingIndicator';
import { Card } from '@/components/ui/card';
import type { BridgeSuccessResult, BridgeToolArgs, SystemResult, ToolResponseProps } from '@/types/tools';

function getTimeDisplay(seconds: number): string {
  if (seconds < 60) {
    return `~${Math.ceil(seconds)} seconds`;
  }
  return `~${Math.floor(seconds / 60)} minutes`;
}

function formatFixedFee(amount: string, decimals: number, symbol: string): string {
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
}

function formatTokenAmount(amount: string, decimals: number, symbol: string): string {
  const formattedNumber = Number(formatUnits(BigInt(amount), decimals));
  const isWholeNumber = formattedNumber % 1 === 0;
  return `${isWholeNumber ? formattedNumber.toString() : formattedNumber.toFixed(4)} ${symbol}`;
}

export function ToolResponse({ toolInvocation }: ToolResponseProps) {
  const { toolName, args, result, state } = toolInvocation;

  if (!result && state === 'call') {
    return <TypingIndicator />;
  }

  if (!result || (result as SystemResult).type === 'system') {
    return null;
  }

  switch (toolName) {
    case 'bridge': {
      const bridgeResult = result as BridgeSuccessResult;
      const { estimation, approximateDelay, srcChainNativeSymbol, nativeTokenPrice, tx, srcChainId, dstChainId, fixFee } = bridgeResult;

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
        <Card className="mt-4 min-w-96 rounded-tl-sm p-4">
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
                    <span className="text-primary">{solverGasCosts}</span> <span className="text-xs">~${solverGasCostsUsd.toFixed(4)}</span>
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
                  <span>{getTimeDisplay(approximateDelay + 60)}</span>
                </div>
              )}
            </div>
          </div>
          {tx && (
            <div className="mt-4">
              <BridgeButton
                srcChainId={srcChainId}
                dstChainId={dstChainId}
                message="Bridge tokens"
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
      );
    }

    case 'resolveChain': {
      const { chainId } = result as { chainId: number };
      return <div className="mt-2 text-xs text-muted-foreground">Resolved chain ID: {chainId}</div>;
    }

    default:
      return null;
  }
}
