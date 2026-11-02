# Changelog

## Unreleased

- Ensure remote HTTPS node addresses include an explicit port when passed to the wallet engine, preventing hosted-relay startup failures.
- Add a wallet help guide covering setup, sending, receiving, backups, network settings, and troubleshooting.
- Add a transaction-details dialog with transaction and block metadata.
- Restore the preserved v3.4.3 browser engine bundle to restore RPC sync compatibility with configured v3.5.1 daemons while retaining encrypted browser wallet support.
- Add `node.bytecoin.network` as the alternate default node, automatically fail over on connection errors, and use a local IP:port proxy address compatible with the WASM wallet engine.
- Proxy legacy `/sync_blocks/*` and `/binary_rpc` requests during local development, with CORS support for loopback previews.
- Limit automatic node failover to one switch per wallet session to prevent repeated node-switch loops.
- Replace the node-pool textarea with an editable node list and per-node automatic-pool switches.
- Report node-pool reachability per node and omit unreachable or CORS-blocked nodes when saving settings.
- Refresh the wallet interface with responsive navigation, system-aware light and dark themes, and synchronization progress.
- Add QR-based receiving, recovery-phrase copy/download controls, configurable public-node selection with optional timed rotation, and distinct synchronization errors for unreachable and incompatible nodes.
- Add numbered receive addresses with copy controls, browser-local labels, and reversible hide/restore actions; hiding does not remove addresses from the wallet.
- Add a Saved wallets page in the wallet menu for reopening wallets stored in the browser.
- Add password-based AES-GCM encryption for browser wallet storage, legacy-wallet migration, and encrypted `mywallet.wallet` backup import/export.
- Add a three-step new-wallet flow for recovery phrase, password, and encrypted wallet backup.
- Identify Bytecoin Zero as a community-maintained wallet and display its package version.
