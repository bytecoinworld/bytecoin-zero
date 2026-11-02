const {webcrypto} = require('crypto');
const {TextDecoder, TextEncoder} = require('util');
global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;
const WalletCrypto = require('../../public/bin/wallet-crypto');

describe('Bytecoin Zero wallet encryption', () => {
  it('encrypts wallet bytes and decrypts them only with the matching password and identifier', async () => {
    const original = new TextEncoder().encode('wallet contents');
    const encoder = WalletCrypto.createContext(webcrypto, 'x');
    const encrypted = await encoder.encrypt(original, 'wallet-id.wallet.memory');

    expect(WalletCrypto.isEncrypted(encrypted)).toBe(true);
    expect(WalletCrypto.getFilename(encrypted)).toBe('wallet-id.wallet.memory');
    await expect(encoder.decrypt(encrypted, 'wallet-id.wallet.memory')).resolves.toEqual(original);

    const wrongPassword = WalletCrypto.createContext(webcrypto, 'wrong');
    await expect(wrongPassword.decrypt(encrypted, 'wallet-id.wallet.memory'))
      .rejects.toThrow('The password is incorrect or the encrypted wallet file is damaged.');
    await expect(encoder.decrypt(encrypted, 'different-wallet.wallet.memory'))
      .rejects.toThrow('The encrypted wallet identifier does not match the stored wallet.');
  });

  it('uses a fresh nonce for every save while reusing the derived key', async () => {
    const context = WalletCrypto.createContext(webcrypto, 'p');
    const original = new TextEncoder().encode('wallet contents');
    const first = await context.encrypt(original, 'wallet-id.wallet.memory');
    const second = await context.encrypt(original, 'wallet-id.wallet.memory');

    expect(Array.from(first)).not.toEqual(Array.from(second));
    await expect(context.decrypt(second, 'wallet-id.wallet.memory')).resolves.toEqual(original);
  });
});
