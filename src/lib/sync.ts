// Copyright 2019 The Bytecoin developers.
// Licensed under the GNU Affero General Public License, version 3.

import {startOfDay} from 'date-fns';
import * as walletd from './walletd';
import * as util from './util';

export interface IStatus {
  readonly topBlockHeight: number;
  readonly topBlockTime: Date;
  readonly topBlockHash: string;
  readonly topKnownBlockHeight: number;
  readonly recommendedFeePerByte?: number;
  readonly lowerLevelError: string;
  readonly connectionError: string;
}

export function isDaemonVersionIncompatible(status: Pick<IStatus, 'lowerLevelError' | 'connectionError'>): boolean {
  return /INCOMPATIBLE_DAEMON_VERSION|sync_blocks_v3\.5\.2|sync_mem_pool_v3\.5\.2/i
    .test(`${status.lowerLevelError} ${status.connectionError}`);
}

export interface IBalance {
  readonly spendable: number;
  readonly lockedOrUnconfirmed: number;
}

export interface IAddress {
  readonly address: string;
  readonly label: string;
}

export interface IBlockHeader {
  readonly confirmed: boolean;
  readonly hash: string;
  readonly height: number;
  readonly time: Date;
  readonly date: Date; // guaranteed to be monotonically increasing, unlike time
}

export interface IBlock {
  readonly header: IBlockHeader;
  readonly transactions: ITransaction[];
  readonly unlockedTransfers: ITransfer[];
}

export interface IDay {
  readonly date: Date;
  readonly blocks: IBlock[];
}

export enum TxKind {
  Send         = 0, // outgoing, balance delta <= 0
  Receive      = 1, // incoming, balance delta >= 0
  Redistribute = 2, // internal, balance delta == 0
}

export interface ITransaction {
  readonly time: Date;
  readonly kind: TxKind;
  readonly hash: string;
  readonly amount: number;
  readonly fee: number;
  readonly paymentId?: string;
  readonly anonymity?: number;
  readonly unlockBlockOrTimestamp?: number;
  readonly publicKey: string;
  readonly coinbase: boolean;
  readonly extra: string;
  readonly summary: ITransfer[];
  readonly transfers: IGroupedTransfers;
}

export interface IGroupedTransfers {
  readonly spend: ITransfer[];
  readonly send: ITransfer[];
  readonly receive: ITransfer[];
  readonly change: ITransfer[];
}

export enum TransferKind {
  Spend   = 0, //  ours, amount <  0
  Send    = 1, // !ours, amount >= 0 (only in TxKind.Send)
  Receive = 2, //  ours, amount >= 0
  Change  = 3, //  ours, amount >  0 (only in TxKind.Send)
}

export interface ITransfer {
  readonly kind: TransferKind;
  readonly address: string;
  readonly amount: number;
  readonly message: string;
  readonly ours: boolean;
  readonly locked: boolean;
  readonly unlockBlockOrTimestamp: number;
  readonly transactionHash: string;
}

export interface IWalletInstanceInfo {
  readonly viewOnly: boolean;
  readonly lastOpen: number;
}

export interface IAddressWalletsInfo {
  [filename: string]: IWalletInstanceInfo;
}

export interface IExistingWalletInfo {
  [addr: string]: IAddressWalletsInfo;
}

export const MAX_BLOCK_NUMBER = 500000000;
const WALLET_ADDRESS_COUNT_STORAGE_PREFIX = 'bytecoin-zero-address-count:';

function isWalletClosedErr(err: Error | null): boolean {
  return err !== null && (err.message.indexOf('#-32600: Wallet closed') !== -1 || err.message.indexOf('#-32600: Wallet must be open') !== -1);
}

export function getRememberedWalletAddressCount(filename: string): number {
  if (!filename) {
    return 0;
  }

  const storedCount = window.localStorage.getItem(`${WALLET_ADDRESS_COUNT_STORAGE_PREFIX}${filename}`);
  if (storedCount === null) {
    return 0;
  }

  const count = Number(storedCount);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('The saved wallet address count is invalid.');
  }
  return count;
}

export function rememberWalletAddressCount(filename: string, count: number): void {
  if (!filename) {
    throw new Error('The wallet file name is unavailable.');
  }
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('The wallet address count is invalid.');
  }

  const key = `${WALLET_ADDRESS_COUNT_STORAGE_PREFIX}${filename}`;
  const storedCount = getRememberedWalletAddressCount(filename);
  window.localStorage.setItem(key, String(Math.max(storedCount, count)));
}

export async function start(
  isFile: boolean,
  description: string,
  isNew: boolean,
  viewOnly: boolean,
  nodeAddress: string,
  walletPassword: string,
  setWallet: (wallet: walletd.Walletd) => void,
  setStatus: (status: IStatus) => void,
  setBalance: (balance: IBalance) => void,
  setAddresses: (addresses: IAddress[]) => void,
  setHistory: (days: IDay[]) => void,
) {
  const timestamp = isNew ? Math.round(Date.now().valueOf() / 1000) : 0;

  const [instance, err] = await util.try_(walletd.Walletd.create(
    nodeAddress, isFile, description, timestamp, walletPassword,
  ));
  if (instance === undefined) {
    alert(`Failed to open wallet: ${err}`);
    return;
  }

  try {
    const rememberedAddressCount = getRememberedWalletAddressCount(instance.getFilename());
    if (rememberedAddressCount > 0) {
      const walletInfo = await instance.getWalletInfo({need_secrets: false});
      if (walletInfo.wallet_type === 'amethyst' && rememberedAddressCount > walletInfo.total_address_count) {
        const missingAddressCount = rememberedAddressCount - walletInfo.total_address_count;
        const restoredAddresses = await instance.createAddresses({
          secret_spend_keys: new Array(missingAddressCount).fill(''),
        });
        if (restoredAddresses.addresses.length !== missingAddressCount) {
          throw new Error('The wallet did not restore all previously added addresses.');
        }

        const updatedWalletInfo = await instance.getWalletInfo({need_secrets: false});
        if (updatedWalletInfo.total_address_count < rememberedAddressCount) {
          throw new Error('The wallet address count could not be restored.');
        }
      }
    }

    setWallet(instance);

    let lastStatusTime = Date.now() - STATUS_POLL_DELAY_MS;
    let lastStatusReq: walletd.IGetStatusReq = {};
    let lastKnownStatus: IStatus = {
      topBlockHeight: 0,
      topBlockTime: new Date(0),
      topBlockHash: '',
      topKnownBlockHeight: 0,
      lowerLevelError: '',
      connectionError: '',
    };
    let statusPollDelay = STATUS_POLL_DELAY_MS;
    const reportConnectionError = (error: Error | null) => {
      statusPollDelay = Math.min(statusPollDelay * 2, MAX_STATUS_RETRY_DELAY_MS);
      lastKnownStatus = {
        ...lastKnownStatus,
        connectionError: error ? error.message : 'Unknown connection error.',
      };
      setStatus(lastKnownStatus);
      lastStatusTime = Date.now();
    };

    let walletAddressesLoaded = false;
    let walletRecordsErrorReported = false;
    const loadWalletRecords = async (): Promise<boolean> => {
      const [walletRecords, err] = await util.try_(instance.getWalletRecords({
        index: 0,
        count: 0xffffffff,
      }));
      if (walletRecords === undefined) {
        if (isWalletClosedErr(err)) {
          return false;
        }
        if (!walletRecordsErrorReported) {
          console.warn('failed to get wallet records', err);
          walletRecordsErrorReported = true;
        }
        return false;
      }

      if (instance.getFilename() !== '' && walletRecords.records.length > 0) {
        const key = `wallet.${walletRecords.records[0].address}`;
        const info: IAddressWalletsInfo = JSON.parse(window.localStorage.getItem(key) || '{}');
        info[instance.getFilename()] = {
          lastOpen: Date.now().valueOf(),
          viewOnly,
        };
        window.localStorage.setItem(key, JSON.stringify(info));
      }

      setAddresses(walletRecords.records.map((record): IAddress => ({
        address: record.address,
        label: record.label,
      })));
      return true;
    };

    let state = new TransferState();
    let height = 0;
    let days: IDay[] = [];

syncLoop:
    while (height >= 0) {
      if (!walletAddressesLoaded) {
        walletAddressesLoaded = await loadWalletRecords();
      }
      lastStatusTime = await util.delay(statusPollDelay, lastStatusTime);

      const [status, errStatus] = await util.try_(instance.getStatus(lastStatusReq));
      if (status === undefined) {
        console.warn('failed to get status', lastStatusReq, errStatus);
        if (isWalletClosedErr(errStatus)) {
          return;
        } else {
          reportConnectionError(errStatus);
          continue;
        }
      } else if (status.top_known_block_height === 0) {
        reportConnectionError(new Error('The node responded but has not reported a blockchain height yet.'));
        continue;
      }

      statusPollDelay = STATUS_POLL_DELAY_MS;
      lastStatusReq = {
        top_block_hash: status.top_block_hash,
        transaction_pool_version: status.transaction_pool_version,
        lower_level_error: status.lower_level_error,
      };

      lastKnownStatus = {
        topBlockHeight: status.top_block_height,
        topBlockTime: new Date(status.top_block_timestamp * 1000),
        topBlockHash: status.top_block_hash,
        topKnownBlockHeight: status.top_known_block_height,
        recommendedFeePerByte: status.recommended_fee_per_byte,
        lowerLevelError: status.lower_level_error,
        connectionError: '',
      };
      setStatus(lastKnownStatus);

      const req = {
        height_or_depth: CONFIRMED_DEPTH, // do not use confirmedHeight() here to avoid an error during fast sync
      };
      const [balance, errBalance] = await util.try_(instance.getBalance(req));
      if (balance === undefined) {
        console.warn('failed to get balance', req, errBalance);
        if (isWalletClosedErr(errBalance)) {
          return;
        } else {
          reportConnectionError(errBalance);
          continue;
        }
      }
      setBalance({
        spendable: balance.spendable,
        lockedOrUnconfirmed: balance.locked_or_unconfirmed,
      });

      const confHeight = confirmedHeight(status.top_block_height);

      if (height === 0 && confHeight !== 0) {
        const req = {
          from_height: height,
          to_height: confHeight,
          forward: false,
          desired_transaction_count: TX_HISTORY_SIZE,
        };
        const [transferData, err] = await util.try_(instance.getTransfers(req));
        if (transferData === undefined) {
          console.warn('failed to get history transfers', req, err);
          if (isWalletClosedErr(err)) {
            return;
          } else {
            reportConnectionError(err);
            continue;
          }
        }

        state.mergeConfirmedFuture((transferData.blocks || []).reverse());
        height = confHeight;
      } else {
        while (height < confHeight) {
          const req = {
            from_height: height,
            to_height: confHeight,
            forward: true,
            desired_transaction_count: TX_CATCH_UP_BATCH_SIZE,
          };

          const [transferData, err] = await util.try_(instance.getTransfers(req));
          if (transferData === undefined) {
            console.warn('failed to get transfers', req, err);
            if (isWalletClosedErr(err)) {
              return;
            } else {
              reportConnectionError(err);
              continue syncLoop;
            }
          }

          state.mergeConfirmedFuture(transferData.blocks || []);
          height = transferData.next_from_height;
        }

        state.resetUnconfirmedFuture();
        const mempoolHeight = status.top_block_height + 1;
        let unconfirmedHeight = height;

        while (unconfirmedHeight < mempoolHeight) {
          const req = {
            from_height: unconfirmedHeight,
            to_height: mempoolHeight,
            forward: true,
            desired_transaction_count: TX_CATCH_UP_BATCH_SIZE,
          };

          const [transferData, err] = await util.try_(instance.getTransfers(req));
          if (transferData === undefined) {
            console.warn('failed to get future transfers', req, err);
            if (isWalletClosedErr(err)) {
              return;
            } else {
              reportConnectionError(err);
              continue syncLoop;
            }
          }

          state.mergeUnconfirmedFuture(transferData.blocks || []);
          unconfirmedHeight = transferData.next_from_height;
        }
      }

      const newDays = state.mergeUnconfirmed();
      if (newDays !== days) {
        days = newDays;
        setHistory(days);
      }
    }
  } catch (err) {
    alert(`Unexpected error: ${err}\n\nPlease try reloading this page.`);
  } finally {
    await instance.close();
  }
}

const STATUS_POLL_DELAY_MS = 2000;
const MAX_STATUS_RETRY_DELAY_MS = 30000;
export const CONNECTION_ERROR_GRACE_PERIOD_MS = 5000;

export const REQUIRED_CONFIRMATIONS = 10;
const BLOCKS_AFTER_INCLUSION_FOR_CONFIRMATION = REQUIRED_CONFIRMATIONS - 1;
export const CONFIRMED_DEPTH = -REQUIRED_CONFIRMATIONS;
const TX_HISTORY_SIZE = 1000;                      // TODO incremental history loading
const TX_CATCH_UP_BATCH_SIZE = 100;

function confirmedHeight(height: number): number {
  return Math.max(height - BLOCKS_AFTER_INCLUSION_FOR_CONFIRMATION, 0);
}

class TransferState {
  private confirmedDays:   IDay[] = []; // reverse chronological order
  private unconfirmedDays: IDay[] = []; // reverse chronological order

  mergeConfirmedFuture(blocks: walletd.IBlock[]): void {
    this.confirmedDays = TransferState.mergeFuture(this.confirmedDays, blocks, true);
  }

  resetUnconfirmedFuture(): void {
    this.unconfirmedDays = [];
  }

  mergeUnconfirmedFuture(blocks: walletd.IBlock[]): void {
    this.unconfirmedDays = TransferState.mergeFuture(this.unconfirmedDays, blocks, false);
  }

  mergeUnconfirmed(): IDay[] {
    return TransferState.mergeDays(this.confirmedDays, this.unconfirmedDays);
  }

  private static mergeFuture(base: IDay[], blocks: walletd.IBlock[], confirmed: boolean): IDay[] {
    const newBlocks = blocks.map((b) => TransferState.transformBlock(b, confirmed)).reverse();
    const newBlocksByDateTimestamp = util.groupBy(newBlocks, (block) => block.header.date.valueOf());

    const newDays: IDay[] = [];
    for (const [timestamp, blocks] of newBlocksByDateTimestamp) {
      newDays.push({
        date: new Date(timestamp),
        blocks,
      });
    }

    return TransferState.mergeDays(base, newDays);
  }

  private static mergeDays(base: IDay[], newDays: IDay[]): IDay[] {
    if (newDays.length === 0) {
      return base;
    }

    if (base.length > 0 && newDays[newDays.length-1].date.valueOf() === base[0].date.valueOf()) {
      const mergedDay: IDay = {
        date: newDays[newDays.length-1].date,
        blocks: [...newDays[newDays.length-1].blocks,  ...base[0].blocks],
      };

      return [...newDays.slice(0, newDays.length-1), mergedDay, ...base.slice(1)];
    } else {
      return [...newDays, ...base];
    }
  }

  private static transformBlock(block: walletd.IBlock, confirmed: boolean): IBlock {
    const transactions: ITransaction[] = (block.transactions || []).map((tx) => {
      const txKind = txKindFromTransfers(tx.transfers || []);

      const transfers: ITransfer[] = (tx.transfers || []).map((transfer) => ({
        kind: transferKind(transfer.amount, transfer.ours || false, txKind),
        address: transfer.address,
        amount: transfer.amount,
        message: transfer.message || '',
        ours: transfer.ours || false,
        locked: transfer.locked || false,
        unlockBlockOrTimestamp: transfer.unlock_block_or_timestamp || 0,
        transactionHash: transfer.transaction_hash || '',
      }));

      const groupedTransfers = {
        spend: transfers.filter((t) => t.kind === TransferKind.Spend),
        send: transfers.filter((t) => t.kind === TransferKind.Send),
        receive: transfers.filter((t) => t.kind === TransferKind.Receive),
        change: transfers.filter((t) => t.kind === TransferKind.Change),
      };

      let summary: ITransfer[] = [];
      switch (txKind) {
        case TxKind.Send:
          summary = groupedTransfers.send;
          break;
        case TxKind.Receive:
          summary = groupedTransfers.receive;
          break;
        case TxKind.Redistribute:
          const transfersByAddr = [...util.groupBy(transfers, (t) => t.address)];
          summary = transfersByAddr.map(([addr, addrTransfers]): ITransfer => {
            const totalAmount = addrTransfers.reduce((sum, t) => sum + t.amount, 0);
            return {
              kind: totalAmount < 0 ? TransferKind.Spend : TransferKind.Receive,
              address: addr,
              amount: totalAmount,
              message: addrTransfers.map((t) => t.message).filter((msg) => msg.length > 0).join(' | '),
              ours: true,
              locked: addrTransfers.some((t) => t.locked),
              unlockBlockOrTimestamp: 0,
              transactionHash: tx.hash,
            };
          }).sort((t1, t2) => t1.kind - t2.kind);
          break;
      }

      return {
        time: new Date(tx.timestamp * 1000),
        kind: txKind,
        hash: tx.hash,
        amount: tx.amount,
        fee: tx.fee,
        paymentId: tx.payment_id,
        anonymity: tx.anonymity,
        unlockBlockOrTimestamp: tx.unlock_block_or_timestamp,
        publicKey: tx.public_key,
        coinbase: tx.coinbase,
        extra: tx.extra,
        summary,
        transfers: groupedTransfers,
      };
    });

    const unlockedTransfers: ITransfer[] = (block.unlocked_transfers || []).map((transfer) => {
      return {
        kind: transferKind(transfer.amount, transfer.ours || false, TxKind.Receive),
        address: transfer.address,
        amount: transfer.amount,
        message: transfer.message || '',
        ours: transfer.ours || false,
        locked: false,
        unlockBlockOrTimestamp: 0,
        transactionHash: transfer.transaction_hash || '',
      };
    });

    // mempool "block" header can omit timestamps
    const blockMonotonicTime = block.header.timestamp_median > 0 ?
      new Date(block.header.timestamp_median * 1000) :
      transactions.length > 0 ? transactions[0].time : new Date();

    return {
      header: {
        confirmed,
        hash: block.header.hash,
        height: block.header.height,
        time: new Date(block.header.timestamp * 1000),
        date: startOfDay(blockMonotonicTime),
      },
      transactions: transactions.reverse(),
      unlockedTransfers: unlockedTransfers.reverse(),
    };
  }
}

function txKindFromTransfers(transfers: {ours?: boolean, amount: number}[]): TxKind {
  const allOurs = transfers.every((t) => t.ours || false);
  if (!allOurs) {
    return TxKind.Send;
  }

  const allAmountsNonNeg = transfers.every((t) => t.amount >= 0);
  if (allOurs && allAmountsNonNeg) {
    return TxKind.Receive;
  }

  return TxKind.Redistribute;
}

function transferKind(amount: number, ours: boolean, txKind: TxKind): TransferKind {
  if (!ours) {
    return TransferKind.Send;
  }

  if (amount < 0) {
    return TransferKind.Spend;
  }

  if (txKind === TxKind.Send) {
    return TransferKind.Change;
  }

  return TransferKind.Receive;
}
