// Copyright 2019 The Bytecoin developers.
// Licensed under the GNU Affero General Public License, version 3.

import React, {useContext, useEffect, useRef, useState} from 'react';
import QRCode from 'qrcode.react';
import Icon from './Icon';
import styles from './css/ReceiveForm.module.css';
import * as util from './lib/util';
import * as sync from './lib/sync';
import Avatar from './Avatar';
import useAvatarColors from './lib/useAvatarColors';

interface IAddressPreferences {
  labels: Record<string, string>;
  hiddenAddresses: string[];
}

const emptyAddressPreferences: IAddressPreferences = {labels: {}, hiddenAddresses: []};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseAddressPreferences = (serialized: string | null): IAddressPreferences => {
  if (!serialized) {
    return emptyAddressPreferences;
  }
  const parsed: unknown = JSON.parse(serialized);
  if (!isRecord(parsed)) {
    throw new Error('Saved address preferences are not an object.');
  }

  const labels: Record<string, string> = {};
  if (isRecord(parsed.labels)) {
    Object.entries(parsed.labels).forEach(([address, label]) => {
      if (typeof label === 'string') {
        labels[address] = label;
      }
    });
  }
  const hiddenAddresses = Array.isArray(parsed.hiddenAddresses) ?
    parsed.hiddenAddresses.filter((address): address is string => typeof address === 'string') :
    [];

  return {labels, hiddenAddresses};
};

const ReceiveForm = React.memo((props: {
  viewOnly: boolean,
  addresses: sync.IAddress[],
  setAddresses: (addresses: sync.IAddress[]) => void,
  dismiss: () => void,
}) => {
  const wallet = useContext(util.WalletContext);

  const [creatingAddress, setCreatingAddress] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(props.addresses[0] ? props.addresses[0].address : '');
  const [copyStatus, setCopyStatus] = useState('');
  const [copiedAddress, setCopiedAddress] = useState('');
  const [qrActionStatus, setQrActionStatus] = useState('');
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [addressCreationStatus, setAddressCreationStatus] = useState('');
  const [addressCreationFailed, setAddressCreationFailed] = useState(false);
  const [addressPreferences, setAddressPreferences] = useState<IAddressPreferences>(emptyAddressPreferences);
  const [addressPreferencesStatus, setAddressPreferencesStatus] = useState('');
  const [editingAddress, setEditingAddress] = useState('');
  const [editingLabel, setEditingLabel] = useState('');
  const [showHiddenAddresses, setShowHiddenAddresses] = useState(false);
  const {avatarColors, updateAvatarColor, getAvatarColorStyle} = useAvatarColors();

  const shareNavigator = navigator as Navigator & {share?: (data: {text: string}) => Promise<void>};
  const canShare = typeof shareNavigator.share === 'function';
  const walletFilename = wallet ? wallet.getFilename() : '';
  const preferencesKey = walletFilename ? `bytecoin-zero-address-preferences:${walletFilename}` : '';
  const visibleAddresses = props.addresses.filter((address) =>
    !addressPreferences.hiddenAddresses.includes(address.address));
  const hiddenAddressEntries = props.addresses
    .map((address, index) => ({address, index}))
    .filter(({address}) => addressPreferences.hiddenAddresses.includes(address.address));
  const currentAddress = visibleAddresses.find((address) => address.address === selectedAddress) || visibleAddresses[0];
  useEffect(() => {
    const selectionIsVisible = props.addresses.some((address) =>
      address.address === selectedAddress && !addressPreferences.hiddenAddresses.includes(address.address));
    if (!selectionIsVisible) {
      const firstVisible = props.addresses.find((address) =>
        !addressPreferences.hiddenAddresses.includes(address.address));
      setSelectedAddress(firstVisible ? firstVisible.address : '');
    }
  }, [props.addresses, selectedAddress, addressPreferences.hiddenAddresses]);

  useEffect(() => {
    if (!preferencesKey) {
      setAddressPreferences(emptyAddressPreferences);
      return;
    }
    try {
      setAddressPreferences(parseAddressPreferences(window.localStorage.getItem(preferencesKey)));
      setAddressPreferencesStatus('');
    } catch (error) {
      console.warn('failed to load local wallet address preferences', error);
      setAddressPreferences(emptyAddressPreferences);
      setAddressPreferencesStatus('Could not load saved address labels and hidden addresses.');
    }
  }, [preferencesKey]);

  const saveAddressPreferences = (next: IAddressPreferences, message: string) => {
    setAddressPreferences(next);
    if (!preferencesKey) {
      setAddressPreferencesStatus('Wait until the wallet is ready to save address changes.');
      return;
    }
    try {
      window.localStorage.setItem(preferencesKey, JSON.stringify(next));
      setAddressPreferencesStatus(message);
    } catch (error) {
      console.warn('failed to save local wallet address preferences', error);
      setAddressPreferencesStatus('Changes could not be saved in this browser.');
    }
  };

  const share = async (addr: string) => {
    if (!shareNavigator.share) {
      return;
    }
    try {
      await shareNavigator.share({text: addr});
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.warn('failed to share wallet address', error);
        alert('Could not share the wallet address.');
      }
    }
  };

  const copy = async (addr: string) => {
    if (!navigator.clipboard) {
      setCopyStatus('Clipboard access is unavailable in this browser.');
      return;
    }
    try {
      await navigator.clipboard.writeText(addr);
      setCopyStatus('Address copied to clipboard.');
      setCopiedAddress(addr);
    } catch (error) {
      console.warn('failed to copy wallet address', error);
      setCopyStatus('Could not access the clipboard.');
      setCopiedAddress('');
    }
  };

  const getQrBlob = (): Promise<Blob> => new Promise((resolve, reject) => {
    const canvas = qrCodeRef.current && qrCodeRef.current.querySelector('canvas');
    if (!canvas) {
      reject(new Error('The address QR code is not ready.'));
      return;
    }

    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Could not create an image from the address QR code.'));
      }
    }, 'image/png');
  });

  const downloadQr = async () => {
    setQrActionStatus('');
    try {
      const blob = await getQrBlob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'bytecoin-address-qr.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
      setQrActionStatus('QR code downloaded.');
    } catch (error) {
      console.warn('failed to download wallet address QR code', error);
      setQrActionStatus('Could not download the QR code.');
    }
  };

  const copyQr = async () => {
    setQrActionStatus('');
    const clipboard = navigator.clipboard as Clipboard & {write?: (items: object[]) => Promise<void>};
    const clipboardItemConstructor = (window as Window & {
      ClipboardItem?: new (items: {[mimeType: string]: Blob}) => object;
    }).ClipboardItem;
    if (!clipboard.write || !clipboardItemConstructor) {
      setQrActionStatus('Copying QR images is not supported in this browser. Download the QR code instead.');
      return;
    }

    try {
      const blob = await getQrBlob();
      await clipboard.write([new clipboardItemConstructor({'image/png': blob})]);
      setQrActionStatus('QR code copied to clipboard.');
    } catch (error) {
      console.warn('failed to copy wallet address QR code', error);
      setQrActionStatus('Could not copy the QR code. Download it instead.');
    }
  };

  const startEditingLabel = (address: string, label: string) => {
    setEditingAddress(address);
    setEditingLabel(label);
  };

  const saveLabel = (address: string) => {
    const label = editingLabel.trim();
    const labels = {...addressPreferences.labels};
    if (label) {
      labels[address] = label;
    } else {
      delete labels[address];
    }
    saveAddressPreferences(
      {...addressPreferences, labels},
      label ? 'Address label saved in this browser.' : 'Address label cleared.',
    );
    setEditingAddress('');
    setEditingLabel('');
  };

  const hideAddress = (address: string, index: number) => {
    if (!window.confirm(`Hide Address ${index + 1} from this browser's list? It will remain in the wallet.`)) {
      return;
    }
    const hiddenAddresses = Array.from(new Set([...addressPreferences.hiddenAddresses, address]));
    saveAddressPreferences({...addressPreferences, hiddenAddresses}, `Address ${index + 1} hidden from this list.`);
    if (selectedAddress === address) {
      const nextAddress = visibleAddresses.find((item) => item.address !== address);
      setSelectedAddress(nextAddress ? nextAddress.address : '');
    }
    if (editingAddress === address) {
      setEditingAddress('');
      setEditingLabel('');
    }
  };

  const restoreAddress = (address: string, index: number) => {
    const hiddenAddresses = addressPreferences.hiddenAddresses.filter((item) => item !== address);
    saveAddressPreferences({...addressPreferences, hiddenAddresses}, `Address ${index + 1} restored.`);
  };

  const addAddress = async () => {
    if (creatingAddress) {
      return;
    }

    setCreatingAddress(true);
    setAddressCreationStatus('');
    setAddressCreationFailed(false);
    try {
      if (wallet === null) {
        throw new Error('The wallet is still opening. Please wait and try again.');
      }

      const walletInfo = await wallet.getWalletInfo({need_secrets: false});
      const response = await wallet.createAddresses({secret_spend_keys: ['']});
      if (response.addresses.length !== 1) {
        throw new Error('The wallet did not return exactly one new address.');
      }
      const address = response.addresses[0];
      if (typeof address !== 'string' || address.length === 0) {
        throw new Error('The wallet did not return a new address.');
      }

      props.setAddresses([...props.addresses, {address, label: ''}]);
      setSelectedAddress(address);
      if (walletInfo.wallet_type === 'amethyst') {
        try {
          sync.rememberWalletAddressCount(
            wallet.getFilename(),
            Math.max(
              walletInfo.total_address_count + response.addresses.length,
              props.addresses.length + response.addresses.length,
            ),
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn('failed to save wallet address count in this browser', error);
          setAddressCreationFailed(true);
          setAddressCreationStatus(`Address created, but its position could not be saved in this browser: ${message}`);
          return;
        }
        setAddressCreationStatus('New address added. It will be restored when you reopen this wallet in this browser.');
      } else {
        setAddressCreationStatus('New address added and saved to this wallet.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('failed to create wallet address', error);
      setAddressCreationFailed(true);
      setAddressCreationStatus(`Could not add address: ${message}`);
    } finally {
      setCreatingAddress(false);
    }
  };

  return (
    <div className={styles.receiveForm}>
      <section className={styles.receivePrimary}>
        <div className={styles.receiveHeading}>
          <div>
            <h2>Receive Bytecoin</h2>
            <p>Share this address or scan its QR code to receive BCN.</p>
          </div>
          {visibleAddresses.length > 1 && <label className={styles.addressSelect}>
            <span>Address</span>
            <select value={currentAddress ? currentAddress.address : ''} onChange={(e) => setSelectedAddress(e.target.value)}>
              {visibleAddresses.map((address) => {
                const index = props.addresses.findIndex((item) => item.address === address.address);
                const label = addressPreferences.labels[address.address] || address.label || `Address ${index + 1}`;
                return <option key={address.address} value={address.address}>{index + 1}. {label}</option>;
              })}
            </select>
          </label>}
        </div>
        {currentAddress &&
          <div className={styles.qrPanel}>
            <div ref={qrCodeRef} className={styles.qrCode} role='img' aria-label='QR code for selected Bytecoin address'>
              <QRCode value={currentAddress.address} size={280} renderAs='canvas' includeMargin={true}/>
            </div>
            <div className={styles.qrActions}>
              <button type='button' onClick={() => void downloadQr()}>
                <Icon name='download' size={16}/>Download QR
              </button>
              <button type='button' onClick={() => void copyQr()}>
                <Icon name='copy' size={16}/>Copy QR
              </button>
            </div>
            {qrActionStatus && <p className={styles.copyStatus} role='status' aria-live='polite'>{qrActionStatus}</p>}
            <code className={styles.primaryAddress}>{currentAddress.address}</code>
            <div className={styles.addressActions}>
              <button type='button' onClick={() => copy(currentAddress.address)}>
                <Icon name={copiedAddress === currentAddress.address ? 'check' : 'copy'} size={16}/>
                {copiedAddress === currentAddress.address ? 'Copied' : 'Copy address'}
              </button>
              {canShare && <button type='button' onClick={() => share(currentAddress.address)}><Icon name='share' size={16}/>Share</button>}
            </div>
            {copyStatus && <p className={styles.copyStatus} role='status' aria-live='polite'>{copyStatus}</p>}
          </div>
        }
      </section>

      <div className={styles.addressesHeadingRow}>
        <h3 className={styles.addressesHeading}>Wallet addresses ({visibleAddresses.length})</h3>
        <p className={styles.preferencesNote}>Labels, hidden-address choices, and added HD-address counts are saved in this browser. Recreate this wallet on another device and add the same number of addresses to restore them. Hiding does not delete an address from the wallet.</p>
      </div>
      {visibleAddresses.length === 0 && <p className={styles.emptyAddresses}>No visible addresses. Restore a hidden address or add a new one.</p>}
      <div className={styles.addresses}>{
        visibleAddresses.map((addr) => {
          const index = props.addresses.findIndex((address) => address.address === addr.address);
          const savedLabel = addressPreferences.labels[addr.address];
          const label = savedLabel || addr.label;
          const isEditing = editingAddress === addr.address;

          return <div
            key={addr.address}
            className={avatarColors[addr.address] ? `${styles.address} ${styles.addressAvatarColored}` : styles.address}
            style={getAvatarColorStyle(addr.address, index, props.addresses.length)}
          >
            <div className={styles.addressIcon} title={addr.address}>
              <Avatar message={addr.address} onColorChange={updateAvatarColor}/>
            </div>
            <div className={styles.addressData}>
              <div className={styles.addressText}>
                <div className={styles.addressLabelRow}>
                  <span className={styles.addressNumber}>Address {index + 1}</span>
                  {isEditing ? <input
                      className={styles.addressLabelInput}
                      type='text'
                      maxLength={40}
                      aria-label={`Label for Address ${index + 1}`}
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                    /> : <span className={styles.addressLabel}>{label || 'Unlabeled'}</span>}
                </div>
                <code>{addr.address}</code>
              </div>
            </div>
            <div className={styles.addressItemActions}>
              {isEditing ? <>
                <button type='button' onClick={() => saveLabel(addr.address)}><Icon name='check' size={15}/>Save</button>
                <button type='button' onClick={() => { setEditingAddress(''); setEditingLabel(''); }}>
                  <Icon name='close' size={15}/>Cancel
                </button>
              </> : <>
                <button type='button' aria-label={`Copy Address ${index + 1}`} onClick={() => copy(addr.address)}>
                  <Icon name={copiedAddress === addr.address ? 'check' : 'copy'} size={15}/>
                  {copiedAddress === addr.address ? 'Copied' : 'Copy'}
                </button>
                <button
                  type='button'
                  onClick={() => startEditingLabel(addr.address, savedLabel || addr.label || '')}
                  disabled={!preferencesKey}
                >
                  <Icon name={label ? 'edit' : 'plus'} size={15}/>{label ? 'Edit label' : 'Add label'}
                </button>
                <button
                  type='button'
                  className={styles.hideAddressButton}
                  onClick={() => hideAddress(addr.address, index)}
                  disabled={!preferencesKey}
                  title='Hide from this list only; the address remains in the wallet.'
                >
                  <Icon name='trash' size={15}/>Hide
                </button>
                {canShare && <button type='button' onClick={() => share(addr.address)}><Icon name='share' size={15}/>Share</button>}
              </>}
            </div>
          </div>
        })
      }</div>
      {hiddenAddressEntries.length > 0 && <section className={styles.hiddenAddresses}>
        <button
          type='button'
          className={styles.hiddenAddressesToggle}
          aria-expanded={showHiddenAddresses}
          onClick={() => setShowHiddenAddresses(!showHiddenAddresses)}
        >
          <Icon name={showHiddenAddresses ? 'eyeOff' : 'eye'} size={14}/>
          {showHiddenAddresses ? 'Hide hidden addresses' : `Show hidden addresses (${hiddenAddressEntries.length})`}
          <span className={styles.hiddenAddressesChevron}>
            <Icon name='chevronRight' size={14}/>
          </span>
        </button>
        {showHiddenAddresses && <div className={styles.addresses}>
          {hiddenAddressEntries.map(({address, index}) => {
            const label = addressPreferences.labels[address.address] || address.label;
            return <div
              key={address.address}
              className={avatarColors[address.address] ?
                `${styles.address} ${styles.hiddenAddress} ${styles.addressAvatarColored}` :
                `${styles.address} ${styles.hiddenAddress}`}
              style={getAvatarColorStyle(address.address, index, props.addresses.length)}
            >
              <div className={styles.addressIcon} title={address.address}>
                <Avatar message={address.address} onColorChange={updateAvatarColor}/>
              </div>
              <div className={styles.addressData}>
                <div className={styles.addressText}>
                  <div className={styles.addressLabelRow}>
                    <span className={styles.addressNumber}>Address {index + 1}</span>
                    <span className={styles.addressLabel}>{label || 'Unlabeled'}</span>
                  </div>
                  <code>{address.address}</code>
                </div>
              </div>
              <div className={styles.addressItemActions}>
                <button type='button' onClick={() => restoreAddress(address.address, index)}>
                  <Icon name='check' size={15}/>Restore
                </button>
              </div>
            </div>;
          })}
        </div>}
      </section>}
      {addressPreferencesStatus && <p className={styles.preferencesStatus} role='status' aria-live='polite'>{addressPreferencesStatus}</p>}

      <div className={styles.controls}>
        <button className={styles.addAddress} onClick={addAddress} disabled={props.viewOnly || creatingAddress || wallet === null}>
          <Icon name='plus' size={16}/>
          {creatingAddress ? 'Adding address…' : 'Add address'}
        </button>

        <button className={styles.dismiss} onClick={props.dismiss}>
          <Icon name='check' size={16}/>
          OK
        </button>
      </div>
      {addressCreationStatus && <p
        className={`${styles.preferencesStatus} ${addressCreationFailed ? styles.addressCreationError : ''}`}
        role={addressCreationFailed ? 'alert' : 'status'}
        aria-live={addressCreationFailed ? 'assertive' : 'polite'}
      >{addressCreationStatus}</p>}
    </div>
  );
});

export default ReceiveForm;
