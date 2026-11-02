// Copyright 2019 The Bytecoin developers.
// Licensed under the GNU Affero General Public License, version 3.

import React, {useContext, useState} from 'react';
import * as util from './lib/util';
import Icon from './Icon';
import styles from './css/BackupForm.module.css';
import {readWalletBackup, readWalletRecoveryPhrase, verifyWalletPassword} from './lib/walletFile';

const BackupForm = React.memo((props: {
  viewOnly: boolean;
  isNew: boolean;
  initialMnemonic: string;
  initialMnemonicHidden: boolean;
  onInitialMnemonicHiddenChange: (hidden: boolean) => void;
  recoveryPhraseStorageError: string;
  walletFileName: string;
}) => {
  const wallet = useContext(util.WalletContext);
  const [mnemonic, setMnemonic] = useState(props.initialMnemonicHidden ? '' : props.initialMnemonic);
  const [backupUnlocked, setBackupUnlocked] = useState(!!props.initialMnemonic && !props.initialMnemonicHidden);
  const [mnemonicUnavailable, setMnemonicUnavailable] = useState(false);
  const [phraseLoadError, setPhraseLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [walletFileLoading, setWalletFileLoading] = useState(false);
  const [walletFileError, setWalletFileError] = useState('');
  const [walletFileStatus, setWalletFileStatus] = useState('');
  const [passwordFormOpen, setPasswordFormOpen] = useState(false);
  const [walletPassword, setWalletPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const loadMnemonic = async () => {
    setMnemonicUnavailable(false);
    setPhraseLoadError('');
    if (props.initialMnemonic) {
      setMnemonic(props.initialMnemonic);
      props.onInitialMnemonicHiddenChange(false);
      return;
    }

    if (!wallet) {
      setPhraseLoadError('The wallet is not ready to load a recovery phrase. You can still download its encrypted wallet backup.');
      return;
    }

    const [info, error] = await util.try_(wallet.getWalletInfo({need_secrets: true}));
    if (!info) {
      setPhraseLoadError(`Could not load the recovery phrase: ${error}`);
      return;
    }
    if (!info.mnemonic) {
      const savedMnemonic = await readWalletRecoveryPhrase(props.walletFileName, walletPassword);
      if (!savedMnemonic) {
        setMnemonicUnavailable(true);
        return;
      }
      setMnemonic(savedMnemonic);
      return;
    }
    setMnemonic(info.mnemonic);
  };

  const unlockBackup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) {
      return;
    }

    setLoading(true);
    setPasswordError('');
    try {
      await verifyWalletPassword(props.walletFileName, walletPassword);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : String(error));
      setWalletPassword('');
      setLoading(false);
      return;
    }

    setBackupUnlocked(true);
    setPasswordFormOpen(false);
    setWalletPassword('');
    try {
      await loadMnemonic();
    } catch (error) {
      setPhraseLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  const copyMnemonic = async () => {
    if (!navigator.clipboard) {
      alert('Clipboard access is unavailable in this browser. You can select and copy the phrase manually.');
      return;
    }
    try {
      await navigator.clipboard.writeText(mnemonic);
      alert('Recovery phrase copied. Clear your clipboard after saving it safely.');
    } catch (error) {
      console.warn('failed to copy recovery phrase', error);
      alert('Could not access the clipboard. You can select and copy the phrase manually.');
    }
  };

  const downloadMnemonic = () => {
    const file = new Blob([`Bytecoin Zero recovery phrase\n\n${mnemonic}\n\nKeep this phrase offline and private. Anyone who has it can access the wallet.\n`], {
      type: 'text/plain;charset=utf-8',
    });
    const url = window.URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bytecoin-recovery-phrase.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
  };

  const downloadWalletFile = async () => {
    if (!props.walletFileName || walletFileLoading) {
      return;
    }

    setWalletFileLoading(true);
    setWalletFileError('');
    setWalletFileStatus('');
    try {
      const data = await readWalletBackup(props.walletFileName);
      const file = new Blob([data], {type: 'application/octet-stream'});
      const url = window.URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mywallet.wallet';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
      setWalletFileStatus('Encrypted mywallet.wallet backup downloaded.');
    } catch (error) {
      console.warn('failed to download encrypted wallet backup', error);
      setWalletFileError(error instanceof Error ? error.message : String(error));
    } finally {
      setWalletFileLoading(false);
    }
  };

  const walletFileButton = (
    <button type='button' onClick={() => void downloadWalletFile()} disabled={!props.walletFileName || walletFileLoading}>
      <Icon name='download' size={16}/>{walletFileLoading ? 'Preparing wallet file…' : 'Download mywallet.wallet'}
    </button>
  );

  if (props.viewOnly) {
    return (
      <section className={styles.backup}>
        <h2>Recovery phrase</h2>
        <p>This view-only wallet does not contain a spend seed to back up.</p>
      </section>
    );
  }

  return (
    <section className={styles.backup}>
      <div className={styles.heading}>
        <div>
          <h2>{props.isNew ? 'Step 3: Back up your wallet' : 'Back up your wallet'}</h2>
          <p>{mnemonicUnavailable ?
            'No recovery phrase was found in the wallet or saved browser data.' :
            'Your recovery phrase is the only way to recover your wallet if you lose access to this device.'}</p>
        </div>
      </div>

      <div className={styles.warning} role='alert'>
        {mnemonicUnavailable ?
          'A wallet password can unlock the encrypted wallet, but it cannot recreate a missing recovery phrase. Keep the wallet backup and password safe.' :
          'Write the phrase down and keep it in a safe, private place. Never share it or store it in email, cloud storage, or a shared device. Anyone with the phrase can control your funds.'}
      </div>
      {props.recoveryPhraseStorageError && <p className={styles.passwordError} role='alert'>
        {props.recoveryPhraseStorageError}
      </p>}

      {!backupUnlocked ?
        passwordFormOpen ?
          <form id='backup-password-form' className={styles.passwordForm} onSubmit={(event) => void unlockBackup(event)}>
            <label htmlFor='backup-wallet-password'>Wallet password</label>
            <input
              id='backup-wallet-password'
              type='password'
              autoComplete='current-password'
              value={walletPassword}
              onChange={(event) => {
                setWalletPassword(event.target.value);
                setPasswordError('');
              }}
              required
              minLength={1}
              disabled={loading}
            />
            <p className={styles.passwordHint}>Enter the password used to encrypt this wallet in this browser.</p>
            {passwordError && <p className={styles.passwordError} role='alert' aria-live='assertive'>{passwordError}</p>}
            <div className={styles.passwordActions}>
              <button
                type='button'
                className={styles.cancelButton}
                onClick={() => {
                  setPasswordFormOpen(false);
                  setWalletPassword('');
                  setPasswordError('');
                }}
                disabled={loading}
              >Cancel</button>
              <button type='submit' className={styles.primaryButton} disabled={loading || !walletPassword}>
                <Icon name='eye' size={17}/>{loading ? 'Unlocking backup…' : 'Unlock backup'}
              </button>
            </div>
          </form>
          :
          <button
            type='button'
            className={styles.primaryButton}
            disabled={!props.walletFileName}
            onClick={() => {
              setPasswordFormOpen(true);
              setPasswordError('');
            }}
          >
            <Icon name='eye' size={17}/>{props.walletFileName ? 'Reveal recovery phrase' : 'Preparing wallet…'}
          </button>
        : mnemonic ?
        <>
          <div className={styles.phrase} aria-label='Wallet recovery phrase'>
            {mnemonic}
          </div>
          <p className={styles.fileNotice}>
            The recovery-phrase text file is unencrypted. The `mywallet.wallet` backup is encrypted for Bytecoin Zero and requires this wallet password; it is not compatible with desktop walletd.
          </p>
          <div className={styles.actions}>
            <button type='button' onClick={copyMnemonic}><Icon name='copy' size={16}/>Copy phrase</button>
            <button type='button' onClick={downloadMnemonic}><Icon name='download' size={16}/>Download phrase</button>
            {walletFileButton}
            <button type='button' onClick={() => {
              setMnemonic('');
              setBackupUnlocked(false);
              setMnemonicUnavailable(false);
              setPhraseLoadError('');
              setPasswordFormOpen(false);
              setPasswordError('');
              if (props.initialMnemonic) {
                props.onInitialMnemonicHiddenChange(true);
              }
            }}><Icon name='eye' size={16}/>Hide phrase</button>
          </div>
          {walletFileError && <p className={styles.fileNotice} role='alert'>{walletFileError}</p>}
          {walletFileStatus && <p className={styles.fileNotice} role='status' aria-live='polite'>{walletFileStatus}</p>}
        </>
        :
        <>
          {mnemonicUnavailable && <p className={styles.fileNotice} role='status'>
            If you created or restored this wallet with a phrase, check your original written copy or the browser profile and site address where it was saved. If you cannot find it, the encrypted wallet file and its password are the available backup. Bytecoin Zero cannot reconstruct the original phrase from the wallet file.
          </p>}
          {phraseLoadError && <p className={styles.fileNotice} role='alert'>{phraseLoadError}</p>}
          <p className={styles.fileNotice}>
            The `mywallet.wallet` backup is encrypted for Bytecoin Zero and requires this wallet password; it is not compatible with desktop walletd.
          </p>
          <div className={styles.actions}>{walletFileButton}</div>
          {walletFileError && <p className={styles.fileNotice} role='alert'>{walletFileError}</p>}
          {walletFileStatus && <p className={styles.fileNotice} role='status' aria-live='polite'>{walletFileStatus}</p>}
        </>
      }
    </section>
  );
});

export default BackupForm;
