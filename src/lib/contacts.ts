import {checkAddressFormat} from '@bcndev/bytecoin';

export interface IContact {
  name: string;
  address: string;
}

export const CONTACTS_STORAGE_PREFIX = 'bytecoin-zero-contacts:';

export const parseContacts = (serialized: string | null): IContact[] => {
  if (!serialized) {
    return [];
  }

  const parsed: unknown = JSON.parse(serialized);
  if (!Array.isArray(parsed)) {
    throw new Error('Saved contacts are not a list.');
  }

  const contacts: IContact[] = [];
  const addresses = new Set<string>();
  (parsed as unknown[]).forEach((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Saved contact ${index + 1} is invalid.`);
    }

    const contact = value as {name?: unknown; address?: unknown};
    if (typeof contact.name !== 'string' || typeof contact.address !== 'string') {
      throw new Error(`Saved contact ${index + 1} is invalid.`);
    }

    const name = contact.name.trim();
    const address = contact.address.trim();
    if (!name || name.length > 60 || !checkAddressFormat(address) || addresses.has(address)) {
      throw new Error(`Saved contact ${index + 1} is invalid.`);
    }

    addresses.add(address);
    contacts.push({name, address});
  });

  return contacts;
};

export const validateContactDraft = (
  name: string,
  address: string,
  contacts: IContact[],
  editingAddress: string,
): string => {
  const normalizedName = name.trim();
  const normalizedAddress = address.trim();

  if (!normalizedName) {
    return 'Enter a contact name.';
  }
  if (normalizedName.length > 60) {
    return 'Contact names must be 60 characters or fewer.';
  }
  if (!checkAddressFormat(normalizedAddress)) {
    return 'Enter a valid Bytecoin address.';
  }
  if (contacts.some((contact) => contact.address === normalizedAddress && contact.address !== editingAddress)) {
    return 'A contact with this address already exists.';
  }

  return '';
};
