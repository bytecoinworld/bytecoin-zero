import {blockUrl, searchUrl, transactionUrl} from './explorer';

describe('Bytecoin Explorer URLs', () => {
  it('creates transaction and block links using the explorer query format', () => {
    const hash = 'a'.repeat(64);

    expect(transactionUrl(hash)).toBe(`https://explorer.bytecoin.world/tx?hash=${hash}`);
    expect(blockUrl(hash)).toBe(`https://explorer.bytecoin.world/block?hash=${hash}`);
  });

  it('encodes search queries for the explorer search form', () => {
    expect(searchUrl('proof+with&symbols')).toBe(
      'https://explorer.bytecoin.world/search?q=proof%2Bwith%26symbols',
    );
  });
});
