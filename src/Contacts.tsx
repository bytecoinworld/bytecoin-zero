// Copyright 2019 The Bytecoin developers.
// Licensed under the GNU Affero General Public License, version 3.

import React, {useContext, useEffect, useMemo, useState} from 'react';
import Icon from './Icon';
import * as util from './lib/util';
import {CONTACTS_STORAGE_PREFIX, IContact, parseContacts, validateContactDraft} from './lib/contacts';
import Avatar from './Avatar';
import useAvatarColors from './lib/useAvatarColors';
import styles from './css/Contacts.module.css';

interface ContactsProps {
  canSend: boolean;
  onSend: (address: string) => void;
}

const Contacts = React.memo((props: ContactsProps) => {
  const wallet = useContext(util.WalletContext);
  const filename = wallet ? wallet.getFilename() : '';
  const storageKey = filename ? `${CONTACTS_STORAGE_PREFIX}${filename}` : '';
  const [contacts, setContacts] = useState<IContact[]>([]);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [editingAddress, setEditingAddress] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [status, setStatus] = useState('');
  const {avatarColors, updateAvatarColor, getAvatarColorStyle} = useAvatarColors();

  useEffect(() => {
    if (!storageKey) {
      setContacts([]);
      setStatus('Wait until the wallet finishes opening before managing contacts.');
      return;
    }

    try {
      setContacts(parseContacts(window.localStorage.getItem(storageKey)));
      setStatus('');
    } catch (error) {
      console.warn('failed to load wallet contacts', error);
      setContacts([]);
      setStatus('Could not load saved contacts. The stored contact data may be invalid.');
    }
  }, [storageKey]);

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return contacts;
    }
    return contacts.filter((contact) =>
      contact.name.toLowerCase().indexOf(query) !== -1 ||
      contact.address.toLowerCase().indexOf(query) !== -1,
    );
  }, [contacts, search]);

  const resetForm = () => {
    setName('');
    setAddress('');
    setEditingAddress('');
    setFormError('');
    setFormOpen(false);
  };

  const beginAdd = () => {
    setName('');
    setAddress('');
    setEditingAddress('');
    setFormError('');
    setFormOpen(true);
  };

  const saveContacts = (nextContacts: IContact[]): boolean => {
    if (!storageKey) {
      setStatus('Wait until the wallet finishes opening before managing contacts.');
      return false;
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextContacts));
      setContacts(nextContacts);
      setStatus('Contacts are saved in this browser for this wallet.');
      return true;
    } catch (error) {
      console.warn('failed to save wallet contacts', error);
      setStatus("Could not save contacts. Check this browser's local storage settings.");
      return false;
    }
  };

  const submitContact = () => {
    const validationError = validateContactDraft(name, address, contacts, editingAddress);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const contact = {name: name.trim(), address: address.trim()};
    const nextContacts = editingAddress ?
      contacts.map((item) => item.address === editingAddress ? contact : item) :
      contacts.concat(contact);
    if (saveContacts(nextContacts)) {
      resetForm();
    }
  };

  const editContact = (contact: IContact) => {
    setName(contact.name);
    setAddress(contact.address);
    setEditingAddress(contact.address);
    setFormError('');
    setFormOpen(true);
  };

  const deleteContact = (contact: IContact) => {
    if (!window.confirm(`Delete ${contact.name} from your contacts?`)) {
      return;
    }
    saveContacts(contacts.filter((item) => item.address !== contact.address));
  };

  const copyAddress = async (contact: IContact) => {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      setStatus('Clipboard access is unavailable in this browser.');
      return;
    }
    try {
      await navigator.clipboard.writeText(contact.address);
      setStatus(`${contact.name}'s address copied to the clipboard.`);
    } catch (error) {
      console.warn('failed to copy contact address', error);
      setStatus('Could not access the clipboard. Select and copy the address manually.');
    }
  };

  return (
    <section className={styles.contacts}>
      <div className={styles.toolbar}>
        <div>
          <h2>Address book</h2>
          <p>Save Bytecoin addresses for quick sending. Contacts stay in this browser for this wallet.</p>
        </div>
        <button type='button' className={styles.addButton} onClick={beginAdd} disabled={!storageKey}>
          <Icon name='plus' size={16}/>Add contact
        </button>
      </div>

      {formOpen && <div className={styles.formCard}>
        <h3>{editingAddress ? 'Edit contact' : 'New contact'}</h3>
        <label>
          Contact name
          <input
            type='text'
            maxLength={60}
            autoComplete='off'
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setFormError('');
            }}
            placeholder='Name'
          />
        </label>
        <label>
          Bytecoin address
          <input
            type='text'
            autoComplete='off'
            spellCheck={false}
            value={address}
            onChange={(event) => {
              setAddress(event.target.value);
              setFormError('');
            }}
            placeholder='bcnZ… or 2…'
          />
        </label>
        {formError && <p className={styles.error} role='alert'>{formError}</p>}
        <div className={styles.formActions}>
          <button type='button' className={styles.saveButton} onClick={submitContact}>
            <Icon name='check' size={16}/>{editingAddress ? 'Save changes' : 'Save contact'}
          </button>
          <button type='button' className={styles.cancelButton} onClick={resetForm}>
            <Icon name='close' size={16}/>Cancel
          </button>
        </div>
      </div>}

      <div className={styles.searchRow}>
        <label className={styles.searchBox}>
          <Icon name='search' size={17}/>
          <input
            type='search'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Search contacts'
            aria-label='Search contacts'
          />
        </label>
        <span className={styles.count}>{contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}</span>
      </div>

      {status && <p className={styles.status} role='status' aria-live='polite'>{status}</p>}

      {filteredContacts.length > 0 ?
        <div className={styles.contactList}>
          {filteredContacts.map((contact) => {
            const index = contacts.findIndex((item) => item.address === contact.address);
            return <article
              className={avatarColors[contact.address] ?
                `${styles.contact} ${styles.contactAvatarColored}` :
                styles.contact}
              key={contact.address}
              style={getAvatarColorStyle(contact.address, index, contacts.length)}
            >
            <div className={styles.avatar}>
              <Avatar message={contact.address} onColorChange={updateAvatarColor}/>
            </div>
            <div className={styles.contactDetails}>
              <h3>{contact.name}</h3>
              <code>{contact.address}</code>
            </div>
            <div className={styles.contactActions}>
              {props.canSend && <button type='button' onClick={() => props.onSend(contact.address)} title={`Send to ${contact.name}`} aria-label={`Send to ${contact.name}`}>
                <Icon name='send' size={16}/>Send
              </button>}
              <button type='button' onClick={() => copyAddress(contact)} title='Copy address' aria-label={`Copy ${contact.name} address`}>
                <Icon name='copy' size={16}/>Copy
              </button>
              <button type='button' onClick={() => editContact(contact)} title='Edit contact' aria-label={`Edit ${contact.name}`}>
                <Icon name='edit' size={16}/>Edit
              </button>
              <button type='button' className={styles.deleteButton} onClick={() => deleteContact(contact)} title='Delete contact' aria-label={`Delete ${contact.name}`}>
                <Icon name='trash' size={16}/>Delete
              </button>
            </div>
          </article>;
          })}
        </div> :
        <div className={styles.emptyState}>
          <Icon name='community' size={28}/>
          <h3>{search ? 'No matching contacts' : 'Your address book is empty'}</h3>
          <p>{search ? 'Try another name or address.' : 'Add a contact to keep a recipient address close at hand.'}</p>
          {!search && <button type='button' className={styles.saveButton} onClick={beginAdd} disabled={!storageKey}>
            <Icon name='plus' size={16}/>Add your first contact
          </button>}
        </div>}
    </section>
  );
});

export default Contacts;
