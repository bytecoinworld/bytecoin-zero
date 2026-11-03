# Bytecoin Zero 0.2.1 Release Notes

**Release date:** November 3, 2026

Bytecoin Zero 0.2.1 brings a more complete mobile wallet experience, clearer wallet guidance, and improved node connectivity for the hosted site at [https://bcn.money](https://bcn.money).

## Highlights

- **Improved mobile wallet navigation:** a bottom navigation dock and expandable menu provide quick access to wallet sections, synchronization status, community links, and support.
- **Wallet help and transaction details:** the in-app guide covers setup, payments, backups, privacy, node settings, and troubleshooting. Transaction details show additional available blockchain metadata.
- **Better wallet organization:** manage saved wallets and contacts, create and label receive addresses, and use QR codes to share addresses.
- **More visible transaction options:** the send form includes an anonymity-level indicator that changes color as the selected level changes.
- **Light and dark themes:** choose an appearance or follow the device's system preference.

## Node connectivity

- Configure public nodes and use automatic failover or optional rotation.
- Connect directly to `https://node01.bytecoin.org:8091`, which allows browser CORS; route `https://node.bytecoin.network` through the same-origin relay because it does not return the CORS headers browsers require.
- The `bcn.money` Cloudflare Pages deployment includes a same-origin relay for the nodes in the curated allowlist. This avoids browser CORS restrictions for those nodes.
- Ensure the wallet engine receives an explicit HTTPS port for hosted-relay connections.
- Custom nodes must allow browser CORS or be added to the maintained relay allowlist. The relay does not forward to arbitrary URLs.
- A node passing the reachability check may still be incompatible with the wallet's synchronization protocol.

## Privacy and safety

- Added the [Privacy Policy](https://bcn.money/privacy-policy/) describing browser storage, node requests, hosting, and external services.
- Wallets and recovery data are stored in the browser in encrypted form. Keep a verified offline backup and never share your recovery phrase, password, or private keys.
- Blockchain transactions are generally irreversible. Review the recipient, amount, and fee before confirming a payment.

## Deployment note

To enable the hosted node relay, deploy the repository through Cloudflare Pages with the root `functions/` directory and the `build/` output. Dashboard drag-and-drop uploads static files only and do not deploy Pages Functions. See the [README deployment instructions](./README.md#hosted-node-relay-and-cors) for Git integration and Wrangler CLI setup.
