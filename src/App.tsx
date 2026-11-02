// Copyright 2019 The Bytecoin developers.
// Licensed under the GNU Affero General Public License, version 3.

import React, {useCallback, useEffect, useState} from 'react';
import {SwitchTransition, CSSTransition} from 'react-transition-group';
import packageInfo from '../package.json';
import styles from './css/App.module.css';
import OpenForm from './OpenForm';
import Wallet from './Wallet';
import Icon from './Icon';
import Help from './Help';
import logo from './img/logo.svg';
import * as appSettings from './lib/settings';

type ThemePreference = 'system' | 'light' | 'dark';

function getThemePreference(): ThemePreference {
  const savedTheme = window.localStorage.getItem('bytecoin-zero.theme');
  return savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'system';
}

const App = React.memo(() => {
  const [walletIsExistingFile, setWalletIsExistingFile] = useState(false);
  const [walletDescription, setWalletDescription] = useState('');
  const [walletNew, setWalletNew] = useState(false);
  const [walletBackupMnemonic, setWalletBackupMnemonic] = useState('');
  const [walletBackupPhraseHidden, setWalletBackupPhraseHidden] = useState(false);
  const [walletViewOnly, setWalletViewOnly] = useState(false);
  const [walletPassword, setWalletPassword] = useState('');
  const [walletGeneration, setWalletGeneration] = useState(0);
  const [automaticFailoverAttempted, setAutomaticFailoverAttempted] = useState(false);
  const [nodeSettings, setNodeSettings] = useState<appSettings.INodeSettings>(appSettings.readNodeSettings);
  const [helpOpen, setHelpOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const effectiveTheme = theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme;
  const sourceRevision = process.env.REACT_APP_GIT_SHA;
  const sourceUrl = sourceRevision && /^[0-9a-f]{7,40}$/i.test(sourceRevision) ?
    `https://github.com/bytecoinworld/bytecoin-zero/tree/${sourceRevision}` :
    'https://github.com/bytecoinworld/bytecoin-zero';
  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const updatePreference = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);

    if (preference.addEventListener) {
      preference.addEventListener('change', updatePreference);
      return () => preference.removeEventListener('change', updatePreference);
    }

    preference.addListener(updatePreference);
    return () => preference.removeListener(updatePreference);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
  }, [effectiveTheme]);

  const toggleTheme = () => {
    const nextTheme = effectiveTheme === 'dark' ? 'light' : 'dark';
    window.localStorage.setItem('bytecoin-zero.theme', nextTheme);
    setTheme(nextTheme);
  };

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <img src={logo} alt=''/>
          <div>
            <strong>Bytecoin Zero</strong>
            <span>Community wallet</span>
          </div>
        </div>
        <div className={styles.topbarActions}>
          <button
            type='button'
            className={styles.helpToggle}
            onClick={openHelp}
            aria-haspopup='dialog'
            aria-expanded={helpOpen}
          >
            <Icon name='help' size={16}/>
            Help
          </button>
          <button type='button' className={styles.themeToggle} onClick={toggleTheme} aria-label={`Switch to ${effectiveTheme === 'dark' ? 'light' : 'dark'} mode`}>
            <Icon name={effectiveTheme === 'dark' ? 'sun' : 'moon'} size={16}/>
            {effectiveTheme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </header>

      <SwitchTransition>
        <CSSTransition timeout={300} key={`${walletDescription}:${nodeSettings.activeNode}:${walletGeneration}`} mountOnEnter={true} unmountOnExit={true} classNames='app-main'>
          <>
            {!walletDescription &&
              <OpenForm onOpen={(isFile, desc, isNew, viewOnly, password, backupMnemonic) => {
                setAutomaticFailoverAttempted(false);
                setWalletIsExistingFile(isFile);
                setWalletDescription(desc);
                setWalletNew(isNew);
                setWalletBackupMnemonic(isNew ? desc : backupMnemonic || '');
                setWalletBackupPhraseHidden(false);
                setWalletViewOnly(viewOnly);
                setWalletPassword(password);
              }}/>
            }
            {walletDescription &&
              <Wallet
                description={walletDescription}
                isFile={walletIsExistingFile}
                isNew={walletNew}
                backupMnemonic={walletBackupMnemonic}
                backupPhraseHidden={walletBackupPhraseHidden}
                onBackupPhraseHiddenChange={setWalletBackupPhraseHidden}
                viewOnly={walletViewOnly}
                walletPassword={walletPassword}
                nodeSettings={nodeSettings}
                onOpenHelp={openHelp}
                automaticFailoverAttempted={automaticFailoverAttempted}
                onNodeSettingsChange={(settings) => {
                  appSettings.saveNodeSettings(settings);
                  setNodeSettings(settings);
                }}
                onRestartAtNode={(filename, nodeAddress, automatic) => {
                  setAutomaticFailoverAttempted(automatic);
                  setNodeSettings((currentSettings) => {
                    const settings = {...currentSettings, activeNode: nodeAddress};
                    appSettings.saveNodeSettings(settings);
                    return settings;
                  });
                  setWalletIsExistingFile(true);
                  setWalletDescription(filename);
                  setWalletNew(false);
                  setWalletGeneration((generation) => generation + 1);
                }}
                onOpenSavedWallet={(filename, viewOnly, password) => {
                  setAutomaticFailoverAttempted(false);
                  setWalletIsExistingFile(true);
                  setWalletDescription(filename);
                  setWalletNew(false);
                  setWalletBackupMnemonic('');
                  setWalletBackupPhraseHidden(false);
                  setWalletViewOnly(viewOnly);
                  setWalletPassword(password);
                  setWalletGeneration((generation) => generation + 1);
                }}
                onClose={() => {
                  setAutomaticFailoverAttempted(false);
                  setWalletDescription('');
                  setWalletPassword('');
                  setWalletBackupMnemonic('');
                  setWalletBackupPhraseHidden(false);
                }}
              />
            }
          </>
        </CSSTransition>
      </SwitchTransition>

      {helpOpen && <Help onClose={closeHelp}/>}

      <div className={styles.footer}>
        <span>Maintained by the Bytecoin community</span>
        <span>Bytecoin Zero v{packageInfo.version}</span>
        <span><a href={sourceUrl} target='_blank' rel='noreferrer noopener'>Source</a> · <a href='https://github.com/bytecoinworld/bytecoin-zero/issues' target='_blank' rel='noreferrer noopener'>Support</a></span>
      </div>
    </div>
  );
});

export default App;
