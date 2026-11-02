// Copyright 2019 The Bytecoin developers.
// Licensed under the GNU Affero General Public License, version 3.

import React, {useState, useEffect, useRef} from 'react';
import {generateMnemonic, validateMnemonic} from 'bip39';
import {checkAuditFormat, auditPattern} from "@bcndev/bytecoin";
import englishWordlist from 'bip39/src/wordlists/english.json';
import Avatar from './Avatar';
import Icon from './Icon';
import * as util from './lib/util';
import {ISavedWalletInfo, readSavedWallets} from './lib/savedWallets';
import {
  getWalletBackup,
  getWalletPasswordErrorMessage,
  isWalletFileEncrypted,
  readFileAsBytes,
  verifyWalletBackupPassword,
  verifyWalletPassword,
  walletFileExists,
  writeWalletFile,
} from './lib/walletFile';
import logo from './img/logo.svg';
import styles from './css/OpenForm.module.css';

type AccessMode = 'choose' | 'create' | 'restore' | 'password';
type RestoreMethod = 'seed' | 'audit' | 'file';

interface IPasswordStep {
  readonly previousMode: AccessMode;
  readonly isFile: boolean;
  readonly description: string;
  readonly isNew: boolean;
  readonly viewOnly: boolean;
  readonly requirePassword: boolean;
  readonly confirmPassword: boolean;
  readonly verifyPassword?: boolean;
  readonly backupData?: Uint8Array;
  readonly backupMnemonic?: string;
}

const BIP39_WORD_COUNTS = [12, 15, 18, 21, 24];
const emptySeedWords = (count: number): string[] => Array.from({length: count}, () => '');

const OpenForm = React.memo((props: {
  onOpen: (
    isFile: boolean,
    desc: string,
    isNew: boolean,
    viewOnly: boolean,
    password: string,
    backupMnemonic?: string,
  ) => void;
}) => {
  const [accessMode, setAccessMode] = useState<AccessMode>('choose');
  const [generatedPhrase, setGeneratedPhrase] = useState('');
  const [phraseStored, setPhraseStored] = useState(false);
  const [phraseCopyStatus, setPhraseCopyStatus] = useState('');
  const [restoreMethod, setRestoreMethod] = useState<RestoreMethod>('seed');
  const [seedWordCount, setSeedWordCount] = useState(24);
  const [seedWords, setSeedWords] = useState<string[]>(emptySeedWords(24));
  const [seedError, setSeedError] = useState('');
  const [seedMessage, setSeedMessage] = useState('');
  const [auditSecret, setAuditSecret] = useState('');
  const [opening, setOpening] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<ISavedWalletInfo | null>(null);
  const [existingWallets, setExistingWallets] = useState<ISavedWalletInfo[]>([]);
  const [passwordStep, setPasswordStep] = useState<IPasswordStep | null>(null);
  const [walletPassword, setWalletPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [walletBackupError, setWalletBackupError] = useState('');
  const walletPasswordInput = useRef<HTMLInputElement>(null);
  const seedWordInputs = useRef<Array<HTMLInputElement | null>>([]);
  const seedPhrase = seedWords.join(' ').trim().toLowerCase();
  const seedValid = validateMnemonic(seedPhrase, englishWordlist);
  const trimmedAuditSecret = auditSecret.trim();
  const auditValid = auditPattern.test(trimmedAuditSecret) && checkAuditFormat(trimmedAuditSecret);
  const generatedWords = generatedPhrase ? generatedPhrase.split(' ') : [];
  const restoreDisabled = opening ||
    (restoreMethod === 'seed' && !seedValid) ||
    (restoreMethod === 'audit' && !auditValid) ||
    restoreMethod === 'file';

  useEffect(() => {
    setExistingWallets(readSavedWallets());
  }, []);

  useEffect(() => {
    const input = walletPasswordInput.current;
    if (passwordStep && input) {
      input.focus({preventScroll: true});
      input.scrollIntoView({
        behavior: typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'center',
      });
    }
  }, [passwordStep]);

  const generate = () => {
    setGeneratedPhrase(generateMnemonic(256, undefined, englishWordlist));
    setPhraseStored(false);
    setPhraseCopyStatus('');
    setAccessMode('create');
    setSelectedWallet(null);
  };

  const copyAllWords = async () => {
    if (!generatedPhrase) {
      return;
    }
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      setPhraseCopyStatus('Clipboard access is unavailable in this browser.');
      return;
    }
    try {
      await navigator.clipboard.writeText(generatedPhrase);
      setPhraseCopyStatus('All recovery words copied. Keep them private.');
    } catch (error) {
      console.warn('failed to copy recovery phrase', error);
      setPhraseCopyStatus('Could not access the clipboard. Write the words down manually.');
    }
  };

  const startRestore = () => {
    setSeedWordCount(24);
    setSeedWords(emptySeedWords(24));
    setSeedError('');
    setSeedMessage('');
    setAuditSecret('');
    setRestoreMethod('seed');
    setAccessMode('restore');
    setSelectedWallet(null);
  };

  const backToChoices = () => {
    setAccessMode('choose');
    setGeneratedPhrase('');
    setPhraseStored(false);
    setPhraseCopyStatus('');
    setSeedWords(emptySeedWords(24));
    setSeedWordCount(24);
    setSeedError('');
    setSeedMessage('');
    setAuditSecret('');
    setSelectedWallet(null);
    setPasswordStep(null);
    setWalletPassword('');
    setPasswordConfirmation('');
    setPasswordError('');
    setWalletBackupError('');
  };

  const beginPasswordStep = (step: IPasswordStep) => {
    setPasswordStep(step);
    setWalletPassword('');
    setPasswordConfirmation('');
    setPasswordError('');
    setAccessMode('password');
  };

  const applySeedPhrase = (phrase: string): boolean => {
    const words = phrase.trim().toLowerCase().split(/\s+/).filter((word) => word !== '');
    setSelectedWallet(null);
    if (!words.length) {
      setSeedError('Paste or enter your recovery words first.');
      setSeedMessage('');
      return false;
    }
    if (BIP39_WORD_COUNTS.indexOf(words.length) === -1) {
      setSeedError(`A recovery phrase must contain 12, 15, 18, 21, or 24 words; this has ${words.length}.`);
      setSeedMessage('');
      return false;
    }

    setSeedWordCount(words.length);
    setSeedWords(words);
    setSeedError('');
    setSeedMessage('Seed words filled in. Check their order before continuing.');
    return true;
  };

  const pasteSeed = async () => {
    if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
      setSeedMessage('Clipboard access is unavailable. Enter the words in the numbered fields.');
      return;
    }
    try {
      const phrase = await navigator.clipboard.readText();
      if (!phrase.trim()) {
        setSeedMessage('The clipboard is empty.');
        return;
      }
      applySeedPhrase(phrase);
    } catch (error) {
      console.warn('failed to paste recovery phrase', error);
      setSeedMessage('Could not access the clipboard. Enter the words in the numbered fields.');
    }
  };

  const changeWordCount = (count: number) => {
    setSeedWordCount(count);
    setSeedWords((current) => Array.from({length: count}, (_, index) => current[index] || ''));
    setSeedError('');
    setSeedMessage('');
    setSelectedWallet(null);
  };

  const changeSeedWord = (index: number, value: string) => {
    if (/\s/.test(value.trim())) {
      applySeedPhrase(value);
      return;
    }

    setSeedWords((current) => {
      const updated = current.slice();
      updated[index] = value.trim().toLowerCase();
      return updated;
    });
    setSeedError('');
    setSeedMessage('');
    setSelectedWallet(null);
  };

  const createWallet = async () => {
    if (!phraseStored || !generatedPhrase) {
      return;
    }
    beginPasswordStep({
      previousMode: 'create',
      isFile: false,
      description: generatedPhrase.trim().toLowerCase(),
      isNew: true,
      viewOnly: false,
      requirePassword: true,
      confirmPassword: true,
      backupMnemonic: generatedPhrase.trim().toLowerCase(),
    });
  };

  const restoreWallet = async () => {
    if (restoreMethod === 'audit') {
      if (auditValid) {
        beginPasswordStep({
          previousMode: 'restore',
          isFile: false,
          description: trimmedAuditSecret,
          isNew: false,
          viewOnly: true,
          requirePassword: true,
          confirmPassword: true,
        });
      }
      return;
    }

    if (restoreMethod === 'seed' && seedValid) {
      beginPasswordStep({
        previousMode: 'restore',
        isFile: false,
        description: seedPhrase,
        isNew: false,
        viewOnly: false,
        requirePassword: true,
        confirmPassword: true,
        backupMnemonic: seedPhrase,
      });
    }
  };

  const openSavedWallet = async (info: ISavedWalletInfo) => {
    if (opening) {
      return;
    }

    setOpening(true);
    setWalletBackupError('');
    try {
      const encrypted = await isWalletFileEncrypted(info.filename);
      beginPasswordStep({
        previousMode: 'choose',
        isFile: true,
        description: info.filename,
        isNew: false,
        viewOnly: info.viewOnly,
        requirePassword: encrypted,
        confirmPassword: !encrypted,
        verifyPassword: encrypted,
      });
    } catch (error) {
      console.warn('failed to inspect saved wallet encryption', error);
      setWalletBackupError(`Could not read the saved wallet: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setOpening(false);
    }
  };

  const selectWalletBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files && input.files[0];
    input.value = '';
    if (!file || opening) {
      return;
    }

    setOpening(true);
    setWalletBackupError('');
    try {
      const backup = getWalletBackup(await readFileAsBytes(file));
      beginPasswordStep({
        previousMode: 'restore',
        isFile: true,
        description: backup.filename,
        isNew: false,
        viewOnly: false,
        requirePassword: true,
        confirmPassword: false,
        verifyPassword: true,
        backupData: backup.data,
      });
    } catch (error) {
      setWalletBackupError(`Could not read this wallet backup: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setOpening(false);
    }
  };

  const continueWithPassword = async () => {
    if (!passwordStep || opening) {
      return;
    }
    if (passwordStep.requirePassword && walletPassword.length === 0) {
      setPasswordError('Enter a wallet password. At least one character is required.');
      return;
    }
    if (passwordStep.confirmPassword && walletPassword !== passwordConfirmation) {
      setPasswordError('The passwords do not match.');
      return;
    }
    if (walletPassword.length > 0 && (!window.crypto || !window.crypto.subtle)) {
      setPasswordError('Secure wallet encryption is unavailable in this browser. Use a modern browser over HTTPS or localhost.');
      return;
    }

    setOpening(true);
    setPasswordError('');
    try {
      if (passwordStep.verifyPassword) {
        try {
          if (passwordStep.backupData) {
            await verifyWalletBackupPassword(
              passwordStep.backupData,
              passwordStep.description,
              walletPassword,
            );
          } else {
            await verifyWalletPassword(passwordStep.description, walletPassword);
          }
        } catch (error) {
          setPasswordError(getWalletPasswordErrorMessage(error));
          setOpening(false);
          return;
        }
      }

      if (passwordStep.backupData) {
        if (await walletFileExists(passwordStep.description) &&
            !window.confirm('A wallet with this identifier already exists on this device. Replace its saved file with this backup?')) {
          setOpening(false);
          return;
        }
        await writeWalletFile(passwordStep.description, passwordStep.backupData);
      }

      props.onOpen(
        passwordStep.isFile,
        passwordStep.description,
        passwordStep.isNew,
        passwordStep.viewOnly,
        walletPassword,
        passwordStep.backupMnemonic,
      );
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : String(error));
      setOpening(false);
    }
  };

  const backFromPassword = () => {
    const previousMode = passwordStep ? passwordStep.previousMode : 'choose';
    setPasswordStep(null);
    setWalletPassword('');
    setPasswordConfirmation('');
    setPasswordError('');
    setAccessMode(previousMode);
  };

  return (
    <div className={styles.openForm}>
      <section className={styles.welcomePanel}>
        <div className={styles.welcomeBrand}>
          <img src={logo} alt=''/>
          <span>SELF-CUSTODY WALLET</span>
        </div>
        <h1>Your Bytecoin.<br/>Your control.</h1>
        <p>Manage BCN from your browser with a wallet that connects directly to the public network.</p>
        <div className={styles.welcomeFeatures}>
          <div>
            <span className={styles.featureIcon}><Icon name='shield' size={18}/></span>
            <span><strong>Recovery first</strong><small>Keep your seed phrase safe and offline.</small></span>
          </div>
          <div>
            <span className={styles.featureIcon}><Icon name='network' size={18}/></span>
            <span><strong>Choose your node</strong><small>Connect directly to a node you trust.</small></span>
          </div>
          <div>
            <span className={styles.featureIcon}><Icon name='community' size={18}/></span>
            <span><strong>Community maintained</strong><small>Open-source Bytecoin wallet software.</small></span>
          </div>
        </div>
        <div className={styles.storageNotice}>
          New wallets are encrypted locally with a password-derived key. Your password is never stored; keep your recovery phrase safe.
        </div>
      </section>

      <div className={styles.openContent}>
        <section className={styles.fromDescription}>
          <div className={styles.panelHeading}>
            <span className={styles.eyebrow}>WALLET ACCESS</span>
            <h2>{accessMode === 'create' ? 'Step 1: Secure your recovery phrase' :
              accessMode === 'restore' ? 'Restore your wallet' :
              accessMode === 'password' ? passwordStep && passwordStep.isNew ? 'Step 2: Set a wallet password' : 'Set or enter a wallet password' :
                'Create or restore a wallet'}</h2>
            <p>{accessMode === 'choose' ?
              'Choose how you want to get started.' :
              accessMode === 'create' ?
                'Write down your new recovery phrase before creating the wallet.' :
                accessMode === 'restore' ?
                  'Choose a recovery phrase, audit secret, or encrypted wallet backup.' :
                  passwordStep && passwordStep.requirePassword ?
                    'This password encrypts your wallet in this browser and is required to open it again.' :
                    'Leave the password empty for an older unencrypted wallet, or set one to encrypt and migrate it.'}</p>
          </div>

          {accessMode === 'choose' && <div className={styles.walletChoices}>
            <button type='button' className={styles.choiceButton} onClick={generate}>
              <span className={styles.choiceIcon}><Icon name='walletPlus' size={20}/></span>
              <span><strong>Create New Wallet</strong><small>Generate a new wallet and recovery phrase.</small></span>
              <Icon name='arrowRight' size={17}/>
            </button>
            <button type='button' className={styles.choiceButton} onClick={startRestore}>
              <span className={styles.choiceIcon}><Icon name='walletRestore' size={20}/></span>
              <span><strong>Restore Wallet</strong><small>Recover a wallet using your seed words.</small></span>
              <Icon name='arrowRight' size={17}/>
            </button>
          </div>}

          {accessMode === 'create' && <>
            <div className={styles.recoveryHeading}>
              <strong>Your recovery phrase</strong>
              <div className={styles.recoveryActions}>
                <span>{generatedWords.length} words</span>
                <button
                  type='button'
                  className={styles.copyPhraseButton}
                  onClick={copyAllWords}
                  disabled={opening || !generatedPhrase}
                  aria-label='Copy all recovery words'
                >
                  <Icon name='copy' size={15}/>Copy all words
                </button>
              </div>
            </div>
            {phraseCopyStatus && <p className={styles.copyStatus} role='status' aria-live='polite'>{phraseCopyStatus}</p>}
            <div className={styles.wordGrid} role='group' aria-label='New recovery phrase in order'>
              {generatedWords.map((word, index) => <div className={styles.wordCard} key={index}>
                <span>{index + 1}</span>
                <strong>{word}</strong>
              </div>)}
            </div>
            <div className={styles.securityNotice}>
              <Icon name='warning' size={18}/>
              <p><strong>Store these words securely.</strong> Write all 24 words down in order and keep them somewhere private and offline. You will need them to recover this wallet. Never share them.</p>
            </div>
            <label className={styles.confirmation}>
              <input type='checkbox' checked={phraseStored} onChange={(event) => setPhraseStored(event.target.checked)}/>
              I have stored my recovery words safely
            </label>
            <div className={styles.controls}>
              <button type='button' className={styles.backButton} onClick={backToChoices}>Back</button>
              <button type='button' className={styles.genButton} onClick={generate} disabled={opening}>
                <Icon name='sparkle' size={17}/>Generate another phrase
              </button>
              <button type='button' className={styles.openButton} disabled={opening || !phraseStored} onClick={createWallet}>
                <Icon name='arrowRight' size={17}/>Continue to password
              </button>
            </div>
          </>}

          {accessMode === 'restore' && <>
            <div className={styles.restoreMethods} role='group' aria-label='Recovery method'>
              <button
                type='button'
                className={restoreMethod === 'seed' ? styles.restoreMethodActive : styles.restoreMethod}
                aria-pressed={restoreMethod === 'seed'}
                onClick={() => setRestoreMethod('seed')}
              >Seed phrase</button>
              <button
                type='button'
                className={restoreMethod === 'audit' ? styles.restoreMethodActive : styles.restoreMethod}
                aria-pressed={restoreMethod === 'audit'}
                onClick={() => setRestoreMethod('audit')}
              >Audit secret</button>
              <button
                type='button'
                className={restoreMethod === 'file' ? styles.restoreMethodActive : styles.restoreMethod}
                aria-pressed={restoreMethod === 'file'}
                onClick={() => setRestoreMethod('file')}
              >Wallet file</button>
            </div>

            {restoreMethod === 'seed' ? <>
              <div className={styles.wordToolbar}>
                <label htmlFor='seed-word-count'>Recovery phrase</label>
                <div>
                  <select id='seed-word-count' value={seedWordCount} onChange={(event) => changeWordCount(Number(event.target.value))}>
                    {BIP39_WORD_COUNTS.map((count) => <option value={count} key={count}>{count} words</option>)}
                  </select>
                  <button type='button' className={styles.pasteButton} onClick={pasteSeed}>
                    <Icon name='paste' size={16}/>Paste seed
                  </button>
                </div>
              </div>
              <div className={styles.seedWordGrid} role='group' aria-label={`${seedWordCount} recovery words`}>
                {seedWords.map((word, index) => <label className={styles.seedWordField} key={index}>
                  <span>{index + 1}</span>
                  <input
                    type='text'
                    aria-label={`Seed word ${index + 1}`}
                    ref={(input) => {
                      seedWordInputs.current[index] = input;
                    }}
                    autoCapitalize='none'
                    autoComplete='off'
                    spellCheck={false}
                    maxLength={512}
                    className={word && englishWordlist.indexOf(word) === -1 ? styles.invalidWord : ''}
                    value={word}
                    onChange={(event) => changeSeedWord(index, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') {
                        return;
                      }
                      event.preventDefault();
                      const nextInput = seedWordInputs.current[index + 1];
                      if (nextInput) {
                        nextInput.focus();
                      } else if (seedValid && !opening) {
                        void restoreWallet();
                      }
                    }}
                  />
                </label>)}
              </div>
              <p className={styles.keyboardHint}>Use Tab or Enter to move to the next word. On the last word, Enter continues when the phrase is valid.</p>
              {seedError && <p className={styles.validationError} role='alert'>{seedError}</p>}
              {!seedError && seedWords.some((word) => word !== '') && !seedValid &&
                <p className={styles.validationError} role='status'>Check the words, their order, and the recovery phrase checksum.</p>}
              {seedMessage && <p className={styles.seedMessage} role='status' aria-live='polite'>{seedMessage}</p>}
              <p className={styles.securityHint}>Keep your seed words private. Anyone who has them can access your funds.</p>
            </> : restoreMethod === 'audit' ? <div className={styles.auditGroup}>
              <label htmlFor='audit-secret'>Audit secret</label>
              <textarea
                id='audit-secret'
                autoCapitalize='none'
                autoComplete='off'
                spellCheck={false}
                maxLength={512}
                value={auditSecret}
                onChange={(event) => {
                  setAuditSecret(event.target.value);
                  setSelectedWallet(null);
                }}
                placeholder='Enter your Bytecoin audit secret'
              />
              <small>Use the audit secret associated with this view-only wallet.</small>
            </div> : <div className={styles.walletFileImport}>
              <label htmlFor='wallet-backup-file'>Encrypted Bytecoin Zero wallet backup</label>
              <input
                id='wallet-backup-file'
                type='file'
                accept='.wallet,application/octet-stream'
                onChange={selectWalletBackup}
                disabled={opening}
              />
              <small>Choose a `mywallet.wallet` file exported from Bytecoin Zero. This encrypted format is app-specific.</small>
              {walletBackupError && <p className={styles.validationError} role='alert'>{walletBackupError}</p>}
            </div>}

            <div className={styles.controls}>
              <button type='button' className={styles.backButton} onClick={backToChoices}>Back</button>
              <button
                type='button'
                className={styles.openButton}
                disabled={restoreDisabled}
                onClick={restoreWallet}
              >
                <Icon name='arrowRight' size={17}/>Continue
              </button>
            </div>
          </>}

          {accessMode === 'password' && passwordStep && <>
            <div className={styles.passwordForm}>
              <label htmlFor='wallet-password'>Wallet password</label>
              <input
                ref={walletPasswordInput}
                id='wallet-password'
                type='password'
                autoComplete={passwordStep.confirmPassword ? 'new-password' : 'current-password'}
                required={passwordStep.requirePassword}
                minLength={passwordStep.requirePassword ? 1 : undefined}
                value={walletPassword}
                onChange={(event) => {
                  setWalletPassword(event.target.value);
                  setPasswordError('');
                }}
                aria-invalid={!!passwordError}
              />
              {passwordStep.confirmPassword && <>
                <label htmlFor='wallet-password-confirm'>Confirm password</label>
                <input
                  id='wallet-password-confirm'
                  type='password'
                  autoComplete='new-password'
                  value={passwordConfirmation}
                  onChange={(event) => {
                    setPasswordConfirmation(event.target.value);
                    setPasswordError('');
                  }}
                  aria-invalid={!!passwordError}
                />
              </>}
              <div className={styles.securityNotice}>
                <Icon name='warning' size={18}/>
                <p>
                  {passwordStep.requirePassword ?
                    'Your password encrypts the saved wallet file in this browser. Bytecoin Zero does not store it. If you forget it, restore with your recovery phrase.' :
                    'For an older unencrypted wallet, leave both fields empty to keep it unencrypted, or enter and confirm a password to encrypt it.'}
                  {' '}A one-character password is accepted, but a longer unique password is much harder to guess.
                </p>
              </div>
              {passwordError && <p className={styles.validationError} role='alert'>{passwordError}</p>}
            </div>
            <div className={styles.controls}>
              <button type='button' className={styles.backButton} onClick={backFromPassword} disabled={opening}>Back</button>
              <button
                type='button'
                className={styles.openButton}
                disabled={opening || (passwordStep.requirePassword && walletPassword.length === 0) ||
                  (passwordStep.confirmPassword && walletPassword !== passwordConfirmation)}
                onClick={continueWithPassword}
              >
                <Icon name='arrowRight' size={17}/>
                {opening ? 'Opening wallet…' : passwordStep.isNew ? 'Create encrypted wallet' : passwordStep.backupData ? 'Restore wallet file' : 'Open wallet'}
              </button>
            </div>
          </>}
        </section>

        {existingWallets.length > 0 && <section className={styles.existingWallets}>
          <div className={styles.savedHeading}>
            <div>
              <span className={styles.eyebrow}>ON THIS DEVICE</span>
              <h2>Saved wallets</h2>
            </div>
            <span>{existingWallets.length}</span>
          </div>
          {existingWallets.map((info) => {
            const selected = selectedWallet ? selectedWallet.filename === info.filename : false;
            return <div key={info.filename} className={`${styles.walletFile} ${selected ? styles.walletFileSelected : ''}`}>
              <div className={styles.walletFileRow}>
                <button
                  type='button'
                  className={styles.walletFileSelect}
                  aria-pressed={selected}
                  onClick={() => setSelectedWallet(info)}
                >
                  <div className={styles.avatar}>
                    <Avatar message={info.firstAddress}/>
                  </div>
                  <div className={styles.walletDesc}>
                    <div className={styles.walletDetails}>
                      <span className={styles.lastOpen}>Last opened: {util.formatDateTime(new Date(info.lastOpen))}</span> {info.viewOnly && <span className={styles.viewOnly}>View only</span>}
                    </div>
                    <div className={styles.firstAddress} title={info.firstAddress}>
                      {info.firstAddress}
                    </div>
                  </div>
                </button>
                <button
                  type='button'
                  className={styles.walletOpenButton}
                  disabled={opening}
                  onClick={() => void openSavedWallet(info)}
                >
                  <Icon name='wallet' size={17}/>
                  Open wallet
                </button>
              </div>
            </div>;
          })}
          {walletBackupError && <p className={styles.validationError} role='alert'>{walletBackupError}</p>}
        </section>}
      </div>
    </div>
  );
});

export default OpenForm;
