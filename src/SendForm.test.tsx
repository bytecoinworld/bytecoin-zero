import React from 'react';
import ReactDOM from 'react-dom';
import {act, Simulate} from 'react-dom/test-utils';
import SendForm from './SendForm';
import * as util from './lib/util';
import * as walletd from './lib/walletd';
import {verifyWalletPassword} from './lib/walletFile';

jest.mock('@bcndev/bytecoin', () => ({
  checkAddressFormat: jest.fn(() => true),
}));

jest.mock('./Avatar', () => () => null);

jest.mock('./lib/walletFile', () => ({
  verifyWalletPassword: jest.fn(),
  getWalletPasswordErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

describe('SendForm confirmation flow', () => {
  let container: HTMLDivElement;
  let wallet: walletd.Walletd;
  let walletMock: {
    getFilename: jest.Mock;
    createTransaction: jest.Mock;
    sendTransaction: jest.Mock;
  };
  let dismiss: jest.Mock;
  const recipientAddress = 'bytecoin-test-recipient';
  const transactionHash = 'prepared-transaction';
  const verifyPasswordMock = verifyWalletPassword as jest.MockedFunction<typeof verifyWalletPassword>;

  const enterDetails = () => {
    const inputs = container.querySelectorAll('input');
    act(() => {
      (inputs[0] as HTMLInputElement).value = recipientAddress;
      Simulate.change(inputs[0]);
      (inputs[1] as HTMLInputElement).value = '1.25';
      Simulate.change(inputs[1]);
    });
  };

  const openPasswordPrompt = () => {
    const button = Array.from(container.querySelectorAll('button'))
      .find((item) => item.textContent && item.textContent.includes('Review & Send'));
    expect(button).not.toBeUndefined();
    act(() => {
      Simulate.click(button as HTMLButtonElement);
    });
  };

  const enterPasswordAndSubmit = async (password: string) => {
    const input = container.querySelector('#send-wallet-password') as HTMLInputElement;
    act(() => {
      input.value = password;
      Simulate.change(input);
    });

    await act(async () => {
      Simulate.submit(container.querySelector('[aria-labelledby="send-password-title"] form') as HTMLFormElement);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    container = document.createElement('div');
    dismiss = jest.fn();
    walletMock = {
      getFilename: jest.fn(() => 'test-wallet.wallet'),
      createTransaction: jest.fn().mockResolvedValue({
        transaction: {
          transfers: [{address: recipientAddress, amount: -125000000}],
          fee: 250000,
        },
        binary_transaction: transactionHash,
      }),
      sendTransaction: jest.fn().mockResolvedValue({}),
    };
    wallet = walletMock as unknown as walletd.Walletd;
    verifyPasswordMock.mockResolvedValue(undefined);
    jest.spyOn(util, 'bioApprove').mockResolvedValue(true);
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    jest.restoreAllMocks();
  });

  const render = () => {
    act(() => {
      ReactDOM.render(
        <util.WalletContext.Provider value={wallet}>
          <SendForm dismiss={dismiss} spendableBalance={500000000} recommendedFeePerByte={100}/>
        </util.WalletContext.Provider>,
        container,
      );
    });
  };

  it('requires the password, reviews the transaction, then sends only on final confirmation', async () => {
    render();
    enterDetails();
    openPasswordPrompt();

    expect(container.querySelector('[aria-labelledby="send-password-title"]')).not.toBeNull();
    expect(walletMock.createTransaction).not.toHaveBeenCalled();
    expect(walletMock.sendTransaction).not.toHaveBeenCalled();

    await enterPasswordAndSubmit('correct-password');

    expect(verifyPasswordMock).toHaveBeenCalledWith('test-wallet.wallet', 'correct-password');
    expect(container.querySelector('[aria-labelledby="send-password-title"]')).toBeNull();
    const review = container.querySelector('[aria-labelledby="send-review-title"]');
    expect(review && review.textContent).toContain(recipientAddress);
    expect(review && review.textContent).toContain('Network fee');
    expect(review && review.textContent).toContain('Total deducted');
    expect(walletMock.createTransaction).toHaveBeenCalledTimes(1);
    expect(walletMock.createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      confirmed_height_or_depth: -10,
      transaction: expect.objectContaining({
        anonymity: 6,
      }),
      fee_per_byte: 100,
      subtract_fee_from_amount: false,
    }));
    expect(walletMock.sendTransaction).not.toHaveBeenCalled();

    const reviewSendButton = Array.from(review!.querySelectorAll('button'))
      .find((button) => button.textContent && button.textContent.trim().endsWith('Send'));
    expect(reviewSendButton).not.toBeUndefined();
    await act(async () => {
      Simulate.click(reviewSendButton as HTMLButtonElement);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(walletMock.sendTransaction).toHaveBeenCalledWith({
      binary_transaction: transactionHash,
    });
    const successReview = container.querySelector('[aria-labelledby="send-review-title"]');
    expect(successReview && successReview.textContent).toContain('Transaction sent successfully');
    expect(successReview && successReview.textContent).toContain('Your transaction was sent successfully.');
    expect(successReview && successReview.querySelector('[class*="successCheckIcon"]')).not.toBeNull();
    expect(successReview && successReview.textContent).toContain('Done');
    expect(dismiss).not.toHaveBeenCalled();

    const doneButton = Array.from(successReview!.querySelectorAll('button'))
      .find((button) => button.textContent === 'Done');
    expect(doneButton).not.toBeUndefined();
    act(() => {
      Simulate.click(doneButton as HTMLButtonElement);
    });
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('uses the selected fee, fee subtraction, anonymity, and payment ID when preparing the review', async () => {
    render();
    enterDetails();
    const feeRate = container.querySelector('input[type="range"]') as HTMLInputElement;
    const subtractFee = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const anonymity = container.querySelector('#send-anonymity') as HTMLInputElement;
    const paymentId = container.querySelector('#send-payment-id') as HTMLInputElement;
    const anonymityProgress = container.querySelector('[role="progressbar"]') as HTMLDivElement;
    const progressFill = anonymityProgress.querySelector('span') as HTMLSpanElement;
    const initialProgressColor = progressFill.style.color;
    act(() => {
      feeRate.value = '160';
      Simulate.change(feeRate);
      subtractFee.checked = true;
      Simulate.change(subtractFee);
      anonymity.value = '7';
      Simulate.change(anonymity);
      paymentId.value = '0123456789abcdef';
      Simulate.change(paymentId);
    });

    expect(anonymityProgress.getAttribute('aria-valuenow')).toBe('7');
    expect(progressFill.style.color).not.toBe(initialProgressColor);
    openPasswordPrompt();
    await enterPasswordAndSubmit('correct-password');

    expect(walletMock.createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      transaction: expect.objectContaining({
        anonymity: 7,
        payment_id: '0123456789abcdef',
      }),
      fee_per_byte: 160,
      subtract_fee_from_amount: true,
    }));
    const review = container.querySelector('[aria-labelledby="send-review-title"]');
    expect(review && review.textContent).toContain('160 atomic units per byte');
    expect(review && review.textContent).toContain('Anonymity level');
    expect(review && review.textContent).toContain('0123456789abcdef');
    expect(review && review.textContent).toContain('Recipient receives');
  });

  it('keeps fee subtraction enabled when sending the full spendable balance', async () => {
    render();
    const address = container.querySelectorAll('input')[0] as HTMLInputElement;
    act(() => {
      address.value = recipientAddress;
      Simulate.change(address);
    });
    const sendAllButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Send all');
    act(() => {
      Simulate.click(sendAllButton as HTMLButtonElement);
    });

    const subtractFee = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(subtractFee.checked).toBe(true);
    expect(subtractFee.disabled).toBe(true);
    openPasswordPrompt();
    await enterPasswordAndSubmit('correct-password');

    expect(walletMock.createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      transaction: expect.objectContaining({
        transfers: [{address: recipientAddress, amount: 500000000}],
      }),
      subtract_fee_from_amount: true,
    }));
  });

  it('prevents preparing a transaction with an anonymity level above 50', () => {
    render();
    enterDetails();
    const anonymity = container.querySelector('#send-anonymity') as HTMLInputElement;
    act(() => {
      anonymity.value = '51';
      Simulate.change(anonymity);
    });

    const reviewButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent && button.textContent.includes('Review & Send'));
    expect(reviewButton && (reviewButton as HTMLButtonElement).disabled).toBe(true);
    const anonymityError = container.querySelector('[role="alert"]');
    expect(anonymityError && anonymityError.textContent).toContain('between 3 and 50');
    expect(walletMock.createTransaction).not.toHaveBeenCalled();
  });

  it('prevents preparing a transaction with an anonymity level below 3', () => {
    render();
    enterDetails();
    const anonymity = container.querySelector('#send-anonymity') as HTMLInputElement;
    act(() => {
      anonymity.value = '2';
      Simulate.change(anonymity);
    });

    const reviewButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent && button.textContent.includes('Review & Send'));
    expect(anonymity.min).toBe('3');
    expect(reviewButton && (reviewButton as HTMLButtonElement).disabled).toBe(true);
    const anonymityError = container.querySelector('[role="alert"]');
    expect(anonymityError && anonymityError.textContent).toContain('between 3 and 50');
    expect(walletMock.createTransaction).not.toHaveBeenCalled();
  });

  it('keeps the review open and shows an error when sending fails', async () => {
    walletMock.sendTransaction.mockRejectedValue(new Error('Node rejected transaction.'));
    render();
    enterDetails();
    openPasswordPrompt();
    await enterPasswordAndSubmit('correct-password');

    const review = container.querySelector('[aria-labelledby="send-review-title"]');
    const sendButton = Array.from(review!.querySelectorAll('button'))
      .find((button) => button.textContent && button.textContent.trim().endsWith('Send'));
    await act(async () => {
      Simulate.click(sendButton as HTMLButtonElement);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(review && review.textContent).toContain('Failed to send transaction');
    expect(review && review.textContent).not.toContain('Transaction sent successfully');
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('does not prepare or send a transaction after an incorrect password', async () => {
    verifyPasswordMock.mockRejectedValue(new Error('Incorrect password.'));
    render();
    enterDetails();
    openPasswordPrompt();
    await enterPasswordAndSubmit('wrong-password');

    const error = container.querySelector('[role="alert"]');
    expect(error && error.textContent).toBe('Incorrect password.');
    expect(container.querySelector('[aria-labelledby="send-review-title"]')).toBeNull();
    expect(walletMock.createTransaction).not.toHaveBeenCalled();
    expect(walletMock.sendTransaction).not.toHaveBeenCalled();
  });

  it('explains insufficient spendable balance and keeps the transaction unsent', async () => {
    walletMock.createTransaction.mockRejectedValue(new Error(
      '[create_transaction] JSON-RPC error #-301: Not enough spendable funds, together with fee at least 0.20 is required to send transaction',
    ));
    render();
    enterDetails();
    openPasswordPrompt();
    await enterPasswordAndSubmit('correct-password');

    const error = container.querySelector('[role="alert"]');
    expect(error && error.textContent).toContain('Not enough spendable BCN');
    expect(error && error.textContent).toContain('minimum network fee is 0.20 BCN');
    expect(container.querySelector('[aria-labelledby="send-review-title"]')).toBeNull();
    expect(walletMock.sendTransaction).not.toHaveBeenCalled();
  });
});
