import React from 'react';
import ReactDOM from 'react-dom';
import {act, Simulate} from 'react-dom/test-utils';
import BackupForm from './BackupForm';
import * as util from './lib/util';
import * as walletd from './lib/walletd';

jest.mock('./lib/walletFile', () => ({
  readWalletRecoveryPhrase: jest.fn().mockResolvedValue(null),
  readWalletBackup: jest.fn(),
  verifyWalletPassword: jest.fn(),
}));

const walletFile = require('./lib/walletFile');

describe('BackupForm', () => {
  let container: HTMLDivElement;
  const wallet = {
    getWalletInfo: jest.fn(),
  } as unknown as walletd.Walletd;

  beforeEach(() => {
    container = document.createElement('div');
    wallet.getWalletInfo = jest.fn().mockResolvedValue({mnemonic: ''});
    walletFile.readWalletRecoveryPhrase.mockResolvedValue(null);
    walletFile.verifyWalletPassword.mockResolvedValue(undefined);
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
  });

  it('unlocks encrypted wallet-file backup when no mnemonic is available', async () => {
    await act(async () => {
      ReactDOM.render(
        <util.WalletContext.Provider value={wallet}>
          <BackupForm
            viewOnly={false}
            isNew={false}
            initialMnemonic=''
            initialMnemonicHidden={true}
            onInitialMnemonicHiddenChange={jest.fn()}
            recoveryPhraseStorageError=''
            walletFileName='test-wallet.wallet.memory'
          />
        </util.WalletContext.Provider>,
        container,
      );
    });

    act(() => {
      Simulate.click(container.querySelector('button') as HTMLButtonElement);
    });
    const passwordInput = container.querySelector('#backup-wallet-password') as HTMLInputElement;
    act(() => {
      passwordInput.value = 'correct-password';
      Simulate.change(passwordInput);
    });

    await act(async () => {
      Simulate.submit(container.querySelector('#backup-password-form') as HTMLFormElement);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(walletFile.verifyWalletPassword).toHaveBeenCalledWith(
      'test-wallet.wallet.memory',
      'correct-password',
    );
    expect(wallet.getWalletInfo).toHaveBeenCalledWith({need_secrets: true});
    expect(container.querySelector('#backup-password-form')).toBeNull();
    expect(container.textContent).toContain('No recovery phrase was found in the wallet or saved browser data.');
    expect(container.textContent).toContain('A wallet password can unlock the encrypted wallet, but it cannot recreate a missing recovery phrase.');
    expect(container.textContent).not.toContain('Copy phrase');
    expect(container.textContent).not.toContain('Download phrase');
    expect(container.textContent).toContain('Download mywallet.wallet');
  });

  it('shows a phrase saved with the wallet password after unlocking', async () => {
    const savedPhrase = 'alpha bravo charlie delta';
    walletFile.readWalletRecoveryPhrase.mockResolvedValue(savedPhrase);

    await act(async () => {
      ReactDOM.render(
        <util.WalletContext.Provider value={wallet}>
          <BackupForm
            viewOnly={false}
            isNew={false}
            initialMnemonic=''
            initialMnemonicHidden={true}
            onInitialMnemonicHiddenChange={jest.fn()}
            recoveryPhraseStorageError=''
            walletFileName='test-wallet.wallet.memory'
          />
        </util.WalletContext.Provider>,
        container,
      );
    });

    act(() => {
      Simulate.click(container.querySelector('button') as HTMLButtonElement);
    });
    const passwordInput = container.querySelector('#backup-wallet-password') as HTMLInputElement;
    act(() => {
      passwordInput.value = 'correct-password';
      Simulate.change(passwordInput);
    });

    await act(async () => {
      Simulate.submit(container.querySelector('#backup-password-form') as HTMLFormElement);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const phraseElement = container.querySelector('[aria-label="Wallet recovery phrase"]');
    expect(phraseElement && phraseElement.textContent).toBe(savedPhrase);
    expect(container.textContent).toContain('Copy phrase');
    expect(container.textContent).toContain('Download phrase');
    expect(container.textContent).toContain('Download mywallet.wallet');
  });
});
