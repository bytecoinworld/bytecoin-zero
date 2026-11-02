import React from 'react';
import ReactDOM from 'react-dom';
import {act} from 'react-dom/test-utils';
import {Status, StatusError} from './Header';
import {IStatus} from './lib/sync';

describe('sync status', () => {
  let container: HTMLDivElement;

  const status = (connectionError: string): IStatus => ({
    topBlockHeight: 0,
    topBlockTime: new Date(0),
    topBlockHash: '',
    topKnownBlockHeight: 0,
    lowerLevelError: '',
    connectionError,
  });

  beforeEach(() => {
    jest.useFakeTimers();
    container = document.createElement('div');
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    jest.useRealTimers();
  });

  it('shows indeterminate progress while waiting for the node height', () => {
    act(() => {
      ReactDOM.render(
        <Status {...status('The node has not reported a blockchain height yet.')} nodeAddress='https://node.example'/>,
        container,
      );
    });

    expect(container.querySelector('[aria-label="Waiting for node height"]')).not.toBeNull();
    expect(container.querySelector('progress')).toBeNull();
    expect(container.textContent).toContain('Connecting to node…');
  });

  it('keeps a nearly complete sync below 100% until the heights match', () => {
    act(() => {
      ReactDOM.render(
        <Status
          {...{
            ...status(''),
            topBlockHeight: 3652918,
            topBlockHash: 'current-block',
            topKnownBlockHeight: 3652919,
          }}
          nodeAddress='https://node.example'
        />,
        container,
      );
    });

    const progress = container.querySelector('progress') as HTMLProgressElement;
    expect(progress.getAttribute('value')).toBe('99');
    expect(progress.getAttribute('aria-label')).toBe('Sync progress 99%');
  });

  it('waits five seconds before showing a persistent synchronization error', () => {
    act(() => {
      ReactDOM.render(<StatusError {...status('The node is unavailable.')} />, container);
    });

    expect(container.querySelector('[role="alert"]')).toBeNull();

    act(() => {
      jest.advanceTimersByTime(4999);
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('does not show an error that clears before the delay expires', () => {
    act(() => {
      ReactDOM.render(<StatusError {...status('The node is unavailable.')} />, container);
    });

    act(() => {
      jest.advanceTimersByTime(2500);
    });

    act(() => {
      ReactDOM.render(<StatusError {...status('')} />, container);
    });

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
