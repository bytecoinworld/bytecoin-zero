const EXPLORER_BASE_URL = 'https://explorer.bytecoin.world';

export function transactionUrl(hash: string): string {
  return `${EXPLORER_BASE_URL}/tx?hash=${encodeURIComponent(hash)}`;
}

export function blockUrl(hash: string): string {
  return `${EXPLORER_BASE_URL}/block?hash=${encodeURIComponent(hash)}`;
}

export function searchUrl(query: string): string {
  return `${EXPLORER_BASE_URL}/search?q=${encodeURIComponent(query)}`;
}
