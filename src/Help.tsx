import React, {useEffect, useRef} from 'react';
import Icon from './Icon';
import styles from './css/Help.module.css';

const topics = [
  ['help-start', 'Start here'],
  ['help-create-restore', 'Create or restore'],
  ['help-wallet-screen', 'Wallet screen'],
  ['help-receive', 'Receive BCN'],
  ['help-send', 'Send BCN'],
  ['help-transactions', 'Transactions'],
  ['help-backup', 'Backup and recovery'],
  ['help-contacts', 'Contacts and saved wallets'],
  ['help-settings', 'Settings and syncing'],
  ['help-security', 'Security and privacy'],
  ['help-troubleshooting', 'Troubleshooting'],
];

const Help = React.memo((props: {onClose: () => void}) => {
  const {onClose} = props;
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (closeButton.current) {
      closeButton.current.focus();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus) {
        previousFocus.focus();
      }
    };
  }, [onClose]);

  return (
    <div
      className={styles.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className={styles.dialog}
        role='dialog'
        aria-modal='true'
        aria-labelledby='wallet-help-title'
      >
        <header className={styles.header}>
          <span className={styles.headerIcon}><Icon name='help' size={21}/></span>
          <div className={styles.headerText}>
            <span className={styles.eyebrow}>BYTECOIN ZERO GUIDE</span>
            <h1 id='wallet-help-title'>Wallet help</h1>
            <p>Getting started, managing BCN, backups, and troubleshooting.</p>
          </div>
          <button
            ref={closeButton}
            type='button'
            className={styles.closeIcon}
            onClick={onClose}
            aria-label='Close help'
          >
            <Icon name='close' size={19}/>
          </button>
        </header>

        <div className={styles.layout}>
          <nav className={styles.contents} aria-label='Help topics'>
            <strong>On this page</strong>
            {topics.map(([id, label]) =>
              <a href={`#${id}`} key={id}>{label}</a>,
            )}
          </nav>

          <div className={styles.article}>
            <section id='help-start' className={styles.section}>
              <span className={styles.sectionKicker}>WELCOME</span>
              <h2>Start with wallet safety</h2>
              <p>Bytecoin Zero is a community-maintained, self-custody wallet. Your recovery phrase gives control of the wallet; the wallet password protects the local encrypted copy. They are different and both must be kept private.</p>
              <div className={`${styles.callout} ${styles.calloutWarning}`}>
                <Icon name='warning' size={19}/>
                <p><strong>Never share your recovery phrase, audit secret, password, or wallet backup.</strong> Support staff and community members should never ask you for them. Verify the recipient address, amount, and fee before sending; blockchain transfers cannot be reversed.</p>
              </div>
              <ol className={styles.steps}>
                <li><strong>Create or restore</strong> a wallet from the welcome screen.</li>
                <li><strong>Back it up</strong> before relying on this browser or device.</li>
                <li><strong>Wait for sync</strong> to finish before checking balances or sending.</li>
                <li><strong>Verify every payment</strong> in the transaction review before confirming it.</li>
              </ol>
            </section>

            <section id='help-create-restore' className={styles.section}>
              <span className={styles.sectionKicker}>WALLET ACCESS</span>
              <h2>Create or restore a wallet</h2>
              <h3>Create a new wallet</h3>
              <ol className={styles.steps}>
                <li>Choose <strong>Create New Wallet</strong>. The wallet generates a 24-word recovery phrase.</li>
                <li>Write every word down in order and store it privately offline. Confirm that you have saved it to continue.</li>
                <li>Set and confirm a wallet password. It encrypts the wallet stored in this browser.</li>
                <li>Use the Backup section to verify your recovery options and download an encrypted wallet backup.</li>
              </ol>
              <h3>Restore an existing wallet</h3>
              <p>Choose <strong>Restore Wallet</strong>, then select the method that matches your backup:</p>
              <ul>
                <li><strong>Seed phrase:</strong> enter the words in the original order. Supported phrase lengths are 12, 15, 18, 21, or 24 words.</li>
                <li><strong>Audit secret:</strong> use the secret associated with a view-only wallet. A view-only wallet cannot spend BCN and has no spend seed to back up.</li>
                <li><strong>Wallet file:</strong> select an encrypted <code>mywallet.wallet</code> exported by Bytecoin Zero and enter its password.</li>
              </ul>
              <p>Wallets already stored in this browser can be reopened from the welcome screen or <strong>Saved wallets</strong>. A restored wallet may need time to scan and synchronize before its full history appears.</p>
            </section>

            <section id='help-wallet-screen' className={styles.section}>
              <span className={styles.sectionKicker}>ORIENTATION</span>
              <h2>Understand the wallet screen</h2>
              <ul>
                <li><strong>Available balance</strong> is the amount currently available to spend. Locked or unconfirmed BCN is shown separately when present.</li>
                <li><strong>Hide balance</strong> masks the visible amount on screen; it does not encrypt or lock the wallet.</li>
                <li><strong>Network status</strong> shows the selected node and whether the wallet is connecting, syncing, or up to date. Syncing may take time, especially after restoring an older wallet.</li>
                <li><strong>Overview</strong> gives quick access to receiving BCN and viewing transactions. Use the sidebar to open the other wallet sections.</li>
                <li><strong>View-only wallet</strong> means spending actions are unavailable because the wallet has no spend key.</li>
              </ul>
            </section>

            <section id='help-receive' className={styles.section}>
              <span className={styles.sectionKicker}>INCOMING PAYMENTS</span>
              <h2>Receive BCN</h2>
              <ol className={styles.steps}>
                <li>Open <strong>Receive</strong> and select the address you want to use.</li>
                <li>Share the address or its QR code with the sender. Copy the address carefully; never ask a sender to use an address from an old payment without checking it.</li>
                <li>Use <strong>Add address</strong> for an additional wallet address. Labels and hide/restore choices help organize the list.</li>
              </ol>
              <p>Address labels, hidden-address choices, and the number of added addresses are stored in this browser. Hiding an address only removes it from the visible list; it does not delete it from the wallet. When recreating the wallet elsewhere, add the same number of addresses to restore the full list.</p>
            </section>

            <section id='help-send' className={styles.section}>
              <span className={styles.sectionKicker}>OUTGOING PAYMENTS</span>
              <h2>Send BCN safely</h2>
              <ol className={styles.steps}>
                <li>Open <strong>Send</strong>, enter or paste the recipient's Bytecoin address, and enter an amount. Use <strong>Send all</strong> to spend the available balance; the network fee is deducted automatically.</li>
                <li>Review the recommended fee rate and adjust the slow-to-fast slider if needed. A higher fee rate may help prioritization but does not guarantee a confirmation time.</li>
                <li><strong>Subtract fee from amount</strong> means the fee comes out of the entered amount, so the recipient receives less. When it is off, the fee is added to the amount deducted from your balance.</li>
                <li>Set an anonymity level from 3 to 50. Add a Payment ID only when the recipient requests it; it must be 16 or 64 hexadecimal characters.</li>
                <li>Select <strong>Review &amp; Send</strong>, enter your wallet password if requested, and check the final review. The transaction is broadcast only after you confirm the review.</li>
              </ol>
              <div className={styles.callout}>
                <Icon name='shield' size={19}/>
                <p>Before confirming, compare the full recipient address, amount received, network fee, anonymity level, and Payment ID. If anything is unexpected, cancel and check with the recipient through a trusted channel.</p>
              </div>
            </section>

            <section id='help-transactions' className={styles.section}>
              <span className={styles.sectionKicker}>PAYMENT HISTORY</span>
              <h2>Transactions and confirmations</h2>
              <ul>
                <li>Open <strong>Transactions</strong> to see incoming, outgoing, and wallet-internal activity.</li>
                <li>Select a transaction row to expand its inline details. Choose <strong>Transaction details</strong> to open the full details window, including status, date, amount, fee, transaction and block hashes, Payment ID, anonymity, unlock time, public key, extra data, and recipient addresses when available.</li>
                <li>Unconfirmed transactions may show confirmation progress. Bytecoin Zero uses a ten-confirmation threshold for its confirmation indicator; the node's status and the transaction's inclusion are separate from that indicator.</li>
                <li>Use the transaction hash link to open the public explorer. Explorer pages are external services and may have their own availability or privacy policies.</li>
                <li>For outgoing transactions, a send-proof link may be available in the expanded details.</li>
              </ul>
            </section>

            <section id='help-backup' className={styles.section}>
              <span className={styles.sectionKicker}>RECOVERY</span>
              <h2>Back up and recover your wallet</h2>
              <ul>
                <li>The <strong>recovery phrase</strong> can restore a spend wallet. Keep it offline and private; anyone who has it can control the funds.</li>
                <li>The downloaded phrase file is plain text and is not encrypted. Store it as carefully as the written phrase.</li>
                <li>The <strong>mywallet.wallet</strong> download is an encrypted Bytecoin Zero backup. It requires the wallet password and is not compatible with desktop <code>walletd</code>.</li>
                <li>Some older or imported wallets do not contain a recoverable phrase. In that case, keep the encrypted wallet file and its password; the app cannot recreate a missing phrase.</li>
                <li>New wallets and wallets migrated with a password are encrypted in browser storage. Older wallets may remain unencrypted until you set and confirm a password when opening them.</li>
                <li>Passwords are not saved by Bytecoin Zero and cannot be reset. If you forget the password, recovery requires the phrase or another valid backup path. Password changes are not currently supported.</li>
              </ul>
            </section>

            <section id='help-contacts' className={styles.section}>
              <span className={styles.sectionKicker}>ORGANIZATION</span>
              <h2>Contacts and saved wallets</h2>
              <h3>Contacts</h3>
              <p>Save a name and Bytecoin address in <strong>Contacts</strong> for quicker payments. Search the address book, copy an address, edit or delete a contact, or start a send to that contact. Contacts are stored in this browser for the current wallet; verify the address before sending.</p>
              <h3>Saved wallets</h3>
              <p>Saved wallets lists wallets available in this browser profile. It is not a cloud backup and does not automatically transfer wallets, contacts, or address labels to another device or browser profile. Export and securely store a wallet backup before clearing site data or changing devices.</p>
            </section>

            <section id='help-settings' className={styles.section}>
              <span className={styles.sectionKicker}>NETWORK</span>
              <h2>Settings and synchronization</h2>
              <ul>
                <li><strong>Selected node:</strong> the public node the wallet currently uses. Only add HTTPS nodes you trust.</li>
                <li><strong>Auto pool:</strong> include a node in automatic failover and random rotation. A disabled node is not selected automatically.</li>
                <li><strong>Test and save node settings:</strong> checks node reachability and saves the reachable configuration. A successful status check does not prove that the node supports the wallet's sync protocol.</li>
                <li><strong>Automatic failover:</strong> the wallet tries one other enabled node after a connection error. It cannot fix a node that is reachable but has an incompatible sync protocol.</li>
                <li><strong>Random rotation:</strong> optionally switches among enabled nodes at the chosen interval.</li>
                <li><strong>Prevent device sleep during sync:</strong> asks the browser to keep the device awake while the wallet is open; it cannot prevent every operating-system or browser suspension.</li>
              </ul>
              <div className={`${styles.callout} ${styles.calloutInfo}`}>
                <Icon name='network' size={19}/>
                <p>If synchronization stalls, check the selected node and the status message. Public nodes must be reachable from your browser and support the wallet's synchronization protocol. A node can answer a status check and still be incompatible.</p>
              </div>
            </section>

            <section id='help-security' className={styles.section}>
              <span className={styles.sectionKicker}>PRIVACY AND SECURITY</span>
              <h2>Protect your wallet</h2>
              <ul>
                <li>Use a long, unique wallet password and keep the recovery phrase separately. The password protects the local encrypted wallet; it is not a replacement for the phrase.</li>
                <li>Never enter a phrase into a link sent by someone else, and never share it in chat, email, screenshots, support requests, or cloud notes.</li>
                <li>Use Bytecoin Zero only at a site address you trust. Keep your browser and device updated, and avoid shared or compromised computers.</li>
                <li>Wallet data and preferences are stored locally in the browser. Clearing site data, changing browser profiles, or losing the device can remove local copies. Keep a verified offline backup.</li>
                <li>The selected node receives wallet synchronization requests and can observe network traffic associated with its service. A public node does not make your network connection anonymous.</li>
                <li>Do not include recovery phrases, passwords, private audit secrets, or wallet files in bug reports. Public transaction hashes and addresses may reveal activity.</li>
              </ul>
            </section>

            <section id='help-troubleshooting' className={styles.section}>
              <span className={styles.sectionKicker}>COMMON QUESTIONS</span>
              <h2>Troubleshooting</h2>
              <details>
                <summary>The wallet is stuck on Connecting or Syncing</summary>
                <p>Keep the wallet open and allow it to synchronize. Check the node status and try another enabled node in Settings if the connection fails. If the node is reachable but reports an incompatible version, choose a protocol-compatible node; repeating the status check will not resolve a protocol mismatch.</p>
              </details>
              <details>
                <summary>My balance or older transactions are missing</summary>
                <p>Wait until synchronization is up to date, then verify that you restored the intended wallet and recovery phrase. A view-only wallet cannot spend. If you restored with an incomplete address set, add the same number of wallet addresses used by the original wallet.</p>
              </details>
              <details>
                <summary>A transaction is still unconfirmed</summary>
                <p>Check its status and transaction hash in the Transactions section and, if useful, in the public explorer. Confirmation depends on the network and node; do not send the payment again until you understand the status, since that could create a duplicate payment.</p>
              </details>
              <details>
                <summary>I cannot open my backup or forgot the password</summary>
                <p>Confirm that the file is a Bytecoin Zero <code>mywallet.wallet</code> backup and use the password that encrypted it. Desktop <code>walletd</code> cannot open this app-specific container. There is no password reset; use the recovery phrase if available.</p>
              </details>
              <details>
                <summary>Copy or share does not work</summary>
                <p>Clipboard and sharing features depend on browser permissions and secure-context support. If copying fails, select the address and copy it manually, then compare it carefully before sending.</p>
              </details>
              <p className={styles.supportNote}>For software issues, use the project <a href='https://github.com/bytecoinworld/bytecoin-zero/issues' target='_blank' rel='noreferrer noopener'>support page</a>. Include the app version and the visible error, but never include wallet secrets.</p>
            </section>
          </div>
        </div>

        <footer className={styles.footer}>
          <span>Need to return to the wallet? Close this guide; your wallet stays open.</span>
          <button type='button' className={styles.closeButton} onClick={onClose}>Close help</button>
        </footer>
      </section>
    </div>
  );
});

export default Help;
