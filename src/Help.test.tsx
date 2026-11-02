import React from 'react';
import ReactDOM from 'react-dom';
import {act, Simulate} from 'react-dom/test-utils';
import Help from './Help';

describe('wallet help', () => {
  let container: HTMLDivElement;
  let onClose: jest.Mock;

  beforeEach(() => {
    container = document.createElement('div');
    onClose = jest.fn();
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
  });

  it('presents the guide topics and detailed wallet instructions', () => {
    act(() => {
      ReactDOM.render(<Help onClose={onClose}/>, container);
    });

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).toContain('Create or restore a wallet');
    expect(container.textContent).toContain('Send BCN safely');
    expect(container.textContent).toContain('Back up and recover your wallet');
    expect(container.textContent).toContain('Troubleshooting');
    expect(container.textContent).toContain('Never share your recovery phrase');
  });

  it('closes on Escape and from the close button', () => {
    act(() => {
      ReactDOM.render(<Help onClose={onClose}/>, container);
    });
    act(() => {
      document.dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeButton = container.querySelector('[aria-label="Close help"]') as HTMLButtonElement;
    act(() => {
      Simulate.click(closeButton);
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
