import {parseContacts, validateContactDraft} from './contacts';
import {IContact} from './contacts';

jest.mock('@bcndev/bytecoin', () => ({
  checkAddressFormat: (address: string) => address.startsWith('bcn-test-'),
}));

describe('contact storage', () => {
  const address = 'bcn-test-alice';

  it('parses and normalizes saved contacts', () => {
    expect(parseContacts(JSON.stringify([{name: ' Alice ', address: ` ${address} `}]))).toEqual([
      {name: 'Alice', address},
    ]);
  });

  it('returns an empty list when there are no saved contacts', () => {
    expect(parseContacts(null)).toEqual([]);
  });

  it('rejects malformed or invalid saved contacts', () => {
    expect(() => parseContacts('{')).toThrow();
    expect(() => parseContacts(JSON.stringify([{name: 'Alice', address: 'invalid'}]))).toThrow();
  });

  it('validates names, addresses, and duplicate recipients', () => {
    const contacts: IContact[] = [{name: 'Alice', address}];

    expect(validateContactDraft('', address, contacts, '')).toBe('Enter a contact name.');
    expect(validateContactDraft('Bob', 'invalid', contacts, '')).toBe('Enter a valid Bytecoin address.');
    expect(validateContactDraft('Bob', address, contacts, '')).toBe('A contact with this address already exists.');
    expect(validateContactDraft('Alice renamed', address, contacts, address)).toBe('');
  });
});
