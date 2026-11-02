// Copyright 2019 The Bytecoin developers.
// Licensed under the GNU Affero General Public License, version 3.

import React, {useContext, useEffect, useRef, useState} from 'react';
import Icon from './Icon';
import * as util from './lib/util';
import * as appSettings from './lib/settings';
import styles from './css/SettingsForm.module.css';

// @ts-ignore
import NoSleep from 'nosleep.js';

const dayMS = 60 * 60 * 24 * 1000;

interface INodeCheckSummary {
  readonly enabledNodes: string[];
  readonly reachableNodes: string[];
  readonly report: string[];
}

interface INodeEntry {
  readonly address: string;
  readonly enabled: boolean;
}

function nodeEntriesFromSettings(settings: appSettings.INodeSettings): INodeEntry[] {
  return settings.nodePool.map((address) => ({
    address,
    enabled: !settings.disabledNodes.includes(address),
  }));
}

const SettingsForm = React.memo((props: {
  viewOnly: boolean,
  topBlockHeight: number,
  topKnownBlockHeight: number,
  topBlockTime: Date,
  nodeSettings: appSettings.INodeSettings,
  onNodeSettingsChange: (settings: appSettings.INodeSettings) => void,
  onNodeChange: (nodeAddress: string) => Promise<boolean>,
  dismiss: () => void,
}) => {
  const syncing = props.topBlockHeight !== props.topKnownBlockHeight;
  const farBehind = (new Date()).valueOf() - props.topBlockTime.valueOf() > 2 * dayMS;
  const wantNoSleep = syncing && farBehind && util.isMobile();

  const wallet = useContext(util.WalletContext);
  const noSleep = useRef(new NoSleep());
  const [activeNode, setActiveNode] = useState(props.nodeSettings.activeNode);
  const [nodes, setNodes] = useState<INodeEntry[]>(() => nodeEntriesFromSettings(props.nodeSettings));
  const [newNodeAddress, setNewNodeAddress] = useState('');
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editedNodeAddress, setEditedNodeAddress] = useState('');
  const [randomNode, setRandomNode] = useState(props.nodeSettings.randomNode);
  const [rotationMinutes, setRotationMinutes] = useState(props.nodeSettings.rotationMinutes);
  const [savingNodeSettings, setSavingNodeSettings] = useState(false);
  const [testingNodes, setTestingNodes] = useState(false);
  const [nodeResult, setNodeResult] = useState('');

  useEffect(() => {
    if (!wantNoSleep) {
      turnNoSleep(false);
    }
  }, [wantNoSleep]);

  useEffect(() => () => noSleep.current.disable(), []);

  useEffect(() => {
    setActiveNode(props.nodeSettings.activeNode);
    setNodes(nodeEntriesFromSettings(props.nodeSettings));
    setEditingNode(null);
    setRandomNode(props.nodeSettings.randomNode);
    setRotationMinutes(props.nodeSettings.rotationMinutes);
  }, [props.nodeSettings]);

  const turnNoSleep = (on: boolean) => {
    console.info(`no sleep: ${on}`);

    if (on) {
      noSleep.current.enable();
    } else {
      noSleep.current.disable();
    }
  };

  const closeWallet = async () => {
    if (wallet) {
      await wallet.close();
    }
  };

  const addNode = () => {
    try {
      if (nodes.length >= 10) {
        throw new Error('You can add up to 10 nodes.');
      }
      const address = appSettings.normalizeNodeAddress(newNodeAddress);
      if (nodes.some((node) => node.address === address)) {
        throw new Error('This node is already in the list.');
      }
      setNodes([...nodes, {address, enabled: true}]);
      setNewNodeAddress('');
      setNodeResult(`${address} added to the automatic node pool. Test and save to apply.`);
    } catch (error) {
      setNodeResult(error instanceof Error ? error.message : String(error));
    }
  };

  const toggleNode = (address: string, enabled: boolean) => {
    const updatedNodes = nodes.map((node) => node.address === address ? {...node, enabled} : node);
    setNodes(updatedNodes);
    if (randomNode && updatedNodes.filter((node) => node.enabled).length < 2) {
      setRandomNode(false);
    }
  };

  const saveEditedNode = (originalAddress: string) => {
    try {
      if (originalAddress === props.nodeSettings.activeNode) {
        throw new Error('Select and save another active node before editing this node URL.');
      }
      const address = appSettings.normalizeNodeAddress(editedNodeAddress);
      if (nodes.some((node) => node.address !== originalAddress && node.address === address)) {
        throw new Error('This node is already in the list.');
      }
      setNodes(nodes.map((node) => node.address === originalAddress ? {...node, address} : node));
      if (activeNode === originalAddress) {
        setActiveNode(address);
      }
      setEditingNode(null);
      setNodeResult(`${address} updated. Test and save to apply.`);
    } catch (error) {
      setNodeResult(error instanceof Error ? error.message : String(error));
    }
  };

  const deleteNode = (address: string) => {
    if (address === props.nodeSettings.activeNode) {
      setNodeResult('Select and save another active node before deleting this one.');
      return;
    }
    if (nodes.length <= 1) {
      setNodeResult('Keep at least one public node in the list.');
      return;
    }
    const updatedNodes = nodes.filter((node) => node.address !== address);
    setNodes(updatedNodes);
    if (activeNode === address) {
      setActiveNode(props.nodeSettings.activeNode);
    }
    if (randomNode && updatedNodes.filter((node) => node.enabled).length < 2) {
      setRandomNode(false);
    }
    setNodeResult('Node removed. Test and save to apply.');
  };

  const testNodes = async (): Promise<INodeCheckSummary | null> => {
    setTestingNodes(true);
    setNodeResult('');
    try {
      if (nodes.length === 0) {
        throw new Error('Add at least one public node.');
      }
      if (nodes.length > 10) {
        throw new Error('You can add up to 10 nodes.');
      }
      const selectedNode = appSettings.normalizeNodeAddress(activeNode);
      if (!nodes.some((node) => node.address === selectedNode)) {
        throw new Error('Select a node from the list.');
      }
      const enabledNodes = nodes.filter((node) => node.enabled).map((node) => node.address);
      if (randomNode && enabledNodes.length < 2) {
        throw new Error('Enable at least two nodes before turning on random rotation.');
      }
      const nodesToCheck = Array.from(new Set<string>([selectedNode, ...enabledNodes]));
      const reachableNodes: string[] = [];
      const report: string[] = [];
      for (const result of await appSettings.checkNodePool(nodesToCheck)) {
        if ('height' in result) {
          reachableNodes.push(result.node);
          report.push(`${result.node} — RPC reachable at block ${util.formatNumber(result.height)}`);
        } else {
          report.push(`${result.node} — RPC check failed (${result.error}); verify network access and browser CORS.`);
        }
      }
      if (!reachableNodes.includes(selectedNode)) {
        report.push(`Selected node ${selectedNode} is not reachable; settings were not saved.`);
        setNodeResult(report.join('\n'));
        return null;
      }
      if (randomNode && enabledNodes.filter((node) => reachableNodes.includes(node)).length < 2) {
        report.push('Random rotation requires at least two reachable nodes; settings were not saved.');
        setNodeResult(report.join('\n'));
        return null;
      }
      setNodeResult(report.join('\n'));
      return {enabledNodes, reachableNodes, report};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setNodeResult(`Node check failed: ${message}`);
      return null;
    } finally {
      setTestingNodes(false);
    }
  };

  const saveNodes = async () => {
    if (savingNodeSettings) {
      return;
    }

    setSavingNodeSettings(true);
    const checkedNodes = await testNodes();
    if (!checkedNodes) {
      setSavingNodeSettings(false);
      return;
    }

    const selectedNode = appSettings.normalizeNodeAddress(activeNode);
    const reachableNodes = new Set(checkedNodes.reachableNodes);
    const unreachableEnabledNodes = checkedNodes.enabledNodes.filter((node) => !reachableNodes.has(node));
    const disabledNodes = nodes
      .filter((node) => !node.enabled || unreachableEnabledNodes.includes(node.address))
      .map((node) => node.address);
    const nextSettings: appSettings.INodeSettings = {
      activeNode: props.nodeSettings.activeNode,
      nodePool: nodes.map((node) => node.address),
      disabledNodes,
      randomNode,
      rotationMinutes,
    };
    props.onNodeSettingsChange(nextSettings);
    const report = [...checkedNodes.report];
    if (unreachableEnabledNodes.length > 0) {
      report.push('Nodes that failed their connection check were kept in the list but disabled in the automatic pool.');
    }

    try {
      if (selectedNode !== props.nodeSettings.activeNode) {
        const switched = await props.onNodeChange(selectedNode);
        setNodeResult([
          ...report,
          switched ? 'Node settings saved and the wallet switched nodes.' : 'Other node settings were saved, but the wallet is still using its previous node.',
        ].join('\n'));
      } else {
        setNodeResult([...report, 'Node settings saved.'].join('\n'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setNodeResult(`Could not switch nodes: ${message}`);
    } finally {
      setSavingNodeSettings(false);
    }
  };

  return (
    <div className={styles.settingsForm}>
      <section className={styles.section}>
        <h2>Network</h2>
        <div className={styles.selectedNode}>
          <span>Selected public node</span>
          <strong>{activeNode}</strong>
        </div>
        <div className={styles.addNodeForm}>
          <label htmlFor='new-public-node'>Add public node <span>New nodes join the automatic pool by default.</span></label>
          <div className={styles.addNodeRow}>
            <input
              id='new-public-node'
              type='url'
              value={newNodeAddress}
              onChange={(e) => setNewNodeAddress(e.target.value)}
              placeholder='https://node.example.org:8091'
            />
            <button type='button' className={styles.addNodeButton} onClick={addNode} disabled={nodes.length >= 10}>
              <Icon name='plus' size={17}/>
              Add node
            </button>
          </div>
        </div>
        <ul className={styles.nodeList} aria-label='Configured public nodes'>
          {nodes.map((node) => {
            const isEditing = editingNode === node.address;
            const isSelected = activeNode === node.address;
            return (
              <li key={node.address} className={styles.nodeItem}>
                <div className={styles.nodeEntryMain}>
                  {isEditing ?
                    <input
                      className={styles.nodeEditInput}
                      type='url'
                      value={editedNodeAddress}
                      onChange={(e) => setEditedNodeAddress(e.target.value)}
                      aria-label={`Edit URL for ${node.address}`}
                    /> :
                    <span className={styles.nodeAddress}>{node.address}</span>
                  }
                  {isSelected && <span className={styles.selectedBadge}>Selected</span>}
                </div>
                <div className={styles.nodeActions}>
                  <label className={styles.nodeToggle}>
                    <input
                      type='checkbox'
                      checked={node.enabled}
                      onChange={(e) => toggleNode(node.address, e.target.checked)}
                      aria-label={`Include ${node.address} in automatic failover and rotation`}
                    />
                    <span className={styles.toggleTrack} aria-hidden='true'/>
                    <span>Auto pool</span>
                  </label>
                  <button
                    type='button'
                    className={styles.nodeIconButton}
                    onClick={() => {
                      setEditingNode(node.address);
                      setEditedNodeAddress(node.address);
                      setNodeResult('');
                    }}
                    disabled={isEditing}
                    aria-label={`Edit ${node.address}`}
                    title='Edit node'
                  >
                    <Icon name='edit' size={16}/>
                  </button>
                  {isEditing && <>
                    <button
                      type='button'
                      className={styles.nodeIconButton}
                      onClick={() => saveEditedNode(node.address)}
                      aria-label={`Save ${node.address}`}
                      title='Save node address'
                    >
                      <Icon name='check' size={16}/>
                    </button>
                    <button
                      type='button'
                      className={styles.nodeIconButton}
                      onClick={() => setEditingNode(null)}
                      aria-label={`Cancel editing ${node.address}`}
                      title='Cancel edit'
                    >
                      <Icon name='close' size={16}/>
                    </button>
                  </>}
                  <button
                    type='button'
                    className={`${styles.nodeIconButton} ${styles.deleteNodeButton}`}
                    onClick={() => deleteNode(node.address)}
                    aria-label={`Delete ${node.address}`}
                    title='Delete node'
                  >
                    <Icon name='trash' size={16}/>
                  </button>
                  <button
                    type='button'
                    className={isSelected ? styles.nodeSelectSelected : styles.nodeSelectButton}
                    onClick={() => setActiveNode(node.address)}
                    disabled={isSelected}
                  >
                    {isSelected ? 'Selected' : 'Use node'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className={styles.checkboxRow}>
          <input
            type='checkbox'
            id='random-node'
            checked={randomNode}
            onChange={(e) => setRandomNode(e.target.checked)}
            disabled={nodes.filter((node) => node.enabled).length < 2}
          />
          <label htmlFor='random-node'>Rotate randomly every</label>
          <select value={rotationMinutes} onChange={(e) => setRotationMinutes(Number(e.target.value))} disabled={!randomNode}>
            {[5, 15, 30, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
          </select>
        </div>
        <p className={styles.helpText}>The automatic pool contains enabled nodes. The wallet tries one alternate node after a connection error; random rotation uses enabled nodes. A successful get_status check confirms reachability, not sync-protocol compatibility. Direct public nodes must allow browser CORS.</p>
        {nodeResult && <pre className={styles.nodeResult} role='status'>{nodeResult}</pre>}
        <button type='button' className={styles.primaryButton} onClick={saveNodes} disabled={savingNodeSettings || testingNodes}>
          <Icon name='network' size={17}/>
          {savingNodeSettings ? 'Checking nodes…' : 'Test and save node settings'}
        </button>
      </section>

      <section className={styles.section}>
        <h2>Wallet protection</h2>
        <p className={styles.helpText}>Bytecoin Zero encrypts new wallets and wallets migrated with a password using AES-GCM and a PBKDF2-derived key. Passwords are never stored. Existing legacy wallets remain unencrypted until you set and confirm a password when opening them; changing a password later is not supported. The encrypted `mywallet.wallet` backup works only with Bytecoin Zero, not desktop walletd. If you forget the password, restore with your recovery phrase.</p>
      </section>

      <section className={styles.section}>
        <h2>Sync and device</h2>
        <label className={styles.checkboxRow} htmlFor='noSleep'>
          <input type='checkbox' id='noSleep' onChange={(e) => turnNoSleep(e.target.checked)}/>
          Prevent device sleep during sync
        </label>
      </section>

      <div className={styles.controls}>
        <button className={styles.closeWallet} onClick={closeWallet}><Icon name='close' size={16}/>Close wallet</button>
        <button className={styles.dismiss} onClick={props.dismiss}><Icon name='check' size={16}/>Done</button>
      </div>
    </div>
  )
});

export default SettingsForm;
