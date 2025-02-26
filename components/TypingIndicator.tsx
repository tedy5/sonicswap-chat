'use client';

export function TypingIndicator() {
  return (
    <div className="flex space-x-2">
      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]"></div>
      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]"></div>
      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"></div>
    </div>
  );
}
