// Copyright 2019 The Bytecoin developers.
// Licensed under the GNU Affero General Public License, version 3.

import React, {useContext, useState} from 'react';
import {checkAddressFormat} from '@bcndev/bytecoin';
import Icon from './Icon';
import * as util from './lib/util';
import * as sync from './lib/sync';
import Avatar from './Avatar';
import styles from './css/SendForm.module.css';
import {getWalletPasswordErrorMessage, verifyWalletPassword} from './lib/walletFile';

// TODO: messages
// TODO: multiple recipients
interface IPreparedTransaction {
  readonly address: string;
  readonly recipientAmount: number;
  readonly fee: number;
  readonly feePerByte: number;
  readonly anonymity: number;
  readonly paymentId: string;
  readonly totalDebit: number;
  readonly subtractFeeFromAmount: boolean;
  readonly binaryTransaction: string;
}

const DEFAULT_RECOMMENDED_FEE_PER_BYTE = 100;
const MIN_ANONYMITY = 3;
const MAX_ANONYMITY = 50;
const PAYMENT_ID_PATTERN = /^(?:[0-9a-f]{16}|[0-9a-f]{64})$/i;

function getTransactionPreparationError(error: Error | null): string {
  const message = error ? error.message : 'Unknown wallet error.';
  if (/#-301\b|not enough spendable funds/i.test(message)) {
    const minimumFee = message.match(/fee at least\s+([0-9]+(?:\.[0-9]+)?)/i);
    const feeDetails = minimumFee ? ` The minimum network fee is ${minimumFee[1]} BCN.` : '';
    return `Not enough spendable BCN to cover this amount and the network fee.${feeDetails} Reduce the amount, enable “Subtract fee from amount,” or use Send all to deduct the fee from your total. If Send all also fails, wait until more BCN is spendable.`;
  }
  return `Failed to prepare transaction: ${message}`;
}

const SendForm = React.memo((props: {
  dismiss: () => void;
  spendableBalance: number;
  recommendedFeePerByte?: number;
  initialAddress?: string;
}) => {
  const wallet = useContext(util.WalletContext);

  const [address, setAddress] = useState(props.initialAddress || '');
  const [addressMessage, setAddressMessage] = useState('');
  const [amount, setAmount] = useState(0);
  const [amountInput, setAmountInput] = useState('');
  const [addressValid, setAddressValid] = useState(!!props.initialAddress && checkAddressFormat(props.initialAddress));
  const [amountValid, setAmountValid] = useState(false);
  const [sendAll, setSendAll] = useState(false);
  const [feePerByte, setFeePerByte] = useState<number | null>(null);
  const [subtractFeeFromAmount, setSubtractFeeFromAmount] = useState(false);
  const [anonymityInput, setAnonymityInput] = useState('6');
  const [paymentId, setPaymentId] = useState('');
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);
  const [walletPassword, setWalletPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [preparedTransaction, setPreparedTransaction] = useState<IPreparedTransaction | null>(null);
  const [sendError, setSendError] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const feeRecommendation = props.recommendedFeePerByte;
  const recommendedFeePerByte = typeof feeRecommendation === 'number' &&
    Number.isSafeInteger(feeRecommendation) && feeRecommendation > 0 ?
    feeRecommendation : DEFAULT_RECOMMENDED_FEE_PER_BYTE;
  const minFeePerByte = Math.max(1, Math.floor(recommendedFeePerByte / 10));
  const maxFeePerByte = Math.max(recommendedFeePerByte + 1, recommendedFeePerByte * 2);
  const selectedFeePerByte = feePerByte === null ? recommendedFeePerByte : feePerByte;
  const anonymity = Number(anonymityInput);
  const anonymityValid = anonymityInput !== '' && Number.isSafeInteger(anonymity) &&
    anonymity >= MIN_ANONYMITY && anonymity <= MAX_ANONYMITY;
  const displayAnonymity = Number.isFinite(anonymity) ?
    Math.min(MAX_ANONYMITY, Math.max(MIN_ANONYMITY, anonymity)) : MIN_ANONYMITY;
  const anonymityProgress = ((displayAnonymity - MIN_ANONYMITY) /
    (MAX_ANONYMITY - MIN_ANONYMITY)) * 100;
  const anonymityProgressHue = Math.round(anonymityProgress * 1.2);
  const anonymityProgressColor = `hsl(${anonymityProgressHue}, 72%, 46%)`;
  const normalizedPaymentId = paymentId.trim();
  const paymentIdValid = !normalizedPaymentId || PAYMENT_ID_PATTERN.test(normalizedPaymentId);
  const sendOptionsValid = anonymityValid && paymentIdValid;

  const pasteAddress = async () => {
    if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
      setAddressMessage('Clipboard access is unavailable in this browser.');
      return;
    }

    try {
      const pastedAddress = (await navigator.clipboard.readText()).trim();
      if (!pastedAddress) {
        setAddressMessage('The clipboard is empty.');
        return;
      }

      const valid = checkAddressFormat(pastedAddress);
      setAddress(pastedAddress);
      setAddressValid(valid);
      setAddressMessage(valid ? 'Address pasted.' : 'The clipboard does not contain a valid Bytecoin address.');
      setSendError('');
    } catch (error) {
      console.warn('failed to paste wallet address', error);
      setAddressMessage('Could not access the clipboard. Paste the address manually.');
    }
  };

  const setAmountFromInput = (value: string) => {
    const parsedAmount = Number(value);
    const atomicAmount = Math.round(parsedAmount * 1e8);
    const valid = value !== '' && Number.isFinite(atomicAmount) && atomicAmount > 0;
    setAmountInput(value);
    setAmount(valid ? atomicAmount : 0);
    setAmountValid(valid);
    setSendAll(false);
    setSendError('');
  };

  const setAmountToAll = () => {
    setSendError('');
    const available = props.spendableBalance;
    if (available <= 0) {
      setAmountFromInput('');
      return;
    }
    const value = (available / 1e8).toFixed(8).replace(/\.?0+$/, '');
    setAmountInput(value);
    setAmount(available);
    setAmountValid(true);
    setSendAll(true);
    setSubtractFeeFromAmount(true);
  };

  const requestPassword = () => {
    if (sending || preparing) {
      return;
    }

    if (!wallet || !wallet.getFilename()) {
      setSendError('The wallet is not ready to send. Wait for it to finish opening and try again.');
      return;
    }

    setSendError('');
    setPasswordError('');
    setWalletPassword('');
    setPasswordPromptOpen(true);
  };

  const prepareTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!wallet || preparing || !walletPassword || !sendOptionsValid) {
      return;
    }

    setPreparing(true);
    setPasswordError('');
    try {
      try {
        await verifyWalletPassword(wallet.getFilename(), walletPassword);
      } catch (error) {
        setPasswordError(getWalletPasswordErrorMessage(error));
        setWalletPassword('');
        return;
      }

      const [txResp, errCreate] = await util.try_(wallet.createTransaction({
        transaction: {
          transfers: [{
            address,
            amount,
          }],
          ...(normalizedPaymentId ? {payment_id: normalizedPaymentId} : {}),
          anonymity,
        },
        any_spend_address: true,
        change_address: '',
        confirmed_height_or_depth: sync.CONFIRMED_DEPTH,
        fee_per_byte: selectedFeePerByte,
        subtract_fee_from_amount: subtractFeeFromAmount,
      }));
      if (txResp === undefined) {
        setPasswordPromptOpen(false);
        setWalletPassword('');
        setSendError(getTransactionPreparationError(errCreate));
        return;
      }

      const recipientTransfer = txResp.transaction.transfers ?
        txResp.transaction.transfers.find((transfer) => transfer.address === address) : undefined;
      const recipientAmount = recipientTransfer ?
        Math.abs(recipientTransfer.amount) :
        subtractFeeFromAmount ? Math.max(0, amount - txResp.transaction.fee) : amount;
      if (subtractFeeFromAmount && recipientAmount <= 0) {
        setPasswordPromptOpen(false);
        setWalletPassword('');
        setSendError('The amount is not enough to cover the network fee.');
        return;
      }

      setPreparedTransaction({
        address,
        recipientAmount,
        fee: txResp.transaction.fee,
        feePerByte: selectedFeePerByte,
        anonymity,
        paymentId: normalizedPaymentId,
        totalDebit: subtractFeeFromAmount ? amount : recipientAmount + txResp.transaction.fee,
        subtractFeeFromAmount,
        binaryTransaction: txResp.binary_transaction,
      });
      setReviewError('');
      setPasswordPromptOpen(false);
      setWalletPassword('');
    } finally {
      setPreparing(false);
    }
  };

  const sendPreparedTransaction = async () => {
    if (!wallet || !preparedTransaction || sending) {
      return;
    }

    setSending(true);
    setReviewError('');
    try {
      const approved = await util.bioApprove('Bytecoin Zero', 'bytecoin-zero-user', 'Bytecoin Zero User');
      if (!approved) {
        setReviewError('Additional authentication was canceled. No transaction was sent.');
        return;
      }

      const [sendResp, errSend] = await util.try_(wallet.sendTransaction({
        binary_transaction: preparedTransaction.binaryTransaction,
      }));
      if (sendResp === undefined) {
        setReviewError(`Failed to send transaction: ${errSend}`);
        return;
      }

      setSendSuccess(true);
    } catch (error) {
      console.error('failed to send transaction', error);
      setReviewError(`Could not send transaction: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.sendForm}>
      <div className={styles.transfer}>
        {addressValid && <div className={styles.addressViz}>
            <Avatar message={address}/>
        </div>}
        <div className={styles.transferBody}>
          <div className={styles.addressGroup}>
            <input
              className={`${addressValid ? 'valid' : 'invalid'}`}
              type='text'
              placeholder='Bytecoin address: bcnZ… or 2…'
              value={address}
              onChange={(e) => {
                const addr = e.target.value;
                setAddress(addr);
                setAddressValid(checkAddressFormat(addr));
                setAddressMessage('');
                setSendError('');
              }}
            />
            <button type='button' className={styles.pasteButton} onClick={pasteAddress} aria-label='Paste address' title='Paste address'>
              <Icon name='paste' size={17}/>
            </button>
          </div>
          {addressMessage && <p className={styles.addressMessage} role='status' aria-live='polite'>{addressMessage}</p>}
          <div className={styles.amountGroup}>
            <input
              className={`${amountValid ? 'valid' : 'invalid'}`}
              type='number'
              placeholder={util.formatBCN(0)}
              min='0.00000001'
              step='0.00000001'
              value={amountInput}
              onChange={(e) => setAmountFromInput(e.target.value)}
            />
            <button
              type='button'
              className={styles.sendAllButton}
              onClick={setAmountToAll}
              disabled={sending || props.spendableBalance <= 0}
              title='Use all spendable BCN; the network fee is deducted from the total.'
            >
              Send all
            </button>
          </div>
        </div>
      </div>
      <section className={styles.transactionOptions} aria-label='Transaction options'>
        <div className={styles.feeRateHeader}>
          <p className={styles.feeRecommendation}>
            Recommended fee rate: <strong>{util.formatNumber(recommendedFeePerByte)} atomic units per byte</strong>
          </p>
          <output
            className={styles.feeRateOutput}
            aria-label={`Selected fee rate: ${selectedFeePerByte} atomic units per byte`}
          >
            {util.formatNumber(selectedFeePerByte)} / byte
          </output>
        </div>
        <div className={styles.feeControls}>
          <div className={styles.feeRateControl}>
            <input
              type='range'
              min={minFeePerByte}
              max={maxFeePerByte}
              step='1'
              value={selectedFeePerByte}
              aria-label='Fee rate'
              aria-valuetext={`${selectedFeePerByte} atomic units per byte`}
              onChange={(event) => setFeePerByte(Number(event.target.value))}
            />
            <div className={styles.feeScale}><span>Slow</span><span>Fast</span></div>
          </div>
          <div>
            <label className={styles.subtractFeeOption}>
              <input
                type='checkbox'
                checked={subtractFeeFromAmount}
                disabled={sendAll || sending || preparing}
                onChange={(event) => setSubtractFeeFromAmount(event.target.checked)}
              />
              Subtract fee from amount
            </label>
            {sendAll && <p className={styles.optionHint}>Send all automatically deducts the network fee.</p>}
          </div>
        </div>
        <div className={styles.optionalFields}>
          <label className={styles.optionField} htmlFor='send-anonymity'>
            Anonymity level
            <input
              id='send-anonymity'
              type='number'
              min={MIN_ANONYMITY}
              max={MAX_ANONYMITY}
              step='1'
              value={anonymityInput}
              aria-invalid={!anonymityValid}
              aria-describedby={!anonymityValid ? 'send-anonymity-error' : undefined}
              onChange={(event) => setAnonymityInput(event.target.value)}
            />
            <div
              className={styles.anonymityProgress}
              role='progressbar'
              aria-label='Anonymity level'
              aria-valuemin={MIN_ANONYMITY}
              aria-valuemax={MAX_ANONYMITY}
              aria-valuenow={displayAnonymity}
              aria-valuetext={`${displayAnonymity} of ${MAX_ANONYMITY}`}
            >
              <span
                className={styles.anonymityProgressFill}
                style={{width: `${anonymityProgress}%`, color: anonymityProgressColor}}
              />
            </div>
            <div className={styles.anonymityScale} aria-hidden='true'>
              <span>{MIN_ANONYMITY}</span><span>{MAX_ANONYMITY}</span>
            </div>
          </label>
          <label className={styles.optionField} htmlFor='send-payment-id'>
            Payment ID
            <input
              id='send-payment-id'
              type='text'
              placeholder='Enter an ID only if the recipient requested one'
              value={paymentId}
              aria-invalid={!paymentIdValid}
              aria-describedby={!paymentIdValid ? 'send-payment-id-error' : undefined}
              onChange={(event) => setPaymentId(event.target.value)}
            />
          </label>
        </div>
        {!anonymityValid && <p id='send-anonymity-error' className={styles.optionError} role='alert'>
          Anonymity level must be a whole number between {MIN_ANONYMITY} and {MAX_ANONYMITY}.
        </p>}
        {!paymentIdValid && <p id='send-payment-id-error' className={styles.optionError} role='alert'>
          Payment ID must contain 16 or 64 hexadecimal characters.
        </p>}
      </section>
      {sendError && <p className={styles.sendError} role='alert'>{sendError}</p>}
      <div className={styles.controls}>
        <button type='button' className={styles.sendButton} onClick={requestPassword} disabled={sending || preparing || !addressValid || !amountValid || !sendOptionsValid}>
          <Icon name='send' size={16}/>
          Review &amp; Send
        </button>

        <button type='button' className={styles.cancelButton} onClick={props.dismiss}>
          <Icon name='close' size={16}/>
          Cancel
        </button>
      </div>
      {passwordPromptOpen && <div className={styles.modalBackdrop}>
        <section
          className={styles.dialog}
          role='dialog'
          aria-modal='true'
          aria-labelledby='send-password-title'
          aria-describedby='send-password-description'
        >
          <div className={styles.dialogHeader}>
            <span className={styles.dialogIcon}><Icon name='shield' size={21}/></span>
            <div>
              <h2 id='send-password-title'>Confirm your wallet password</h2>
              <p id='send-password-description'>Your password is checked locally before transaction details are prepared.</p>
            </div>
          </div>
          <form className={styles.passwordForm} onSubmit={(event) => void prepareTransaction(event)}>
            <label htmlFor='send-wallet-password'>Wallet password</label>
            <input
              id='send-wallet-password'
              type='password'
              autoComplete='current-password'
              value={walletPassword}
              onChange={(event) => {
                setWalletPassword(event.target.value);
                setPasswordError('');
              }}
              required
              autoFocus
              disabled={preparing}
            />
            {passwordError && <p className={styles.dialogError} role='alert' aria-live='assertive'>{passwordError}</p>}
            <div className={styles.dialogActions}>
              <button
                type='button'
                className={styles.dialogSecondaryButton}
                onClick={() => {
                  setPasswordPromptOpen(false);
                  setWalletPassword('');
                  setPasswordError('');
                }}
                disabled={preparing}
              >Cancel</button>
              <button type='submit' className={styles.dialogPrimaryButton} disabled={preparing || !walletPassword}>
                <Icon name='shield' size={16}/>{preparing ? 'Preparing review…' : 'Continue'}
              </button>
            </div>
          </form>
        </section>
      </div>}
      {preparedTransaction && <div className={styles.modalBackdrop}>
        <section
          className={styles.dialog}
          role='dialog'
          aria-modal='true'
          aria-labelledby='send-review-title'
          aria-describedby='send-review-description'
        >
          <div className={styles.dialogHeader}>
            <span className={`${styles.dialogIcon} ${sendSuccess ? styles.successDialogIcon : ''}`}>
              {sendSuccess ?
                <svg className={styles.successCheckIcon} viewBox='0 0 40 40' focusable='false' aria-hidden='true'>
                  <circle className={styles.successCircle} cx='20' cy='20' r='17'/>
                  <path className={styles.successCheck} d='m11 20 6 6 12-13'/>
                </svg> :
                <Icon name='send' size={21}/>}
            </span>
            <div>
              <h2 id='send-review-title'>{sendSuccess ? 'Transaction sent successfully' : 'Review transaction'}</h2>
              <p id='send-review-description'>{sendSuccess ?
                'Your transaction was submitted to the Bytecoin network. It may take some time to receive confirmations.' :
                'Check every detail carefully. Blockchain transactions cannot be reversed.'}</p>
            </div>
          </div>
          <dl className={styles.reviewDetails}>
            <div className={styles.reviewRow}>
              <dt>Network</dt>
              <dd>Bytecoin</dd>
            </div>
            <div className={styles.reviewRow}>
              <dt>Recipient</dt>
              <dd className={styles.reviewAddress}>{preparedTransaction.address}</dd>
            </div>
            <div className={styles.reviewRow}>
              <dt>{preparedTransaction.subtractFeeFromAmount ? 'Recipient receives' : 'Amount'}</dt>
              <dd>{util.formatBCN(preparedTransaction.recipientAmount, 8)}</dd>
            </div>
            <div className={styles.reviewRow}>
              <dt>Network fee</dt>
              <dd>{util.formatBCN(preparedTransaction.fee, 8)}</dd>
            </div>
            <div className={styles.reviewRow}>
              <dt>Fee rate</dt>
              <dd>{util.formatNumber(preparedTransaction.feePerByte)} atomic units per byte</dd>
            </div>
            <div className={styles.reviewRow}>
              <dt>Anonymity level</dt>
              <dd>{preparedTransaction.anonymity}</dd>
            </div>
            {preparedTransaction.paymentId && <div className={styles.reviewRow}>
              <dt>Payment ID</dt>
              <dd className={styles.reviewAddress}>{preparedTransaction.paymentId}</dd>
            </div>}
            <div className={`${styles.reviewRow} ${styles.reviewTotal}`}>
              <dt>Total deducted</dt>
              <dd>{util.formatBCN(preparedTransaction.totalDebit, 8)}</dd>
            </div>
          </dl>
          {sendSuccess && <p className={styles.successStatus} role='status' aria-live='polite'>
            Your transaction was sent successfully.
          </p>}
          {preparedTransaction.subtractFeeFromAmount && <p className={styles.feeNotice}>
            The network fee is deducted from the total; the recipient receives the amount shown above.
          </p>}
          {reviewError && <p className={styles.dialogError} role='alert' aria-live='assertive'>{reviewError}</p>}
          <div className={styles.dialogActions}>
            {sendSuccess ?
              <button type='button' className={styles.dialogPrimaryButton} onClick={props.dismiss}>Done</button> :
              <>
                <button
                  type='button'
                  className={styles.dialogSecondaryButton}
                  onClick={() => {
                    setPreparedTransaction(null);
                    setReviewError('');
                  }}
                  disabled={sending}
                >Edit details</button>
                <button
                  type='button'
                  className={styles.dialogPrimaryButton}
                  onClick={() => void sendPreparedTransaction()}
                  disabled={sending}
                >
                  <Icon name='send' size={16}/>{sending ? 'Sending…' : 'Send'}
                </button>
              </>}
          </div>
        </section>
      </div>}
    </div>
  );
});

export default SendForm;
