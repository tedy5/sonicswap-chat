import { ConnectButton } from '@rainbow-me/rainbowkit';

export function ConnectWallet() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        padding: 12,
      }}
    >
      <ConnectButton />
    </div>
  );
}
