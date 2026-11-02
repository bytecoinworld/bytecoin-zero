// Copyright 2019 The Bytecoin developers.
// Licensed under the GNU Affero General Public License, version 3.

import React, {useState, useContext, useEffect, useRef} from 'react';
import {CSSTransition, TransitionGroup} from 'react-transition-group';
import {flatMap} from 'lodash';
import * as sync from './lib/sync';
import * as util from './lib/util';
import Avatar from './Avatar';
import {ReactComponent as ArrowNE} from './img/Arrow_northeast.svg';
import {ReactComponent as ArrowSE} from './img/Arrow_southeast.svg';
import {ReactComponent as ArrowSW} from './img/Arrow_southwest.svg';
import styles from './css/History.module.css';
import {formatDateTime, formatTime} from './lib/util';
import * as explorer from './lib/explorer';
import Icon from './Icon';

const History = React.memo((props: {history: sync.IDay[], topBlockHeight: number}) => {
  const {history, topBlockHeight} = props;

  return (
    <div className={styles.history}>
      {
        history.length === 0 &&
        <div className={styles.emptyHistory}>
            No transactions yet
        </div>
      }
      <TransitionGroup component={null}>
        {history.map((day) =>
          <CSSTransition key={day.date.valueOf()} timeout={1000} classNames='history-day'>
            <Day {...day} topBlockHeight={topBlockHeight}/>
          </CSSTransition>
        )}
      </TransitionGroup>
    </div>
  );
});

const Day = React.memo((props: sync.IDay & {topBlockHeight: number}) => {
  return (
    <div className={styles.historyDay}>
      <div className={styles.historyDayHeader}>
        <div className={styles.historyDayDate}>
          {util.formatDate(props.date)}
        </div>
      </div>

      <div className={styles.historyDayRows}>
        <TransitionGroup component={null} appear={true}>
        {
          flatMap(props.blocks, (block) => {
            const txs = block.transactions.map((transaction) =>
              <CSSTransition key={transaction.hash} timeout={1000} classNames='history-row'>
                <Transaction
                  {...transaction}
                  blockHeight={block.header.height}
                  blockHash={block.header.hash}
                  confirmed={block.header.confirmed}
                  topBlockHeight={props.topBlockHeight}
                />
              </CSSTransition>
            );

            const transfers = block.unlockedTransfers.map((transfer) =>
              <CSSTransition key={`${transfer.amount}#${transfer.address}@${transfer.transactionHash}`} timeout={1000} classNames='history-row'>
                <div className={styles.unlockedTransferContainer}>
                  <Transfer {...transfer} isUnlock={true}/>
                </div>
              </CSSTransition>
            );

            return [...txs, ...transfers];
          })
        }
        </TransitionGroup>
      </div>
    </div>
  );
});

const Transaction = React.memo((props: sync.ITransaction & {
  blockHeight: number;
  blockHash: string;
  confirmed: boolean;
  topBlockHeight: number;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [detailsAnimating, setDetailsAnimating] = useState(false);
  const [hashCopyStatus, setHashCopyStatus] = useState<'copied' | 'unavailable' | 'failed' | ''>('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsCloseButton = useRef<HTMLButtonElement>(null);

  const kindClass = sync.TxKind[props.kind];
  const confirmationStatus = props.confirmed ? 'Confirmed' : 'Unconfirmed';
  const requiredConfirmationCount = sync.REQUIRED_CONFIRMATIONS;
  const confirmationCount = props.blockHeight > 0 ? Math.min(
    requiredConfirmationCount,
    Math.max(0, props.topBlockHeight - props.blockHeight + 1),
  ) : 0;
  const recipients = props.kind === sync.TxKind.Send ? props.transfers.send :
    props.kind === sync.TxKind.Receive ? props.transfers.receive :
      [...props.transfers.send, ...props.transfers.receive];
  const unlockTime = props.unlockBlockOrTimestamp && props.unlockBlockOrTimestamp > 0 ?
    props.unlockBlockOrTimestamp > sync.MAX_BLOCK_NUMBER ?
      formatDateTime(new Date(props.unlockBlockOrTimestamp * 1000)) :
      `Block ${util.formatNumber(props.unlockBlockOrTimestamp)}` :
    '—';

  useEffect(() => {
    if (!detailsOpen) {
      return;
    }

    const previousFocus = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDetailsOpen(false);
      }
    };

    if (detailsCloseButton.current) {
      detailsCloseButton.current.focus();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus) {
        previousFocus.focus();
      }
    };
  }, [detailsOpen]);

  const copyTransactionHash = async () => {
    setHashCopyStatus('');
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      setHashCopyStatus('unavailable');
      return;
    }

    try {
      await navigator.clipboard.writeText(props.hash);
      setHashCopyStatus('copied');
    } catch (error) {
      console.warn('failed to copy transaction hash', error);
      setHashCopyStatus('failed');
    }
  };

  return (
    <div className={`${styles.tx} ${kindClass}`}>
      <div className={`${styles.txBody} ${expanded ? 'expanded' : ''} ${detailsAnimating ? 'details-animating' : ''} ${props.confirmed ? 'confirmed' : 'unconfirmed'}`} onClick={() => setExpanded(!expanded)}>
        {
          props.summary.map((t) =>
            <Transfer key={t.address} {...t} unconfirmed={!props.confirmed}/>
          )
        }
        <div className={styles.txActions}>
          <button
            type='button'
            className={styles.transactionDetailsButton}
            aria-label={`View transaction details for ${props.hash}`}
            onClick={(event) => {
              event.stopPropagation();
              setDetailsOpen(true);
            }}
          >
            <Icon name='transactions' size={15}/>
            Transaction details
          </button>
        </div>
      </div>

      <CSSTransition in={expanded} unmountOnExit={true} timeout={300} classNames='history-tx-details' onExit={() => setDetailsAnimating(true)} onExited={() => setDetailsAnimating(false)}>
        <div className={styles.txDetails}>
          <div className={styles.txMetadata}>
            <span className={styles.txBlockTime}>
              {formatTime(props.time)}
            </span>
            <div className={styles.txHashGroup}>
              <a
                className={styles.txHash}
                href={explorer.transactionUrl(props.hash)}
                title={props.hash}
                aria-label={`View transaction ${props.hash} in Bytecoin Explorer`}
                target='_blank'
                rel='noreferrer noopener'
              >
                {props.hash}
              </a>
              <button
                type='button'
                className={styles.txHashCopy}
                aria-label={hashCopyStatus === 'copied' ? 'Transaction hash copied' : 'Copy transaction hash'}
                onClick={() => void copyTransactionHash()}
              >
                <Icon name={hashCopyStatus === 'copied' ? 'check' : 'copy'} size={14}/>
                {hashCopyStatus === 'copied' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <span className={`${styles.txConfirmation} ${props.confirmed ? styles.txConfirmed : styles.txUnconfirmed}`}>
              {confirmationStatus}
            </span>
            <span className={styles.txFee}>
              Fee {util.formatBCN(props.fee, 3)}
            </span>
          </div>
          {!props.confirmed && <div className={styles.txConfirmationProgress}>
            <div className={styles.txConfirmationProgressLabel}>
              <span>Confirmation progress</span>
              <span>{confirmationCount} of {requiredConfirmationCount}</span>
            </div>
            <div
              className={styles.txConfirmationProgressTrack}
              role='progressbar'
              aria-label='Transaction confirmation progress'
              aria-valuemin={0}
              aria-valuemax={requiredConfirmationCount}
              aria-valuenow={confirmationCount}
              aria-valuetext={`${confirmationCount} of ${requiredConfirmationCount} confirmations`}
            >
              <span
                className={styles.txConfirmationProgressFill}
                style={{width: `${confirmationCount / requiredConfirmationCount * 100}%`}}
              />
            </div>
          </div>}
          {hashCopyStatus && <div
            className={`${styles.txHashCopyStatus} ${hashCopyStatus === 'copied' ? styles.txHashCopySuccess : styles.txHashCopyError}`}
            role='status'
            aria-live='polite'
          >
            {hashCopyStatus === 'copied' ? 'Transaction hash copied.' :
              hashCopyStatus === 'unavailable' ? 'Clipboard access is unavailable in this browser.' :
                'Could not access the clipboard.'}
          </div>}
          {
            props.transfers.spend.map((t) =>
              <Transfer key={`spend-${t.address}`} detailed={true} {...t}/>
            )
          }
          {
            props.transfers.send.map((t) =>
              <Transfer key={`send-${t.address}`} detailed={true} genSendproof={true} {...t}/>
            )
          }
          {
            props.transfers.receive.map((t) =>
              <Transfer key={`receive-${t.address}`} detailed={true} {...t}/>
            )
          }
          {
            props.transfers.change.map((t) =>
              <Transfer key={`change-${t.address}`} detailed={true} {...t}/>
            )
          }
        </div>
      </CSSTransition>
      {detailsOpen && <div
        className={styles.detailsBackdrop}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setDetailsOpen(false);
          }
        }}
      >
        <section
          className={styles.detailsDialog}
          role='dialog'
          aria-modal='true'
          aria-labelledby={`transaction-details-title-${props.hash}`}
        >
          <header className={styles.detailsHeader}>
            <span className={styles.detailsHeaderIcon}><Icon name='transactions' size={20}/></span>
            <div className={styles.detailsHeading}>
              <h2 id={`transaction-details-title-${props.hash}`}>Transaction details</h2>
              <span title={props.hash}>{props.hash}</span>
            </div>
            <button
              ref={detailsCloseButton}
              type='button'
              className={styles.detailsIconButton}
              aria-label='Close transaction details'
              onClick={() => setDetailsOpen(false)}
            >
              <Icon name='close' size={18}/>
            </button>
          </header>
          <div className={styles.detailsContent}>
            <dl className={styles.detailsList}>
              <div className={styles.detailsRow}>
                <dt>Network</dt>
                <dd>Bytecoin mainnet</dd>
              </div>
              <div className={styles.detailsRow}>
                <dt>Status</dt>
                <dd>
                  <span className={`${styles.detailsStatus} ${props.confirmed ? styles.detailsStatusConfirmed : styles.detailsStatusPending}`}>
                    {confirmationStatus}
                  </span>
                </dd>
              </div>
              <div className={styles.detailsRow}>
                <dt>Date</dt>
                <dd>{formatDateTime(props.time)}</dd>
              </div>
              <div className={styles.detailsRow}>
                <dt>Amount</dt>
                <dd>{util.formatBCNDelta(props.amount, 8, true)}</dd>
              </div>
              <div className={styles.detailsRow}>
                <dt>Fee</dt>
                <dd>{util.formatBCN(props.fee, 8)}</dd>
              </div>
              <div className={styles.detailsRow}>
                <dt>Transaction hash</dt>
                <dd><code className={styles.detailsCode}>{props.hash}</code></dd>
              </div>
              <div className={styles.detailsRow}>
                <dt>Block height</dt>
                <dd>{props.blockHeight > 0 ? util.formatNumber(props.blockHeight) : '—'}</dd>
              </div>
              <div className={styles.detailsRow}>
                <dt>Block hash</dt>
                <dd><code className={styles.detailsCode}>{props.blockHash || '—'}</code></dd>
              </div>
              <div className={styles.detailsRow}>
                <dt>Payment ID</dt>
                <dd><code className={styles.detailsCode}>{props.paymentId || '—'}</code></dd>
              </div>
              <div className={styles.detailsRow}>
                <dt>Anonymity level</dt>
                <dd>{props.anonymity === undefined ? '—' : util.formatNumber(props.anonymity)}</dd>
              </div>
              <div className={styles.detailsRow}>
                <dt>Unlock time</dt>
                <dd>{unlockTime}</dd>
              </div>
              <div className={styles.detailsRow}>
                <dt>Public key</dt>
                <dd><code className={styles.detailsCode}>{props.publicKey || '—'}</code></dd>
              </div>
              <div className={styles.detailsRow}>
                <dt>Coinbase</dt>
                <dd>{String(props.coinbase)}</dd>
              </div>
              <div className={styles.detailsRow}>
                <dt>Extra data</dt>
                <dd><code className={styles.detailsCode}>{props.extra || '—'}</code></dd>
              </div>
              <div className={styles.detailsRow}>
                <dt>Recipient(s)</dt>
                <dd className={styles.detailsRecipients}>
                  {recipients.length > 0 ?
                    Array.from(new Set(recipients.map((recipient) => recipient.address))).map((address) =>
                      <code key={address} className={styles.detailsCode}>{address}</code>,
                    ) :
                    '—'}
                </dd>
              </div>
            </dl>
          </div>
          <footer className={styles.detailsFooter}>
            <button type='button' className={styles.detailsCloseButton} onClick={() => setDetailsOpen(false)}>
              Close
            </button>
          </footer>
        </section>
      </div>}
    </div>
  );
});

const Transfer = React.memo((props: sync.ITransfer & {unconfirmed?: boolean, genSendproof?: boolean, detailed?: boolean, isUnlock?: boolean}) => {
  const isSpend = props.kind === sync.TransferKind.Spend;
  const isSend = props.kind === sync.TransferKind.Send;
  const isReceive = props.kind === sync.TransferKind.Receive;

  const lockedUntil = props.unlockBlockOrTimestamp > 0 ?
    props.unlockBlockOrTimestamp > sync.MAX_BLOCK_NUMBER ?
      `Locked until ${formatDateTime(new Date(props.unlockBlockOrTimestamp * 1000))}` :
      `Locked until block #${props.unlockBlockOrTimestamp}` : '';

  const [sendproof, setSendproof] = useState('');
  const wallet = useContext(util.WalletContext);

  let help = props.isUnlock ? 'Unlocked transfer' : isReceive ? 'Received to' : isSend ? 'Sent to' : isSpend ? 'Sent from' : 'Change';
  if (props.locked) {
    help += ' (locked)'
  }

  const amountClass = props.isUnlock ? `Unlocked` : props.locked ? 'Locked' : '';

  useEffect(() => {
    if (!props.genSendproof || !wallet) {
      return;
    }

    wallet.createSendproof({
      transaction_hash: props.transactionHash,
      address: props.address,
    }).then((req) => {
      setSendproof(req.sendproof)
    });
  }, [wallet, props.genSendproof, props.transactionHash, props.address]);

  return (
    <div className={styles.transfer}>
      <div className={styles.transferLeft}>
        <div className={styles.transferKind}>
          {isReceive ? <ArrowSE/> : isSend ? <ArrowNE/> : isSpend ? <ArrowSW/> : <ArrowSE/>}
        </div>
        <div className={styles.transferDetails}>
          <div className={styles.transferIcon}>
            <AddressIcon address={props.address}/>
          </div>
          <div className={styles.transferDescription}>
            <div className={styles.transferHelp}>
              {help}
            </div>
            <div className={styles.transferAddress}>
              {props.ours && <span className={styles.transferAddressOurs} role='img' aria-label='wallet address'>&#128091;</span>} {props.address}
            </div>

            <div className={styles.transferMessage}>
              {props.message && <q>{props.message}</q>}
            </div>
          </div>
        </div>
      </div>
      <div className={styles.transferRight}>
        {
          props.detailed && props.locked &&
            <div className={styles.transferUnlockTime}>
              {lockedUntil}
            </div>
        }
        <div className={`${styles.transferAmount} ${amountClass}`}>
          {util.formatBCNDelta(props.amount, props.detailed ? 3 : 2, props.ours)}
          {props.locked && <span className={styles.transferAmountLocked}>&#128274;</span>}
          {props.isUnlock && <span className={styles.transferAmountUnlocked}>&#128275;</span>}
          {props.unconfirmed && <span className={styles.transferUnconfirmed}>&#9203;</span>}
        </div>
        {
          sendproof &&
          <div className={styles.transferSendproof}>
            <a href={explorer.searchUrl(sendproof)} title='See sendproof in Bytecoin Explorer' target='_blank' rel='noreferrer noopener'>
              Sendproof
            </a>
          </div>
        }
      </div>
    </div>
  );
});

const AddressIcon = React.memo((props: {address: string}) => {
  return (
    <div className={styles.addressIcon} title={props.address}>
      <Avatar message={props.address}/>
    </div>
  );
});

export default History;
