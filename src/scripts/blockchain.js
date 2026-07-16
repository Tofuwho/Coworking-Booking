/* ═══════════════════════════════════════════════════════════════
   OOP BLOCKCHAIN LEDGER ENGINE — COWORKING IMMUTABLE LOG
   ═══════════════════════════════════════════════════════════════ */

/**
 * Transaction Object Class
 * Encapsulates individual workspace audit events & reservations
 */
export class WorkspaceTransaction {
  constructor(action, workspaceId, workspaceLabel, userRole, details = {}) {
    this.id = 'tx-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now();
    this.action = action; // 'CREATE_SPOT' | 'UPDATE_SPOT' | 'BOOK_SPOT' | 'DECORATE_3D' | 'DELETE_SPOT'
    this.workspaceId = workspaceId;
    this.workspaceLabel = workspaceLabel;
    this.userRole = userRole; // 'admin' | 'user'
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.hash = this.calculateHash();
  }

  calculateHash() {
    const str = this.id + this.action + this.workspaceId + this.userRole + this.timestamp + JSON.stringify(this.details);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return '0x' + Math.abs(hash).toString(16).padStart(8, '0');
  }
}

/**
 * Cryptographic Block Object Class
 */
export class Block {
  constructor(index, timestamp, transactions, previousHash = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.nonce = 0;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    const str = this.index + this.previousHash + this.timestamp + JSON.stringify(this.transactions) + this.nonce;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return '00' + hex + Math.abs((hash * 31) | 0).toString(16).padStart(8, '0');
  }

  mineBlock(difficulty = 2) {
    const target = '0'.repeat(difficulty);
    while (this.hash.substring(0, difficulty) !== target && this.nonce < 10000) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
  }
}

/**
 * OOP Blockchain Ledger Engine Class
 */
export class CoworkingBlockchain {
  constructor() {
    this.chain = [];
    this.difficulty = 1;
    this.pendingTransactions = [];
    this.STORAGE_KEY = 'cw_blockchain_ledger';
    this.init();
  }

  init() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        const raw = JSON.parse(saved);
        this.chain = raw.chain || [];
        this.pendingTransactions = raw.pendingTransactions || [];
      } catch (e) {
        this.createGenesisBlock();
      }
    } else {
      this.createGenesisBlock();
    }
  }

  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        chain: this.chain,
        pendingTransactions: this.pendingTransactions
      }));
    } catch (_) {}
  }

  createGenesisBlock() {
    const genesisTx = new WorkspaceTransaction(
      'GENESIS',
      'system-0',
      'Coworking Main Floor Network',
      'system',
      { note: 'Genesis Block initialized for Coworking Studio Blockchain Network' }
    );
    const genesisBlock = new Block(0, new Date().toISOString(), [genesisTx], '0000000000000000');
    genesisBlock.mineBlock(this.difficulty);
    this.chain = [genesisBlock];
    this.save();
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  addTransaction(action, workspaceId, workspaceLabel, userRole, details = {}) {
    const tx = new WorkspaceTransaction(action, workspaceId, workspaceLabel, userRole, details);
    this.pendingTransactions.push(tx);
    
    this.minePendingTransactions();
    return tx;
  }

  minePendingTransactions() {
    if (this.pendingTransactions.length === 0) return;

    const block = new Block(
      this.chain.length,
      new Date().toISOString(),
      this.pendingTransactions,
      this.getLatestBlock().hash
    );

    block.mineBlock(this.difficulty);
    this.chain.push(block);
    this.pendingTransactions = [];
    this.save();
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }
    }
    return true;
  }

  getHistoryForWorkspace(workspaceId) {
    const history = [];
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.workspaceId === workspaceId || workspaceId === 'ALL') {
          history.push({
            blockIndex: block.index,
            blockHash: block.hash,
            previousHash: block.previousHash,
            timestamp: tx.timestamp,
            action: tx.action,
            userRole: tx.userRole,
            workspaceId: tx.workspaceId,
            workspaceLabel: tx.workspaceLabel,
            details: tx.details
          });
        }
      }
    }
    return history.reverse();
  }
}

// Global Singleton
export const coworkingChain = window.coworkingChain || new CoworkingBlockchain();
window.coworkingChain = coworkingChain;
