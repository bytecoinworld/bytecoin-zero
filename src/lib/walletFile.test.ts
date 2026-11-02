import {
  decryptRecoveryPhrase,
  encryptRecoveryPhrase,
  getWalletPasswordErrorMessage,
  verifyWalletBackupPassword,
} from './walletFile';

const {webcrypto} = require('crypto');
const {TextDecoder, TextEncoder} = require('util');
const walletCrypto = require('../../public/bin/wallet-crypto');
global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;

describe('saved wallet password verification', () => {
  const filename = 'test-wallet.wallet.memory';

  beforeEach(() => {
    Object.defineProperty(window, 'crypto', {configurable: true, value: webcrypto});
    window.BytecoinWalletCrypto = walletCrypto;
  });

  it('accepts the password that encrypts the saved wallet', async () => {
    const context = walletCrypto.createContext(webcrypto, 'correct-password');
    const encrypted = await context.encrypt(new Uint8Array([1, 2, 3]), filename);

    await expect(verifyWalletBackupPassword(encrypted, filename, 'correct-password')).resolves.toBeUndefined();
  });

  it('rejects an incorrect password', async () => {
    const context = walletCrypto.createContext(webcrypto, 'correct-password');
    const encrypted = await context.encrypt(new Uint8Array([1, 2, 3]), filename);

    await expect(verifyWalletBackupPassword(encrypted, filename, 'incorrect-password'))
      .rejects.toThrow('The password is incorrect or the encrypted wallet file is damaged.');
  });

  it('does not accept an unencrypted wallet file', async () => {
    await expect(verifyWalletBackupPassword(new Uint8Array([1, 2, 3]), filename, 'any-password'))
      .rejects.toThrow('This wallet is not password-protected.');
  });

  it('encrypts recovery phrases so they can be retrieved only with the wallet password', async () => {
    const phrase = 'alpha bravo charlie delta';
    const encrypted = await encryptRecoveryPhrase(filename, phrase, 'correct-password');

    await expect(decryptRecoveryPhrase(filename, encrypted, 'correct-password')).resolves.toBe(phrase);
    await expect(decryptRecoveryPhrase(filename, encrypted, 'incorrect-password'))
      .rejects.toThrow('The password is incorrect or the encrypted wallet file is damaged.');
  });

  it('shows a clear retry message when wallet decryption fails', () => {
    expect(getWalletPasswordErrorMessage(new Error(
      'The password is incorrect or the encrypted wallet file is damaged.',
    ))).toBe('Incorrect password, or the encrypted wallet file is damaged. Check the password and try again.');
  });
});
