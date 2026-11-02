import React from 'react';
import ReactDOM from 'react-dom';
import {act, Simulate} from 'react-dom/test-utils';
import History from './History';
import * as sync from './lib/sync';

jest.mock('./Avatar', () => () => null);

describe('transaction history details', () => {
  let container: HTMLDivElement;
  let writeText: jest.Mock;

  const transaction = (hash: string): sync.ITransaction => ({
    time: new Date('2026-01-01T12:00:00.000Z'),
    kind: sync.TxKind.Send,
    hash,
    amount: -5015670000,
    fee: 0,
    paymentId: '0123456789abcdef',
    anonymity: 6,
    unlockBlockOrTimestamp: 0,
    publicKey: 'public-key-value',
    coinbase: false,
    extra: 'extra-data-value',
    summary: [],
    transfers: {
      spend: [],
      send: [{
        kind: sync.TransferKind.Send,
        address: 'recipient-address',
        amount: 5000000000,
        message: '',
        ours: false,
        locked: false,
        unlockBlockOrTimestamp: 0,
        transactionHash: hash,
      }],
      receive: [],
      change: [],
    },
  });

  const block = (confirmed: boolean, hash: string, height = 1): sync.IBlock => ({
    header: {
      confirmed,
      hash: `block-${hash}`,
      height,
      time: new Date('2026-01-01T12:00:00.000Z'),
      date: new Date('2026-01-01T00:00:00.000Z'),
    },
    transactions: [transaction(hash)],
    unlockedTransfers: [],
  });

  beforeEach(() => {
    container = document.createElement('div');
    writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {writeText},
    });
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
  });

  it('shows confirmation status and copies a transaction hash', async () => {
    const confirmedHash = 'a'.repeat(64);
    const unconfirmedHash = 'b'.repeat(64);
    const date = new Date('2026-01-01T00:00:00.000Z');

    act(() => {
      ReactDOM.render(
        <History history={[{
          date,
          blocks: [block(true, confirmedHash), block(false, unconfirmedHash)],
        }]} topBlockHeight={1}/>,
        container,
      );
    });

    const transactionBodies = container.querySelectorAll('[class*="txBody"]');
    expect(transactionBodies).toHaveLength(2);
    act(() => {
      Simulate.click(transactionBodies[0] as Element);
      Simulate.click(transactionBodies[1] as Element);
    });

    expect(container.textContent).toContain('Confirmed');
    expect(container.textContent).toContain('Unconfirmed');
    expect(container.querySelectorAll('[role="progressbar"]')).toHaveLength(1);

    const copyButton = container.querySelector('[aria-label="Copy transaction hash"]') as HTMLButtonElement;
    await act(async () => {
      Simulate.click(copyButton);
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(confirmedHash);
    expect(container.textContent).toContain('Transaction hash copied.');
  });

  it('shows confirmation progress for unconfirmed transactions', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');

    act(() => {
      ReactDOM.render(
        <History
          history={[{
            date,
            blocks: [block(false, 'pending-hash', 100)],
          }]}
          topBlockHeight={102}
        />,
        container,
      );
    });

    const transactionBody = container.querySelector('[class*="txBody"]');
    act(() => {
      Simulate.click(transactionBody as Element);
    });

    const progress = container.querySelector('[role="progressbar"]');
    expect(progress && progress.getAttribute('aria-valuenow')).toBe('3');
    expect(progress && progress.getAttribute('aria-valuemax')).toBe('10');
    expect(progress && progress.getAttribute('aria-valuetext')).toBe('3 of 10 confirmations');
    expect(container.textContent).toContain('3 of 10');
  });

  it('opens a transaction details dialog without toggling inline details', () => {
    const hash = 'c'.repeat(64);
    const date = new Date('2026-01-01T00:00:00.000Z');

    act(() => {
      ReactDOM.render(
        <History history={[{
          date,
          blocks: [block(true, hash, 42)],
        }]} topBlockHeight={42}/>,
        container,
      );
    });

    const detailsButton = container.querySelector('[aria-label^="View transaction details"]') as HTMLButtonElement;
    act(() => {
      Simulate.click(detailsButton);
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog && dialog.textContent).toContain('Bytecoin mainnet');
    expect(dialog && dialog.textContent).toContain('Confirmed');
    expect(dialog && dialog.textContent).toContain(hash);
    expect(dialog && dialog.textContent).toContain('Block height');
    expect(dialog && dialog.textContent).toContain('42');
    expect(dialog && dialog.textContent).toContain('0123456789abcdef');
    expect(dialog && dialog.textContent).toContain('public-key-value');
    expect(dialog && dialog.textContent).toContain('extra-data-value');
    expect(dialog && dialog.textContent).toContain('recipient-address');
    expect(container.querySelector('[class*="txDetails"]')).toBeNull();

    const closeButton = container.querySelector('[aria-label="Close transaction details"]') as HTMLButtonElement;
    act(() => {
      Simulate.click(closeButton);
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('closes the transaction details dialog with Escape', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');

    act(() => {
      ReactDOM.render(
        <History history={[{
          date,
          blocks: [block(true, 'escape-hash')],
        }]} topBlockHeight={1}/>,
        container,
      );
    });

    const detailsButton = container.querySelector('[aria-label^="View transaction details"]') as HTMLButtonElement;
    act(() => {
      Simulate.click(detailsButton);
    });
    act(() => {
      document.dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('starts at zero for unconfirmed transactions without an included block height', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');

    act(() => {
      ReactDOM.render(
        <History
          history={[{
            date,
            blocks: [block(false, 'mempool-hash', 0)],
          }]}
          topBlockHeight={102}
        />,
        container,
      );
    });

    const transactionBody = container.querySelector('[class*="txBody"]');
    act(() => {
      Simulate.click(transactionBody as Element);
    });

    const progress = container.querySelector('[role="progressbar"]');
    expect(progress && progress.getAttribute('aria-valuenow')).toBe('0');
    expect(progress && progress.getAttribute('aria-valuemax')).toBe('10');
  });

  it('shows nine confirmations while the tenth is still pending', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');

    act(() => {
      ReactDOM.render(
        <History
          history={[{
            date,
            blocks: [block(false, 'near-confirmed-hash', 101)],
          }]}
          topBlockHeight={109}
        />,
        container,
      );
    });

    const transactionBody = container.querySelector('[class*="txBody"]');
    act(() => {
      Simulate.click(transactionBody as Element);
    });

    const progress = container.querySelector('[role="progressbar"]');
    expect(progress && progress.getAttribute('aria-valuenow')).toBe('9');
    expect(progress && progress.getAttribute('aria-valuemax')).toBe('10');
  });
});
