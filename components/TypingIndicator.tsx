'use client';

import { Card } from '@/components/ui/card';

export function TypingIndicator() {
  return (
    <Card className="max-w-xl rounded-2xl rounded-tl-none bg-card px-4 py-2">
      <div className="flex space-x-2 p-2">
        <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]"></div>
        <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]"></div>
        <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"></div>
      </div>
    </Card>
  );
}
