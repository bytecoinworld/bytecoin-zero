# Bytecoin Zero

<p align="center">
  <strong>A community-maintained browser wallet for Bytecoin (BCN).</strong><br>
  Create or restore a wallet, manage BCN, and review activity in your browser.
</p>

<p align="center">
  🔐 Self-custody &nbsp;·&nbsp; 🌐 Browser-based &nbsp;·&nbsp; 💠 Bytecoin (BCN)
</p>

> **Important:** Bytecoin Zero is a community-maintained wallet, not a substitute for careful backup and payment verification. Anyone with your recovery phrase or spend secret can control your funds. Blockchain transactions generally cannot be reversed.

## 📚 Contents

- [✨ Features](#-features)
- [🌐 Online wallet](#-online-wallet)
- [🚀 Run locally](#-run-locally)
- [🌐 Nodes and synchronization](#-nodes-and-synchronization)
- [🔐 Wallet security and recovery](#-wallet-security-and-recovery)
- [🧭 Using the wallet](#-using-the-wallet)
- [🧪 Tests and production build](#-tests-and-production-build)
- [🗂️ Project layout](#-project-layout)
- [📦 Releases and deployment](#-releases-and-deployment)
- [🤝 Contributing and support](#-contributing-and-support)
- [📄 License](#-license)

## ✨ Features

| Area | What you can do |
| --- | --- |
| **Wallet access** | Create a wallet with a recovery phrase, restore from a supported phrase or wallet file, and open wallets saved in this browser. View-only wallets can be opened with their audit secret. |
| **Send BCN** | Review recipient, amount, fee, anonymity level, and optional Payment ID before confirming a transaction. |
| **Receive BCN** | Share a Bytecoin address or QR code, add addresses, and organize them with browser-local labels and hide/restore controls. |
| **Transaction history** | Review incoming and outgoing activity, confirmation progress, and transaction details when the node provides them. |
| **Backups** | Export and restore a password-encrypted Bytecoin Zero wallet file. View or download a recovery phrase when one is available. |
| **Contacts** | Save, search, edit, and reuse Bytecoin addresses in the current browser. |
| **Node settings** | Choose public nodes, test reachability, configure automatic failover and optional rotation, and view synchronization status. |
| **Wallet help** | Open the in-app guide for wallet setup, payments, backups, network settings, and troubleshooting. |
| **Responsive interface** | Use the wallet on supported desktop and mobile browsers, with light and dark appearance support. |

## 🌐 Online wallet

Visit Bytecoin Zero at **[https://bcn.money](https://bcn.money)** to use the browser-based wallet. Before entering wallet information, verify the address bar shows `https://bcn.money`. See the [Privacy Policy](https://bcn.money/privacy-policy/) for details about browser storage, blockchain nodes, and external services.

## 🚀 Run locally

### Requirements

- **Node.js 24.x** and npm (Node 24 matches the release workflow).
- A modern browser. For local testing, use a browser with IndexedDB and Web Crypto support.

### Install and start

Clone the repository and install the locked dependencies:

```sh
git clone https://github.com/bytecoinworld/bytecoin-zero.git
cd bytecoin-zero
npm ci
```

This project uses an older Create React App build toolchain. With Node.js 24, the local development server needs the legacy OpenSSL provider:

**Windows PowerShell**

```powershell
$env:NODE_OPTIONS = "--openssl-legacy-provider"
npm start
```

**macOS / Linux**

```sh
NODE_OPTIONS=--openssl-legacy-provider npm start
```

The development server normally opens at [http://localhost:3000](http://localhost:3000). It may prompt to use another port if that port is already in use.

## 🌐 Nodes and synchronization

Bytecoin Zero is a browser wallet: in normal use, the browser sends wallet requests directly to a configured public node. A node must be reachable from the browser, allow the required cross-origin requests (CORS), and support the wallet's synchronization protocol. Use only HTTPS nodes that you trust.

### Local development proxy

The development server includes a proxy for the alternate `node.bytecoin.network` node. It forwards:

- `POST /json_rpc`
- `POST /binary_rpc`
- `GET` and `HEAD /sync_blocks/*`

The proxy works around browser CORS restrictions during local development; it does not make an incompatible node compatible. Loopback previews (`localhost`, `127.0.0.1`, and `::1`) automatically route this alternate node through the same-origin proxy. A preview served from another hostname can opt in with `REACT_APP_USE_LOCAL_NODE_PROXY=true`, but only if its development server implements the same fixed-endpoint proxy.

> **Do not expose the development server or its proxy as a production service. Do not deploy a build with `REACT_APP_USE_LOCAL_NODE_PROXY=true`.** Production wallet requests should use appropriately configured HTTPS nodes.

The browser bundle includes a preserved v3.4.3 wallet-engine snapshot for synchronization with the configured v3.5.1 daemons. A node can respond to a status check and still be incompatible with the wallet's sync protocol. Older engines may try `/sync_blocks/*` and fall back to `/binary_rpc`; a 404 from the static sync endpoint can be normal when that fallback succeeds.

### Hosted node relay and CORS

The `bcn.money` Cloudflare Pages deployment includes a same-origin relay for the built-in nodes listed in [`src/lib/hostedNodeProxyNodes.json`](./src/lib/hostedNodeProxyNodes.json). It forwards only the wallet's JSON-RPC, binary-RPC, and sync-block paths to those fixed HTTPS upstreams; it is not an arbitrary URL proxy. Cloudflare Pages must deploy the repository's root `functions/` directory alongside the `build/` output. The copied [`public/_routes.json`](./public/_routes.json) limits Function invocation to the RPC paths; it does not deploy the Function by itself.

For Pages Git integration, use the repository root as the project root, `npm run build` as the build command, and `build` as the output directory. For CLI deployments, run `npx wrangler pages deploy build --project-name=YOUR_PAGES_PROJECT_NAME` from the repository root. Do not use dashboard drag-and-drop for this project: it deploys static files without Pages Functions. See Cloudflare's [Pages Functions deployment guide](https://developers.cloudflare.com/pages/functions/get-started/). After deployment, a POST to `https://bcn.money/_node-proxy/alternate/json_rpc` with a `get_status` JSON-RPC request should return HTTP 200; a 404 indicates the relay Function is not active on that route.

Custom nodes that are not in the curated allowlist are contacted directly by the browser and must allow CORS for `https://bcn.money`, including the `OPTIONS` preflight for JSON requests. To support another node through the relay, maintainers must verify it, add it to the shared allowlist, and redeploy. Do not turn the relay into an open proxy; configure Cloudflare rate limits for the RPC endpoints.

Node settings behavior:

- Added nodes appear in the node list; each node's auto-pool switch controls whether it participates in automatic failover and random rotation.
- The wallet tries one other enabled node per wallet session after a connection failure. Manually switching nodes allows another automatic attempt.
- Testing a node confirms reachability, not full protocol compatibility. The selected node must pass the check before settings can be saved.
- A development proxy can address CORS for local testing, but synchronization still requires a protocol-compatible node.

## 🔐 Wallet security and recovery

Please read these points before storing funds in a browser wallet:

- **Protect the recovery phrase.** A spend wallet's recovery phrase can control the wallet. Keep it private and offline. Never send it to support, post it in an issue, or enter it through a link someone sent you.
- **Use a strong wallet password.** New and password-migrated browser wallets are encrypted in IndexedDB using AES-GCM with a PBKDF2-derived key. The password is not saved by the app and must be remembered. Use a long, unique password; short passwords are easier to guess if an encrypted copy is obtained.
- **Back up independently.** Browser storage is not a cloud backup. Clearing site data, losing a device, or changing browser profiles can remove local wallets and preferences. Keep a verified offline recovery option.
- **Know what each backup contains.** The downloaded `mywallet.wallet` file is a Bytecoin Zero-specific encrypted container. It requires its password and is not compatible with desktop `walletd`.
- **Recovery phrase downloads are unencrypted.** A downloaded phrase file is plain text. Anyone who obtains it may control the wallet.
- **Some wallets have no recoverable phrase.** Older or imported wallets may not contain a mnemonic. Keep their encrypted wallet file and password; the app cannot recreate a phrase that is not present.
- **Legacy wallet migration is explicit.** Existing legacy wallets remain unencrypted until opened with a new password. Confirming a password while opening one migrates its browser-stored file to the encrypted format.
- **Passwords cannot be reset or changed in the app.** Keep the password and recovery material separately. Forgetting the password may make an encrypted wallet file unusable.
- **Verify every payment.** Check the full destination address, amount, fee, and Payment ID (if used) before confirming. Contact the recipient through a trusted channel if anything differs.
- **Understand node privacy.** The selected node receives synchronization requests and can observe network traffic associated with its service. A public node does not make your internet connection anonymous. Public explorers are separate services with their own availability and privacy practices.
- **Secure your environment.** Keep your browser and operating system updated, verify the site address, and avoid entering secrets on shared or compromised devices.

Bytecoin Zero is community-maintained software. This README does not claim that the wallet or its dependencies have undergone an independent security audit. Review the code and assess your own risk before using it with funds.

## 🧭 Using the wallet

The wallet also includes an in-app **Help** guide. These quick notes cover the most important flows.

### Create or restore

- **Create:** choose **Create New Wallet**, write down the generated 24-word phrase in order, verify your backup, and set a strong password.
- **Restore from phrase:** enter the words in their original order. Supported phrase lengths are 12, 15, 18, 21, or 24 words.
- **Restore from audit secret:** this opens a view-only wallet. A view-only wallet cannot spend BCN and has no spend seed to back up.
- **Restore from file:** choose a Bytecoin Zero `mywallet.wallet` backup and enter the password used to encrypt it.
- A restored wallet may need time to scan and synchronize before its complete balance and history appear.

### Receive BCN

Open **Receive**, select an address, and share it or its QR code with the sender. Check the address before sharing. Additional addresses can be added and organized with labels. Hiding an address only removes it from the visible list; it does not delete it from the wallet.

Address labels, hidden-address choices, and added-address counts are stored in the browser. When restoring on another browser or device, add the same number of wallet addresses to recreate the full list.

### Send BCN

Open **Send**, enter the recipient address and amount, choose a fee rate and anonymity level, and optionally enter a Payment ID if the recipient requests one. The supported anonymity level is **3–50**. Payment IDs must be **16 or 64 hexadecimal characters**.

Choose **Review & Send** and carefully inspect the final review before confirming. When **Subtract fee from amount** is enabled, the network fee is taken from the entered amount; otherwise, the fee is added to the amount deducted from your balance. A higher fee rate may affect prioritization but does not guarantee a confirmation time.

### History, contacts, and settings

- **Transactions:** inspect history and available transaction details. Some details depend on data returned by the selected node. The interface uses a ten-confirmation threshold for its confirmation indicator.
- **Contacts:** save names and addresses for reuse. Contacts are stored in the current browser; always verify the address before sending.
- **Saved wallets:** reopen wallets available in this browser profile. This is not a backup or a transfer between devices.
- **Settings:** manage nodes, test node reachability, enable or disable auto-pool participation, and configure optional rotation.
- **Sync status:** allow the wallet to finish synchronizing before relying on its balance or history. A node can be reachable but incompatible with the required sync protocol.

## 🧪 Tests and production build

Run the test suite once:

```sh
npm test -- --watchAll=false
```

Create an optimized static production build:

```sh
npm run build
```

The build script passes Node.js's OpenSSL compatibility flag to the legacy Webpack toolchain, so CI providers such as Cloudflare Pages can use the standard `npm run build` command without a separate `NODE_OPTIONS` setting. The generated site is written to `build/`. Serve that directory from a static web host configured for HTTPS. The compatibility flag applies only to the build process, not to the browser runtime.

## 🗂️ Project layout

| Path | Purpose |
| --- | --- |
| `public/` | HTML entry point, web app manifest, icons, and static assets. |
| `src/` | React and TypeScript wallet interface. |
| `src/lib/` | Wallet, synchronization, settings, contacts, storage helpers, and the hosted node allowlist. |
| `src/css/` | Component styles. |
| `src/**/*.test.*` | Tests colocated with the components and libraries they cover. |
| `functions/` | Cloudflare Pages Function middleware for the curated production node relay. |
| `build/` | Generated production site; created by `npm run build`. |
| `.github/workflows/release.yml` | Tag-triggered GitHub Release build and archive workflow. |
| `CHANGELOG.md` | Release and feature history. |

## 📦 Releases and deployment

The application version shown in the wallet comes from `package.json`. To prepare a release, update the version with the appropriate npm command, update [CHANGELOG.md](./CHANGELOG.md), and push the matching `v<version>` tag.

See [ReleaseNotes.md](./ReleaseNotes.md) for the Bytecoin Zero 0.2.1 release highlights.

For example:

```sh
npm version patch
```

The GitHub Actions release workflow runs on `v*` tags and verifies that the tag matches `package.json`. It installs the locked dependencies, builds the static site, and attaches a ZIP archive to the GitHub Release. It does **not** automatically publish the app to GitHub Pages or another hosting provider. A static host can serve `build/`, but the production node relay requires Cloudflare Pages to deploy the repository's root `functions/` directory as well; uploading only the build output does not deploy the relay. Without the relay, configured nodes must provide browser CORS themselves.

## 🤝 Contributing and support

Bug reports and feature requests can be submitted through the [GitHub issue tracker](https://github.com/bytecoinworld/bytecoin-zero/issues). When reporting a problem:

1. Include the app version, browser/OS, steps to reproduce, and the exact non-sensitive error message.
2. Never attach a recovery phrase, wallet password, audit secret, wallet file, or other private wallet data.
3. Do not post private keys, screenshots containing secrets, or identifying transaction details unless you have considered the privacy implications.

Pull requests should be focused, include or update tests for behavior changes, and update the documentation when user-facing behavior changes.

## 📄 License

Bytecoin Zero is distributed under the **GNU Affero General Public License v3.0 only (AGPL-3.0-only)**. See [LICENSE](./LICENSE) for the complete license text.
