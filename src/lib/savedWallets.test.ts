import {readSavedWallets} from './savedWallets';

jest.mock('@bcndev/bytecoin', () => ({
  checkAddressFormat: (address: string) => address.startsWith('bcn-test-'),
}));

describe('readSavedWallets', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns saved wallets ordered by most recently opened', () => {
    window.localStorage.setItem('wallet.bcn-test-first', JSON.stringify({
      'wallet-one': {viewOnly: false, lastOpen: 10},
      'wallet-two': {viewOnly: true, lastOpen: 30},
    }));
    window.localStorage.setItem('wallet.bcn-test-second', JSON.stringify({
      'wallet-three': {viewOnly: false, lastOpen: 20},
    }));
    window.localStorage.setItem('wallet.invalid-address', JSON.stringify({
      ignored: {viewOnly: false, lastOpen: 100},
    }));

    expect(readSavedWallets()).toEqual([
      {firstAddress: 'bcn-test-first', filename: 'wallet-two', viewOnly: true, lastOpen: 30},
      {firstAddress: 'bcn-test-second', filename: 'wallet-three', viewOnly: false, lastOpen: 20},
      {firstAddress: 'bcn-test-first', filename: 'wallet-one', viewOnly: false, lastOpen: 10},
    ]);
  });
});
