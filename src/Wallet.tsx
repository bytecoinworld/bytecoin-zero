// Copyright 2019 The Bytecoin developers.
// Licensed under the GNU Affero General Public License, version 3.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import Icon, {IconName} from './Icon';
import * as walletd from './lib/walletd';
import * as sync from './lib/sync';
import * as appSettings from './lib/settings';
import * as util from './lib/util';
import {Status, StatusError, SyncStatusIndicator} from './Header';
import History from './History';
import SendForm from './SendForm';
import ReceiveForm from './ReceiveForm';
import Contacts from './Contacts';
import BackupForm from './BackupForm';
import SettingsForm from './SettingsForm';
import SavedWallets from './SavedWallets';
import {saveWalletRecoveryPhrase} from './lib/walletFile';
import styles from './css/Wallet.module.css';
import logo from './img/logo.svg';

const initialStatus: sync.IStatus = {
  topBlockHeight: 0,
  topBlockTime: new Date(0),
  topBlockHash: '',
  topKnownBlockHeight: 0,
  lowerLevelError: '',
  connectionError: '',
};

const initialBalance: sync.IBalance = {
  spendable: 0,
  lockedOrUnconfirmed: 0,
};

type WalletPage = 'overview' | 'activity' | 'send' | 'receive' | 'contacts' | 'backup' | 'settings' | 'savedWallets';

const pages: {id: WalletPage, label: string, icon: IconName}[] = [
  {id: 'overview', label: 'Overview', icon: 'overview'},
  {id: 'send', label: 'Send', icon: 'send'},
  {id: 'receive', label: 'Receive', icon: 'receive'},
  {id: 'activity', label: 'Transactions', icon: 'transactions'},
  {id: 'contacts', label: 'Contacts', icon: 'community'},
  {id: 'backup', label: 'Backup', icon: 'backup'},
  {id: 'settings', label: 'Settings', icon: 'settings'},
  {id: 'savedWallets', label: 'Saved wallets', icon: 'wallet'},
];

interface WalletProps {
  description: string;
  isFile: boolean;
  isNew: boolean;
  backupMnemonic: string;
  backupPhraseHidden: boolean;
  onBackupPhraseHiddenChange: (hidden: boolean) => void;
  viewOnly: boolean;
  walletPassword: string;
  nodeSettings: appSettings.INodeSettings;
  onOpenHelp: () => void;
  sourceUrl: string;
  supportUrl: string;
  privacyPolicyUrl: string;
  version: string;
  automaticFailoverAttempted: boolean;
  onNodeSettingsChange: (settings: appSettings.INodeSettings) => void;
  onRestartAtNode: (filename: string, nodeAddress: string, automatic: boolean) => void;
  onOpenSavedWallet: (filename: string, viewOnly: boolean, password: string) => void;
  onClose: () => void;
}

const Wallet = React.memo((props: WalletProps) => {
  const [wallet, setWallet] = useState<walletd.Walletd | null>(null);
  const [backupPhraseStorageError, setBackupPhraseStorageError] = useState('');
  const [status, setStatus] = useState<sync.IStatus>(initialStatus);
  const [balance, setBalance] = useState<sync.IBalance>(initialBalance);
  const [addresses, setAddresses] = useState<sync.IAddress[]>([]);
  const [history, setHistory] = useState<sync.IDay[]>([]);
  const [page, setPage] = useState<WalletPage>(props.isNew || props.backupMnemonic ? 'backup' : 'overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sendRecipient, setSendRecipient] = useState('');
  const [closingWallet, setClosingWallet] = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [addressCopyStatus, setAddressCopyStatus] = useState('');
  const restartRequested = useRef(false);
  const recoveryPhraseSavedFor = useRef('');
  const automaticFailoverAttemptedFor = useRef('');
  const closeCallback = useRef(props.onClose);
  const activeNode = props.nodeSettings.activeNode;
  const onRestartAtNode = props.onRestartAtNode;
  const onOpenSavedWallet = props.onOpenSavedWallet;

  const openSend = useCallback((recipientAddress = '') => {
    setSendRecipient(recipientAddress);
    setPage('send');
  }, []);

  const navigateToPage = (target: WalletPage) => {
    if (target === 'send') {
      openSend();
    } else {
      setPage(target);
    }
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileMenuOpen]);

  const copyPrimaryAddress = async () => {
    const address = addresses[0] ? addresses[0].address : '';
    if (!address) {
      return;
    }
    if (!navigator.clipboard) {
      setAddressCopyStatus('Clipboard access is unavailable in this browser.');
      return;
    }
    try {
      await navigator.clipboard.writeText(address);
      setAddressCopyStatus('Primary address copied to clipboard.');
    } catch (error) {
      console.warn('failed to copy primary wallet address', error);
      setAddressCopyStatus('Could not access the clipboard. Select and copy the address manually.');
    }
  };

  useEffect(() => {
    closeCallback.current = props.onClose;
  }, [props.onClose]);

  useEffect(() => {
    if (!wallet || !props.backupMnemonic || !props.walletPassword) {
      return;
    }

    const filename = wallet.getFilename();
    if (!filename || recoveryPhraseSavedFor.current === filename) {
      return;
    }

    recoveryPhraseSavedFor.current = filename;
    void saveWalletRecoveryPhrase(filename, props.backupMnemonic, props.walletPassword).then(() => {
      setBackupPhraseStorageError('');
    }).catch((error) => {
      recoveryPhraseSavedFor.current = '';
      console.error('Could not securely save the wallet recovery phrase.', error);
      setBackupPhraseStorageError('We could not securely save this recovery phrase for later. Download it now and store it safely.');
    });
  }, [wallet, props.backupMnemonic, props.walletPassword]);

  const initialProps = useRef(props);
  useEffect(() => {
    const opening = initialProps.current;
    let active = true;
    sync.start(
      opening.isFile,
      opening.description,
      opening.isNew,
      opening.viewOnly,
      appSettings.getNodeEngineAddress(opening.nodeSettings.activeNode),
      opening.walletPassword,
      (value) => { if (active) setWallet(value); },
      (value) => { if (active) setStatus(value); },
      (value) => { if (active) setBalance(value); },
      (value) => { if (active) setAddresses(value); },
      (value) => { if (active) setHistory(value); },
    ).then(() => {
      if (active && !restartRequested.current) {
        console.info('wallet closed');
        closeCallback.current();
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const restartAtNode = useCallback(async (nodeAddress: string, automatic = false): Promise<boolean> => {
    if (!wallet || restartRequested.current || nodeAddress === activeNode) {
      return false;
    }

    const filename = wallet.getFilename();
    if (!filename) {
      if (!automatic) {
        alert('Wait until the wallet finishes opening before changing nodes.');
      }
      return false;
    }

    try {
      await appSettings.checkNodeStatus(nodeAddress);
      restartRequested.current = true;
      await wallet.close();
      onRestartAtNode(filename, nodeAddress, automatic);
      return true;
    } catch (error) {
      restartRequested.current = false;
      console.warn('failed to restart wallet at selected node', error);
      if (!automatic) {
        alert(`Could not switch nodes: ${error}`);
      }
      return false;
    }
  }, [wallet, activeNode, onRestartAtNode]);

  const closeWalletAndGoHome = async () => {
    if (!wallet || closingWallet || restartRequested.current) {
      return;
    }

    setClosingWallet(true);
    try {
      await wallet.close();
    } catch (error) {
      setClosingWallet(false);
      console.error('failed to close wallet before returning home', error);
      alert(`Could not return to the home page: ${error}`);
    }
  };

  const openSavedWallet = useCallback(async (filename: string, viewOnly: boolean, password: string) => {
    if (!wallet || restartRequested.current) {
      alert('Wait until the current wallet is ready before opening another saved wallet.');
      return;
    }
    if (filename === wallet.getFilename()) {
      setPage('overview');
      return;
    }

    try {
      restartRequested.current = true;
      await wallet.close();
      onOpenSavedWallet(filename, viewOnly, password);
    } catch (error) {
      restartRequested.current = false;
      console.warn('failed to switch to a saved wallet', error);
      alert(`Could not open the saved wallet: ${error}`);
    }
  }, [wallet, onOpenSavedWallet]);

  useEffect(() => {
    if (!wallet || !status.connectionError || restartRequested.current ||
        props.automaticFailoverAttempted || automaticFailoverAttemptedFor.current === activeNode) {
      return;
    }

    const fallbacks = appSettings.enabledNodePool(props.nodeSettings).filter((node) => node !== activeNode);
    if (fallbacks.length === 0) {
      return;
    }

    const failoverTimeout = window.setTimeout(() => {
      if (restartRequested.current || props.automaticFailoverAttempted ||
          automaticFailoverAttemptedFor.current === activeNode) {
        return;
      }

      automaticFailoverAttemptedFor.current = activeNode;
      void (async () => {
        for (const nodeAddress of fallbacks) {
          console.info(`Trying automatic wallet node fallback: ${nodeAddress}`);
          if (await restartAtNode(nodeAddress, true)) {
            return;
          }
        }
        console.warn('Automatic wallet node failover found no reachable fallback.');
      })();
    }, sync.CONNECTION_ERROR_GRACE_PERIOD_MS);

    return () => window.clearTimeout(failoverTimeout);
  }, [wallet, status.connectionError, activeNode, props.automaticFailoverAttempted, props.nodeSettings, restartAtNode]);

  useEffect(() => {
    if (!props.nodeSettings.randomNode || !wallet) {
      return;
    }
    const interval = window.setInterval(() => {
      const nextNode = appSettings.randomNodeFromPool(
        appSettings.enabledNodePool(props.nodeSettings),
        props.nodeSettings.activeNode,
      );
      if (nextNode !== props.nodeSettings.activeNode) {
        void restartAtNode(nextNode);
      }
    }, props.nodeSettings.rotationMinutes * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [wallet, props.nodeSettings, restartAtNode]);

  const syncing = status.topBlockHash === '' || status.topBlockHeight !== status.topKnownBlockHeight;
  const activePage = pages.find((item) => item.id === page);

  return (
    <div className={styles.wallet}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLabel}>WALLET MENU</div>
        <nav className={styles.navigation} aria-label='Wallet sections'>
          {pages.map((item) =>
            <button
              type='button'
              key={item.id}
              className={page === item.id ? styles.navigationActive : ''}
              aria-current={page === item.id ? 'page' : undefined}
              disabled={item.id === 'send' && (syncing || props.viewOnly)}
              onClick={() => navigateToPage(item.id)}
            >
              <Icon name={item.icon} size={18}/>
              {item.label}
            </button>
          )}
          <button type='button' onClick={props.onOpenHelp}>
            <Icon name='help' size={18}/>
            Help
          </button>
        </nav>
        <button
          type='button'
          className={styles.backHome}
          onClick={() => void closeWalletAndGoHome()}
          disabled={!wallet || closingWallet}
        >
          <Icon name='home' size={18}/>
          {closingWallet ? 'Closing wallet…' : 'Back to home'}
        </button>
        <div className={styles.sidebarNetwork}>
          <Status {...status} nodeAddress={props.nodeSettings.activeNode} compact showError={false}/>
        </div>
      </aside>

      <div className={styles.dashboard}>
        <header className={styles.pageHeader}>
          <div className={styles.pageHeading}>
            <span className={styles.pageEyebrow}>BYTECOIN WALLET</span>
            <h1>{activePage ? activePage.label : 'Wallet'}</h1>
          </div>
          <div className={styles.mobileHeaderSync}>
            <SyncStatusIndicator {...status}/>
          </div>
          <div className={styles.quickActions}>
            <button type='button' onClick={() => setPage('receive')}><Icon name='receive' size={16}/>Receive</button>
            <button type='button' onClick={() => openSend()} disabled={syncing || props.viewOnly}><Icon name='send' size={16}/>Send</button>
          </div>
        </header>
        <StatusError {...status}/>
        <section className={styles.balanceCard}>
          <div>
            <div className={styles.balanceLabel}>Available balance</div>
            <div className={styles.balanceValueRow}>
              <div className={styles.balance}>{balanceHidden ? '••••••' : util.formatBCN(balance.spendable)}</div>
              <button
                type='button'
                className={styles.balanceVisibilityButton}
                aria-label={balanceHidden ? 'Show balance' : 'Hide balance'}
                aria-pressed={balanceHidden}
                title={balanceHidden ? 'Show balance' : 'Hide balance'}
                onClick={() => setBalanceHidden(!balanceHidden)}
              >
                <Icon name={balanceHidden ? 'eyeOff' : 'eye'} size={19}/>
              </button>
            </div>
            {balance.lockedOrUnconfirmed > 0 && <div className={styles.pendingBalance}>
              {balanceHidden ? '•••••• BCN locked or unconfirmed' : `${util.formatBCN(balance.lockedOrUnconfirmed, 3)} locked or unconfirmed`}
            </div>}
          </div>
          <div className={styles.balanceMeta}>
            <span className={styles.walletType}>{props.viewOnly ? 'View-only wallet' : 'Bytecoin mainnet'}</span>
            <span>{addresses.length} {addresses.length === 1 ? 'address' : 'addresses'}</span>
          </div>
          {addresses[0] && <div className={styles.balanceAddress}>
            <div className={styles.balanceAddressHeader}>
              <span className={styles.balanceAddressLabel}>Primary address</span>
              <button
                type='button'
                className={styles.balanceCopyButton}
                aria-label='Copy primary address'
                onClick={copyPrimaryAddress}
              >
                <Icon name={addressCopyStatus === 'Primary address copied to clipboard.' ? 'check' : 'copy'} size={15}/>
                {addressCopyStatus === 'Primary address copied to clipboard.' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <code>{addresses[0].address}</code>
            {addressCopyStatus && <p className={styles.balanceCopyStatus} role='status' aria-live='polite'>{addressCopyStatus}</p>}
          </div>}
        </section>

        <util.WalletContext.Provider value={wallet}>
          <main className={styles.page}>
            {page === 'overview' && <section className={styles.overview}>
              <div className={styles.overviewCard}>
                <h2>Wallet at a glance</h2>
                <p>{syncing ? 'Your balance and transactions update as the wallet scans the blockchain.' : 'Your wallet is synchronized with the Bytecoin network.'}</p>
                <div className={styles.overviewActions}>
                  <button type='button' onClick={() => setPage('receive')}><Icon name='receive' size={16}/>Receive BCN</button>
                  <button type='button' onClick={() => setPage('activity')}><Icon name='transactions' size={16}/>View transactions</button>
                </div>
              </div>
            </section>}
            {page === 'activity' && <History history={history} topBlockHeight={status.topBlockHeight}/>}
            {page === 'send' && <SendForm
              initialAddress={sendRecipient}
              spendableBalance={balance.spendable}
              recommendedFeePerByte={status.recommendedFeePerByte}
              dismiss={() => setPage('overview')}
            />}
            {page === 'receive' && <ReceiveForm viewOnly={props.viewOnly} addresses={addresses} setAddresses={setAddresses} dismiss={() => setPage('overview')}/>}
            {page === 'contacts' && <Contacts canSend={!syncing && !props.viewOnly} onSend={openSend}/>}
            {page === 'backup' && <BackupForm
              viewOnly={props.viewOnly}
              isNew={props.isNew || !!props.backupMnemonic}
              initialMnemonic={props.backupMnemonic}
              initialMnemonicHidden={props.backupPhraseHidden}
              onInitialMnemonicHiddenChange={props.onBackupPhraseHiddenChange}
              recoveryPhraseStorageError={backupPhraseStorageError}
              walletFileName={wallet ? wallet.getFilename() : ''}
            />}
            {page === 'savedWallets' && <SavedWallets onOpen={openSavedWallet}/>}
            {page === 'settings' && <SettingsForm
              viewOnly={props.viewOnly}
              topBlockHeight={status.topBlockHeight}
              topKnownBlockHeight={status.topKnownBlockHeight}
              topBlockTime={status.topBlockTime}
              nodeSettings={props.nodeSettings}
              onNodeSettingsChange={props.onNodeSettingsChange}
              onNodeChange={restartAtNode}
              dismiss={() => setPage('overview')}
            />}
          </main>
        </util.WalletContext.Provider>
      </div>

      <nav className={styles.mobileNavigation} aria-label='Primary wallet navigation'>
        <button
          type='button'
          className={page === 'activity' ? styles.mobileNavigationActive : ''}
          aria-label='Transaction history'
          aria-current={page === 'activity' ? 'page' : undefined}
          onClick={() => navigateToPage('activity')}
        >
          <Icon name='transactions' size={20}/>
          <span>History</span>
        </button>
        <button
          type='button'
          className={page === 'send' ? styles.mobileNavigationActive : ''}
          aria-current={page === 'send' ? 'page' : undefined}
          disabled={syncing || props.viewOnly}
          onClick={() => navigateToPage('send')}
        >
          <Icon name='send' size={20}/>
          <span>Send</span>
        </button>
        <button
          type='button'
          className={styles.mobileHome}
          aria-label='Overview'
          aria-current={page === 'overview' ? 'page' : undefined}
          onClick={() => navigateToPage('overview')}
        >
          <img src={logo} alt=''/>
        </button>
        <button
          type='button'
          className={page === 'receive' ? styles.mobileNavigationActive : ''}
          aria-current={page === 'receive' ? 'page' : undefined}
          onClick={() => navigateToPage('receive')}
        >
          <Icon name='receive' size={20}/>
          <span>Receive</span>
        </button>
        <button
          type='button'
          className={mobileMenuOpen ? styles.mobileNavigationActive : ''}
          aria-label={mobileMenuOpen ? 'Close wallet menu' : 'Open wallet menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls={mobileMenuOpen ? 'mobile-wallet-menu' : undefined}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <Icon name={mobileMenuOpen ? 'close' : 'menu'} size={21}/>
          <span>Menu</span>
        </button>
      </nav>

      {mobileMenuOpen && <div className={styles.mobileMenuPanel} id='mobile-wallet-menu'>
        <div className={styles.mobileMenuHeader}>
          <strong>More in your wallet</strong>
          <button type='button' aria-label='Close wallet menu' onClick={() => setMobileMenuOpen(false)}>
            <Icon name='close' size={18}/>
          </button>
        </div>
        <nav className={styles.mobileMenuItems} aria-label='More wallet sections'>
          {pages.filter((item) => item.id !== 'activity' && item.id !== 'send' && item.id !== 'receive').map((item) =>
            <button
              type='button'
              key={item.id}
              className={page === item.id ? styles.mobileMenuActive : ''}
              aria-current={page === item.id ? 'page' : undefined}
              onClick={() => navigateToPage(item.id)}
            >
              <Icon name={item.icon} size={18}/>
              <span>{item.label}</span>
            </button>
          )}
          <button type='button' onClick={() => { setMobileMenuOpen(false); props.onOpenHelp(); }}>
            <Icon name='help' size={18}/>
            <span>Help</span>
          </button>
        </nav>
        <div className={styles.mobileMenuFooter}>
          <button
            type='button'
            className={styles.mobileBackHome}
            onClick={() => { setMobileMenuOpen(false); void closeWalletAndGoHome(); }}
            disabled={!wallet || closingWallet}
          >
            <Icon name='home' size={18}/>
            <span>{closingWallet ? 'Closing wallet…' : 'Back to home'}</span>
          </button>
          <div className={styles.mobileMenuCommunity}>
            <div className={styles.mobileMenuIdentity}>
              <span>Maintained by the Bytecoin community</span>
              <span>Bytecoin Zero v{props.version}</span>
            </div>
            <div className={styles.mobileMenuLinks}>
              <a href={props.sourceUrl} target='_blank' rel='noreferrer noopener'>
                <Icon name='github' size={16}/>
                <span>GitHub</span>
              </a>
              <a href={props.supportUrl} target='_blank' rel='noreferrer noopener'>
                <Icon name='help' size={16}/>
                <span>Support</span>
              </a>
              <a href={props.privacyPolicyUrl}>
                <Icon name='shield' size={16}/>
                <span>Privacy Policy</span>
              </a>
            </div>
          </div>
        </div>
      </div>}
    </div>
  );
});

export default Wallet;
