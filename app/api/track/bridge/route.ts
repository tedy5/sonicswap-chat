import { formatUnits } from 'viem';
import { checkAuth } from '@/app/actions/auth';
import { supabase } from '@/supabase/server';
import type { BridgeRequestBody, BridgeStatus } from '@/types/bridge';
import { isDLNError, type DLNResponse, type DLNValue } from '@/types/dln';
import type { Database } from '@/types/supabase';
import { getBridgeToChainId } from '@/utils/chainId';
import { getChainName } from '@/utils/chains';
import { getExplorerInfo, getExplorerUrl } from '@/utils/explorer';
import { getTokenDecimals } from '@/utils/tokenDecimals';
import { waitForTransaction } from '@/utils/transactionUtils';
import { sendStreamUpdate } from '@/utils/update-stream';

type InsertBridgeTransaction = Database['public']['Tables']['bridge_transactions']['Insert'];
type UpdateBridgeTransaction = Database['public']['Tables']['bridge_transactions']['Update'];

const activePolls = new Map<string, boolean>();

async function pollBridgeStatus(bridgeStatus: BridgeStatus, txVerified = false) {
  try {
    const srcExplorer = getExplorerInfo(bridgeStatus.tokenIn.chainId);
    const srcExplorerUrl = getExplorerUrl(bridgeStatus.tokenIn.chainId, bridgeStatus.txHash);

    // Only verify transaction once
    if (!txVerified) {
      const { success, error } = await waitForTransaction(bridgeStatus.tokenIn.chainId, bridgeStatus.txHash);

      if (error) {
        console.error('Error verifying transaction:', error);
      }

      if (!success) {
        const { error: updateError } = await supabase
          .from('bridge_transactions')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
          })
          .eq('source_tx_hash', bridgeStatus.txHash);

        if (updateError) {
          console.error('Error updating bridge status:', updateError);
        }

        await sendStreamUpdate(
          bridgeStatus.userId,
          `Inform user that transaction failed and offer assistance. [View on ${srcExplorer.name}](${srcExplorerUrl})\n`
        );
        return;
      }
      // Add initial notification when transaction is submitted
      await sendStreamUpdate(
        bridgeStatus.userId,
        `Inform user that transaction have been successfully submitted and that you are monitoring the progress and will update on progress\n\n` +
          `[View on ${srcExplorer.name}](${srcExplorerUrl})\n`
      );
    }

    const txResponse = await fetch(`${process.env.DLN_STATS_API_URL}/Transaction/${bridgeStatus.txHash}/orderIds`);
    const { orderIds } = (await txResponse.json()) as { orderIds: DLNValue[] };

    if (!txResponse.ok) {
      console.error('DLN API error:', await txResponse.text());
      setTimeout(() => pollBridgeStatus(bridgeStatus, true), 10000);
      return;
    }

    if (!orderIds?.length) {
      console.log('No order IDs found yet, will retry...');
      setTimeout(() => pollBridgeStatus(bridgeStatus, true), 10000);
      return;
    }

    const orderId = orderIds[0].stringValue;
    const orderResponse = await fetch(`${process.env.DLN_STATS_API_URL}/Orders/${orderId}`);
    const orderData = (await orderResponse.json()) as DLNResponse;

    // Check for error response first
    if (isDLNError(orderData)) {
      console.log('Order not found yet, will retry...', orderData);
      setTimeout(() => pollBridgeStatus(bridgeStatus, true), 10000);
      return;
    }

    console.log('Full order data:', JSON.stringify(orderData, null, 2));
    console.log('giveOfferWithMetadata:', orderData.giveOfferWithMetadata);
    console.log('takeOfferWithMetadata:', orderData.takeOfferWithMetadata);

    // Now TypeScript knows exactly what properties are available
    const tokenIn = orderData.giveOfferWithMetadata;
    const tokenOut = orderData.takeOfferWithMetadata;
    const status = orderData.state;

    if (!tokenIn.tokenAddress || !tokenOut.tokenAddress) {
      console.log('Missing tokenAddress:', {
        tokenInAddress: tokenIn.tokenAddress,
        tokenOutAddress: tokenOut.tokenAddress,
      });
    }

    const bridgeChainId = parseInt(tokenOut.chainId.stringValue);
    const dstChainId = getBridgeToChainId(bridgeChainId);
    const dstTxHash = orderData.fulfilledDstEventMetadata?.transactionHash?.stringValue;
    const dstExplorer = getExplorerInfo(dstChainId);
    const dstExplorerUrl = getExplorerUrl(dstChainId, dstTxHash);
    const deBridgeExplorerUrl = `${process.env.DLN_EXPLORER_URL}/order?orderId=${orderId}`;
    let newStatus: 'pending' | 'completed' | 'failed' = 'pending';
    let shouldNotifyUser = false;
    let message = '';

    switch (status) {
      case 'Fulfilled':
      case 'SentUnlock':
      case 'ClaimedUnlock':
        newStatus = 'completed';
        shouldNotifyUser = true;

        message =
          `Great news! Your bridge transaction is complete and the funds have arrived on the destination chain. You should see them in your wallet now!\n\n` +
          `Block Explorer: [View on ${dstExplorer.name}](${dstExplorerUrl})\n\n` +
          `deBridge Explorer: [View on deBridge](${deBridgeExplorerUrl})`;

        break;
      case 'OrderCancelled':
      case 'ClaimedOrderCancel':
      case 'Cancelled':
        newStatus = 'failed';
        shouldNotifyUser = true;

        message =
          `I'm sorry, but your bridge transaction has failed or been cancelled. You can find full detailed information on\n\n` +
          `[View on deBridge Explorer](${deBridgeExplorerUrl}) \n\n` +
          `where you can also request back your tokens in case they are stuck in a bridge`;

        break;
      default:
        newStatus = 'pending';
        break;
    }

    const { error: updateError } = await supabase
      .from('bridge_transactions')
      .update({
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
        destination_tx_hash: orderData.fulfilledDstEventMetadata?.transactionHash?.stringValue,
        unlock_tx_hash: orderData.claimedUnlockSrcEventInfo?.transactionMetadata?.transactionHash?.stringValue,
        order_id: orderId,
        state: status,
        external_call_state: orderData.externalCallState,
        percent_fee: orderData.percentFee?.bigIntegerValue || null,
        fix_fee: orderData.fixFee?.bigIntegerValue || null,
        source_block_number: orderData.createdSrcEventMetadata?.blockNumber || null,
        destination_block_number: orderData.fulfilledDstEventMetadata?.blockNumber || null,
        unlock_block_number: orderData.claimedUnlockSrcEventInfo?.transactionMetadata?.blockNumber || null,
        // Update token information if not already set
        token_in_address: tokenIn.tokenAddress.stringValue,
        token_in_chain_id: parseInt(tokenIn.chainId.stringValue),
        token_in_symbol: tokenIn.metadata.symbol,
        token_in_decimals: tokenIn.metadata.decimals,
        token_out_address: tokenOut.tokenAddress.stringValue,
        token_out_chain_id: parseInt(tokenOut.chainId.stringValue),
        token_out_symbol: tokenOut.metadata.symbol,
        token_out_decimals: tokenOut.metadata.decimals,
      } satisfies UpdateBridgeTransaction)
      .eq('source_tx_hash', bridgeStatus.txHash);

    if (updateError) {
      console.error('Error updating bridge status:', updateError);
    }

    if (shouldNotifyUser) {
      await sendStreamUpdate(bridgeStatus.userId, message);
    }

    if (newStatus === 'pending') {
      await new Promise((resolve) => setTimeout(resolve, 30000));
      return pollBridgeStatus(bridgeStatus, true);
    }
  } catch (error) {
    console.error('Error polling bridge status:', error);
    await new Promise((resolve) => setTimeout(resolve, 60000));
    return pollBridgeStatus(bridgeStatus, txVerified);
  }
}

export async function POST(req: Request) {
  const session = await checkAuth();
  if (!session?.address) {
    return new Response('Not authenticated', { status: 401 });
  }

  try {
    const body = (await req.json()) as BridgeRequestBody;
    const txHash = body.txHash;

    if (activePolls.get(txHash)) {
      return new Response(JSON.stringify({ success: true, message: 'Already tracking' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (body.error) {
      const { tokenIn, tokenOut, amount, errorMessage } = body;
      const decimals = await getTokenDecimals(tokenIn.chainId, tokenIn.address);
      const amountWithDecimals = formatUnits(BigInt(amount), decimals).toString();
      const fromChain = getChainName(tokenIn.chainId);
      const toChain = getChainName(tokenOut.chainId);

      const context = `The user attempted to bridge ${amountWithDecimals} ${tokenIn.symbol} from chain ${fromChain} to chain ${toChain}, but the transaction was rejected or failed. The error was: ${errorMessage}. Please provide short and helpful response about the failed transaction and offer assistance.`;

      await sendStreamUpdate(session.userId, context);

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { tokenIn, tokenOut, amount } = body;

    const { data: bridgeData, error: insertError } = await supabase
      .from('bridge_transactions')
      .insert({
        user_id: session.userId,
        amount,
        status: 'pending',
        source_tx_hash: txHash,
        token_in_address: tokenIn?.address ?? null,
        token_in_chain_id: tokenIn?.chainId ?? null,
        token_in_symbol: tokenIn?.symbol ?? null,
        token_in_decimals: tokenIn?.decimals ?? null,
        token_out_address: tokenOut?.address ?? null,
        token_out_chain_id: tokenOut?.chainId ?? null,
        token_out_symbol: tokenOut?.symbol ?? null,
        token_out_decimals: tokenOut?.decimals ?? null,
        created_at: new Date().toISOString(),
      } satisfies InsertBridgeTransaction)
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    activePolls.set(txHash, true);

    // Start polling for status updates
    pollBridgeStatus({
      txHash,
      userId: session.userId,
      tokenIn,
      status: 'pending',
    }).finally(() => {
      // Clean up when polling is done
      activePolls.delete(txHash);
    });

    return new Response(JSON.stringify({ success: true, data: bridgeData }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error tracking bridge:', error);
    return new Response(JSON.stringify({ error: 'Failed to track bridge transaction' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
