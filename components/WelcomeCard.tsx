import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function WelcomeCard() {
  return (
    <div className="mb-10 ml-0 mr-auto mt-10 max-w-xl">
      <Card className="rounded-bl-none">
        <CardHeader>
          <CardTitle>Welcome to SonicSwap AI Trading Assistant 👋</CardTitle>
        </CardHeader>
        <CardContent className="prose text-sm leading-normal text-muted-foreground">
          <p className="mb-3">I&apos;m your DeFi Trading Assistant on Sonic Network. Here&apos;s how I can help you:</p>

          <p className="mb-2">
            💱 <strong>Token Swaps:</strong> &quot;Swap 1 S to USDC&quot;
          </p>

          <p className="mb-2">
            🌉 <strong>Bridge Tokens:</strong> &quot;Bridge 10 POL from Polygon to Sonic&quot;
          </p>

          <p className="mb-2">
            💰 <strong>Manage Contract Balance:</strong>
          </p>
          <p className="mb-2 ml-5">• Deposit: &quot;Deposit 5 S into the contract&quot;</p>
          <p className="mb-2 ml-5">• Withdraw: &quot;Withdraw my USDC from the contract&quot;</p>

          <p className="mb-2">
            📈 <strong>Limit Orders:</strong> &quot;Set a limit order to buy S at 0.45 USDC&quot;
          </p>

          <p className="mb-2">
            🔍 <strong>Market Analysis:</strong> &quot;Analyze S price trends&quot;
          </p>

          <p className="mb-2">
            ➕ <strong>Add Custom Tokens:</strong> &quot;Add USDC to my wallet&quot;
          </p>

          <p className="mt-4">Just type your request naturally, and I&apos;ll guide you through the process!</p>
        </CardContent>
      </Card>
    </div>
  );
}
