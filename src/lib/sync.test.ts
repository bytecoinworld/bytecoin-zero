import {
  getRememberedWalletAddressCount,
  isDaemonVersionIncompatible,
  rememberWalletAddressCount,
} from './sync';

describe('isDaemonVersionIncompatible', () => {
  it('detects an incompatible daemon reported by the node', () => {
    expect(isDaemonVersionIncompatible({
      lowerLevelError: 'INCOMPATIBLE_DAEMON_VERSION',
      connectionError: '',
    })).toBe(true);
  });

  it('detects an unsupported versioned sync method', () => {
    expect(isDaemonVersionIncompatible({
      lowerLevelError: 'Method not found sync_blocks_v3.5.2',
      connectionError: '',
    })).toBe(true);
  });

  it('does not classify a regular transport error as a version mismatch', () => {
    expect(isDaemonVersionIncompatible({
      lowerLevelError: '',
      connectionError: 'HTTP status 503',
    })).toBe(false);
  });
});

describe('remembered wallet address count', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });


  it('returns zero when no count has been saved', () => {
    expect(getRememberedWalletAddressCount('wallet.file')).toBe(0);
  });

  it('stores the greatest known address count for a wallet', () => {
    rememberWalletAddressCount('wallet.file', 3);
    rememberWalletAddressCount('wallet.file', 2);

    expect(getRememberedWalletAddressCount('wallet.file')).toBe(3);
  });

  it('rejects invalid stored counts', () => {
    window.localStorage.setItem('bytecoin-zero-address-count:wallet.file', 'not-a-count');

    expect(() => getRememberedWalletAddressCount('wallet.file')).toThrow(
      'The saved wallet address count is invalid.',
    );
  });
});
