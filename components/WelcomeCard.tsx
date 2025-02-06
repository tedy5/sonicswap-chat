import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function WelcomeCard() {
  return (
    <div className="mb-10 ml-0 mr-auto mt-10 max-w-xl">
      <Card className="rounded-bl-none">
        <CardHeader>
          <CardTitle>Welcome to SonicSwap AI Assistant 👋</CardTitle>
        </CardHeader>
        <CardContent className="prose text-sm leading-normal text-muted-foreground">
          <p className="mb-3">I&apos;m here to help you with token swaps and DeFi operations. Here&apos;s how you can interact with me:</p>
          <p className="mb-3">💱 Ask me to help you swap tokens (e.g., &quot;I want to swap 1 S to USDC&quot;)</p>
          <p className="mb-3">📊 Check token prices and market information</p>
          <p className="mb-3">❓ Get explanations about DeFi concepts and trading</p>
          <p className="mb-3">🔍 Review transaction details before confirming</p>
          <p className="mb-3">Just type your question or request naturally, and I&apos;ll guide you through the process!</p>
        </CardContent>
      </Card>
    </div>
  );
}
