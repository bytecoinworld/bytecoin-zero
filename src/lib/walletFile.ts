export interface IWalletBackup {
  readonly filename: string;
  readonly data: Uint8Array;
}

interface IWalletCryptoApi {
  isEncrypted(data: Uint8Array): boolean;
  getFilename(data: Uint8Array): string;
  createContext(cryptoApi: Crypto, password: string): IWalletCryptoContext;
}

interface IWalletCryptoContext {
  encrypt(data: Uint8Array, filename: string): Promise<Uint8Array>;
  decrypt(data: Uint8Array, expectedFilename?: string): Promise<Uint8Array>;
  clear(): void;
}

declare global {
  interface Window {
    BytecoinWalletCrypto?: IWalletCryptoApi;
  }
}

const DATABASE_NAME = 'Files';
const STORE_NAME = 'Files';
const RECOVERY_DATABASE_NAME = 'WalletSecrets';
const RECOVERY_STORE_NAME = 'RecoveryPhrases';

function walletCrypto(): IWalletCryptoApi {
  if (!window.BytecoinWalletCrypto) {
    throw new Error('Wallet encryption support could not be loaded.');
  }
  return window.BytecoinWalletCrypto;
}

function openWalletFilesDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('Browser wallet storage is unavailable.'));
      return;
    }

    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open browser wallet storage.'));
    request.onblocked = () => reject(new Error('Browser wallet storage is busy. Close other wallet tabs and try again.'));
  });
}

function openRecoveryDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('Browser wallet storage is unavailable.'));
      return;
    }

    const request = window.indexedDB.open(RECOVERY_DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RECOVERY_STORE_NAME)) {
        database.createObjectStore(RECOVERY_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open encrypted recovery-phrase storage.'));
    request.onblocked = () => reject(new Error('Encrypted recovery-phrase storage is busy. Close other wallet tabs and try again.'));
  });
}

function recoveryPhraseIdentifier(filename: string): string {
  const identifier = `${filename}.recovery`;
  if (!filename || identifier.length > 255) {
    throw new Error('The saved wallet identifier is invalid for recovery-phrase storage.');
  }
  return identifier;
}

export async function encryptRecoveryPhrase(filename: string, mnemonic: string, password: string): Promise<Uint8Array> {
  if (!mnemonic || !password) {
    throw new Error('A recovery phrase and wallet password are required.');
  }
  const context = walletCrypto().createContext(window.crypto, password);
  try {
    return await context.encrypt(
      new TextEncoder().encode(mnemonic),
      recoveryPhraseIdentifier(filename),
    );
  } finally {
    context.clear();
  }
}

export async function decryptRecoveryPhrase(filename: string, data: Uint8Array, password: string): Promise<string> {
  if (!password) {
    throw new Error('Enter the wallet password to unlock the recovery phrase.');
  }

  const identifier = recoveryPhraseIdentifier(filename);
  const crypto = walletCrypto();
  if (!crypto.isEncrypted(data) || crypto.getFilename(data) !== identifier) {
    throw new Error('The saved recovery phrase is invalid or does not match this wallet.');
  }

  const context = crypto.createContext(window.crypto, password);
  try {
    const plaintext = await context.decrypt(data, identifier);
    try {
      return new TextDecoder('utf-8', {fatal: true}).decode(plaintext);
    } finally {
      plaintext.fill(0);
    }
  } finally {
    context.clear();
  }
}

export async function saveWalletRecoveryPhrase(filename: string, mnemonic: string, password: string): Promise<void> {
  const encrypted = await encryptRecoveryPhrase(filename, mnemonic, password);
  const database = await openRecoveryDatabase();
  await new Promise<void>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction([RECOVERY_STORE_NAME], 'readwrite');
    } catch (error) {
      database.close();
      reject(error);
      return;
    }

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Could not save the encrypted recovery phrase.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Saving the encrypted recovery phrase was aborted.'));
    };
    transaction.objectStore(RECOVERY_STORE_NAME).put(new Uint8Array(encrypted), filename);
  });
}

export async function readWalletRecoveryPhrase(filename: string, password: string): Promise<string | null> {
  const database = await openRecoveryDatabase();
  const data = await new Promise<Uint8Array | null>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction([RECOVERY_STORE_NAME], 'readonly');
    } catch (error) {
      database.close();
      reject(error);
      return;
    }

    const request = transaction.objectStore(RECOVERY_STORE_NAME).get(filename);
    request.onsuccess = () => {
      database.close();
      resolve(request.result === undefined ? null : new Uint8Array(request.result));
    };
    request.onerror = () => {
      database.close();
      reject(request.error || new Error('Could not read the encrypted recovery phrase.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Reading the encrypted recovery phrase was aborted.'));
    };
  });

  return data ? decryptRecoveryPhrase(filename, data, password) : null;
}

export async function readWalletFile(filename: string): Promise<Uint8Array> {
  const database = await openWalletFilesDatabase();
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction([STORE_NAME], 'readonly');
    } catch (error) {
      database.close();
      reject(error);
      return;
    }

    const request = transaction.objectStore(STORE_NAME).get(filename);
    request.onsuccess = () => {
      database.close();
      if (request.result === undefined) {
        reject(new Error('The saved wallet file is not available in browser storage.'));
        return;
      }
      resolve(new Uint8Array(request.result));
    };
    request.onerror = () => {
      database.close();
      reject(request.error || new Error('Could not read the saved wallet file.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Reading the saved wallet file was aborted.'));
    };
  });
}

export async function writeWalletFile(filename: string, data: Uint8Array): Promise<void> {
  const crypto = walletCrypto();
  if (!crypto.isEncrypted(data) || crypto.getFilename(data) !== filename) {
    throw new Error('The selected file is not a valid encrypted Bytecoin Zero wallet backup.');
  }

  const database = await openWalletFilesDatabase();
  await new Promise<void>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction([STORE_NAME], 'readwrite');
    } catch (error) {
      database.close();
      reject(error);
      return;
    }

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Could not save the encrypted wallet backup.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Saving the encrypted wallet backup was aborted.'));
    };
    transaction.objectStore(STORE_NAME).put(new Uint8Array(data), filename);
  });
}

export async function readWalletBackup(filename: string): Promise<Uint8Array> {
  const data = await readWalletFile(filename);
  const crypto = walletCrypto();
  if (!crypto.isEncrypted(data) || crypto.getFilename(data) !== filename) {
    throw new Error('This wallet is not encrypted in the Bytecoin Zero backup format.');
  }
  return data;
}

export async function verifyWalletBackupPassword(data: Uint8Array, filename: string, password: string): Promise<void> {
  if (!password) {
    throw new Error('Enter the wallet password.');
  }

  const crypto = walletCrypto();
  if (!crypto.isEncrypted(data)) {
    throw new Error('This wallet is not password-protected. Reopen it from Saved wallets and set a password first.');
  }
  if (crypto.getFilename(data) !== filename) {
    throw new Error('The encrypted wallet identifier does not match the saved wallet.');
  }

  const context = crypto.createContext(window.crypto, password);
  try {
    const decrypted = await context.decrypt(data, filename);
    decrypted.fill(0);
  } finally {
    context.clear();
  }
}

export async function verifyWalletPassword(filename: string, password: string): Promise<void> {
  if (!filename) {
    throw new Error('The saved wallet identifier is unavailable.');
  }
  const data = await readWalletFile(filename);
  await verifyWalletBackupPassword(data, filename, password);
}

export function getWalletPasswordErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('password is incorrect or the encrypted wallet file is damaged') ?
    'Incorrect password, or the encrypted wallet file is damaged. Check the password and try again.' :
    message;
}

export async function isWalletFileEncrypted(filename: string): Promise<boolean> {
  const data = await readWalletFile(filename);
  return walletCrypto().isEncrypted(data);
}

export function getWalletBackup(data: Uint8Array): IWalletBackup {
  const crypto = walletCrypto();
  if (!crypto.isEncrypted(data)) {
    throw new Error('Choose an encrypted Bytecoin Zero wallet backup file.');
  }
  return {filename: crypto.getFilename(data), data};
}

export function readFileAsBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error('The selected wallet file could not be read.'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('The selected wallet file could not be read.'));
    reader.readAsArrayBuffer(file);
  });
}

export async function walletFileExists(filename: string): Promise<boolean> {
  try {
    await readWalletFile(filename);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message === 'The saved wallet file is not available in browser storage.') {
      return false;
    }
    throw error;
  }
}
