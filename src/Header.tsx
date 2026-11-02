// Copyright 2019 The Bytecoin developers.
// Licensed under the GNU Affero General Public License, version 3.

import React from 'react';
import * as sync from './lib/sync';
import * as util from './lib/util';
import * as explorer from './lib/explorer';
import Icon from './Icon';
import styles from './css/Header.module.css';

const getSyncError = (status: sync.IStatus) => {
  if (sync.isDaemonVersionIncompatible(status)) {
    return {
      title: 'Incompatible node version',
      message: 'The node is reachable, but its daemon does not support the synchronization protocol required by this wallet. Use a compatible node or update the wallet engine.',
    };
  }
  if (status.connectionError) {
    return {
      title: 'Node connection issue',
      message: `Could not synchronize with the selected node: ${status.connectionError}. Check that it is online and allows browser CORS, or choose another node in Settings.`,
    };
  }
  if (status.lowerLevelError) {
    return {
      title: 'Synchronization issue',
      message: status.lowerLevelError,
    };
  }
  return null;
};

type StatusProps = sync.IStatus & {nodeAddress: string; compact?: boolean; showError?: boolean};

export const Status = React.memo((props: StatusProps) => {
  const initializing = props.topBlockHash === '';
  const syncing = props.topBlockHeight !== props.topKnownBlockHeight;
  const syncError = getSyncError(props);
  const hasSyncError = !!syncError;
  const waitingForNodeHeight = initializing && props.topKnownBlockHeight === 0 &&
    !sync.isDaemonVersionIncompatible(props);
  const progress = props.topKnownBlockHeight > 0 ?
    Math.min(syncing ? 99 : 100, Math.floor(props.topBlockHeight / props.topKnownBlockHeight * 100)) : 0;
  const showProgress = (props.topKnownBlockHeight > 0 && !hasSyncError) || waitingForNodeHeight;
  const relTime = util.useRelativeTime(props.topBlockTime);
  const statusDot = hasSyncError ?
    styles.statusDotError :
    syncing || initializing ? styles.statusDotSyncing : styles.statusDotSynced;

  return (
    <section className={`${styles.status} ${props.compact ? styles.statusCompact : ''}`} aria-label='Wallet synchronization status'>
      <div className={styles.statusHeading}>
        <div>
          <div className={styles.statusLabel}>Network status</div>
          <div className={styles.syncStatus}>
            <span className={`${styles.statusDot} ${statusDot}`}/>
            {syncError ? syncError.title :
              initializing ? 'Connecting to node…' : syncing ? 'Synchronizing' : 'Synced'}
          </div>
          <div className={styles.nodeAddress}>{props.nodeAddress}</div>
        </div>
        {!initializing && <div className={styles.statusBlock}>
          <span className={styles.statusBlockLabel}>Latest block</span>
          <a href={explorer.blockUrl(props.topBlockHash)} target='_blank' rel='noreferrer noopener'>
            Block {util.formatNumber(props.topBlockHeight)}
          </a>
          <span className={styles.statusBlockTime}>{relTime}</span>
        </div>}
      </div>
      {showProgress && <div className={`${styles.progressGroup} ${syncing || waitingForNodeHeight ? styles.progressGroupSyncing : styles.progressGroupComplete}`}>
        <div className={styles.progressLabel}>
          <span>{waitingForNodeHeight ? 'Connecting to node…' : syncing ? 'Sync progress' : 'Up to date'}</span>
          <span>{waitingForNodeHeight ? '…' : `${progress}%`}</span>
        </div>
        {waitingForNodeHeight ?
          <div
            className={`${styles.progress} ${styles.progressIndeterminate}`}
            role='progressbar'
            aria-label='Waiting for node height'
            aria-valuetext='Connecting to node'
          ><span className={styles.progressIndeterminateFill}/></div> :
          <progress className={styles.progress} max='100' value={progress} aria-label={`Sync progress ${progress}%`}/>}
      </div>}
      {props.showError !== false && syncError && <p className={styles.syncStatusError} role='alert'>{syncError.message}</p>}
    </section>
  );
});

export const StatusError = React.memo((props: sync.IStatus) => {
  const issue = getSyncError(props);
  const errorKey = issue ? JSON.stringify([issue.title, issue.message]) : '';
  const [displayedErrorKey, setDisplayedErrorKey] = React.useState('');

  React.useEffect(() => {
    setDisplayedErrorKey('');
    if (!errorKey) {
      return;
    }

    const timeout = window.setTimeout(
      () => setDisplayedErrorKey(errorKey),
      sync.CONNECTION_ERROR_GRACE_PERIOD_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [errorKey]);

  if (!issue || displayedErrorKey !== errorKey) {
    return null;
  }

  return (
    <section className={styles.syncErrorPanel} role='alert' aria-live='assertive'>
      <span className={styles.syncErrorIcon}><Icon name='warning' size={21}/></span>
      <div className={styles.syncErrorContent}>
        <h2>{issue.title}</h2>
        <p>{issue.message}</p>
      </div>
    </section>
  );
});
