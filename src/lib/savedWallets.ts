// Copyright 2019 The Bytecoin developers.
// Licensed under the GNU Affero General Public License, version 3.

import {checkAddressFormat} from '@bcndev/bytecoin';

export interface ISavedWalletInfo {
  firstAddress: string;
  filename: string;
  viewOnly: boolean;
  lastOpen: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function readSavedWallets(): ISavedWalletInfo[] {
  const wallets: ISavedWalletInfo[] = [];

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i) || '';
    if (!key.startsWith('wallet.')) {
      continue;
    }

    const firstAddress = key.substring('wallet.'.length);
    if (!checkAddressFormat(firstAddress)) {
      continue;
    }

    let walletInfo: unknown;
    try {
      walletInfo = JSON.parse(window.localStorage.getItem(key) || '{}');
    } catch (error) {
      console.warn(`failed to read saved wallet metadata for ${firstAddress}`, error);
      continue;
    }
    if (!isRecord(walletInfo)) {
      continue;
    }

    Object.entries(walletInfo).forEach(([filename, value]) => {
      if (!filename || !isRecord(value) || typeof value.viewOnly !== 'boolean') {
        return;
      }

      wallets.push({
        firstAddress,
        filename,
        viewOnly: value.viewOnly,
        lastOpen: typeof value.lastOpen === 'number' && Number.isFinite(value.lastOpen) ? value.lastOpen : 0,
      });
    });
  }

  return wallets.sort((left, right) => right.lastOpen - left.lastOpen);
}
