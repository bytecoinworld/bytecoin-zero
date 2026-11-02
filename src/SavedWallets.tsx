// Copyright 2019 The Bytecoin developers.
// Licensed under the GNU Affero General Public License, version 3.

import React, {useState} from 'react';
import Avatar from './Avatar';
import Icon from './Icon';
import {ISavedWalletInfo, readSavedWallets} from './lib/savedWallets';
import * as util from './lib/util';
import {
  getWalletPasswordErrorMessage,
  isWalletFileEncrypted,
  verifyWalletPassword,
} from './lib/walletFile';
import styles from './css/SavedWallets.module.css';

const SavedWallets = React.memo((props: {
  onOpen: (filename: string, viewOnly: boolean, password: string) => Promise<void>;
}) => {
  const [wallets] = useState<ISavedWalletInfo[]>(readSavedWallets);
  const [openingFilename, setOpeningFilename] = useState('');
  const [openStatus, setOpenStatus] = useState('');
  const [selectedWallet, setSelectedWallet] = useState<ISavedWalletInfo | null>(null);
  const [encrypted, setEncrypted] = useState(false);
  const [walletPassword, setWalletPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');

  const selectWallet = async (wallet: ISavedWalletInfo) => {
    if (openingFilename) {
      return;
    }

    setOpeningFilename(wallet.filename);
    setOpenStatus('');
    try {
      setEncrypted(await isWalletFileEncrypted(wallet.filename));
      setSelectedWallet(wallet);
      setWalletPassword('');
      setPasswordConfirmation('');
    } catch (error) {
      console.warn('failed to inspect saved wallet encryption', error);
      setOpenStatus(`Could not read this wallet: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setOpeningFilename('');
    }
  };

  const openWallet = async (wallet: ISavedWalletInfo) => {
    if (openingFilename) {
      return;
    }
    if (!selectedWallet || selectedWallet.filename !== wallet.filename) {
      await selectWallet(wallet);
      return;
    }
    if (encrypted && walletPassword.length === 0) {
      setOpenStatus('Enter this wallet’s password.');
      return;
    }
    if (!encrypted && walletPassword !== passwordConfirmation) {
      setOpenStatus('The new passwords do not match.');
      return;
    }

    setOpeningFilename(wallet.filename);
    setOpenStatus('');
    try {
      if (encrypted) {
        await verifyWalletPassword(wallet.filename, walletPassword);
      }
      await props.onOpen(wallet.filename, wallet.viewOnly, walletPassword);
    } catch (error) {
      console.warn('failed to open a saved wallet', error);
      setOpenStatus(getWalletPasswordErrorMessage(error));
    } finally {
      setOpeningFilename('');
    }
  };

  return (
    <section className={styles.savedWallets} aria-labelledby='saved-wallets-title'>
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>ON THIS DEVICE</span>
          <h2 id='saved-wallets-title'>Saved wallets</h2>
          <p>Open a wallet previously used in this browser.</p>
        </div>
        <span className={styles.count}>{wallets.length}</span>
      </header>

      {wallets.length === 0 ?
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}><Icon name='wallet' size={22}/></span>
          <h3>No saved wallets yet</h3>
          <p>Wallets opened on this device will appear here.</p>
        </div> :
        <div className={styles.walletList}>
          {wallets.map((wallet) =>
            <article key={wallet.filename} className={styles.walletCard}>
              <div className={styles.avatar}><Avatar message={wallet.firstAddress}/></div>
              <div className={styles.walletInfo}>
                <div className={styles.walletHeading}>
                  <strong>{wallet.viewOnly ? 'View-only wallet' : 'Spend wallet'}</strong>
                  {wallet.viewOnly && <span className={styles.viewOnlyBadge}>View only</span>}
                </div>
                <code title={wallet.firstAddress}>{wallet.firstAddress}</code>
                <span className={styles.lastOpened}>
                  {wallet.lastOpen > 0 ? `Last opened ${util.formatDateTime(new Date(wallet.lastOpen))}` : 'Not opened yet'}
                </span>
              </div>
              <button
                type='button'
                className={styles.openButton}
                disabled={!!openingFilename || (!!selectedWallet && selectedWallet.filename === wallet.filename)}
                onClick={() => void selectWallet(wallet)}
              >
                <Icon name='wallet' size={16}/>
                {openingFilename === wallet.filename ? 'Checking…' :
                  selectedWallet && selectedWallet.filename === wallet.filename ? 'Selected' : 'Open wallet'}
              </button>
              {selectedWallet && selectedWallet.filename === wallet.filename &&
                <form className={styles.unlockForm} onSubmit={(event) => {
                  event.preventDefault();
                  void openWallet(wallet);
                }}>
                  <label htmlFor={`saved-wallet-password-${wallet.filename}`}>
                    {encrypted ? 'Wallet password' : 'Set a password (optional)'}
                  </label>
                  <input
                    id={`saved-wallet-password-${wallet.filename}`}
                    type='password'
                    autoComplete={encrypted ? 'current-password' : 'new-password'}
                    value={walletPassword}
                    onChange={(event) => {
                      setWalletPassword(event.target.value);
                      setOpenStatus('');
                    }}
                    required={encrypted}
                    minLength={encrypted ? 1 : undefined}
                  />
                  {!encrypted && <>
                    <label htmlFor={`saved-wallet-password-confirm-${wallet.filename}`}>Confirm new password</label>
                    <input
                      id={`saved-wallet-password-confirm-${wallet.filename}`}
                      type='password'
                      autoComplete='new-password'
                      value={passwordConfirmation}
                      onChange={(event) => {
                        setPasswordConfirmation(event.target.value);
                        setOpenStatus('');
                      }}
                      minLength={walletPassword ? 1 : undefined}
                    />
                    <small>Leave both fields empty to keep this legacy wallet unencrypted. A password encrypts it when opened.</small>
                  </>}
                  <div className={styles.unlockActions}>
                    <button type='button' className={styles.cancelButton} onClick={() => {
                      setSelectedWallet(null);
                      setWalletPassword('');
                      setPasswordConfirmation('');
                      setOpenStatus('');
                    }}>Cancel</button>
                    <button type='submit' className={styles.openButton} disabled={!!openingFilename}>
                      {openingFilename === wallet.filename ? 'Opening…' : 'Continue'}
                    </button>
                  </div>
                </form>}
            </article>
          )}
        </div>}

      {openStatus && <p className={styles.openStatus} role='alert' aria-live='assertive'>{openStatus}</p>}
    </section>
  );
});

export default SavedWallets;
