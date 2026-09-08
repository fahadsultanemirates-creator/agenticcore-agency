/**
 * BSC deposit poller — uses public BSC RPC directly (no API key required).
 * Queries eth_getLogs for incoming USDT BEP-20 transfers to the company wallet.
 * Polls every 5 minutes via cron.
 */
import { db } from "@workspace/db";
import { nwpUsersTable, nwpDepositsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { sendDepositDetectedEmails } from "./emailService";

const COMPANY_WALLET = (
  process.env.NWP_DEPOSIT_WALLET || "0x62Ad7D55fbc8A8591109D72b67Ec63aa1EE196bC"
).toLowerCase();

// USDT BEP-20 contract on BSC
const USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";

// Public BSC RPC endpoints that support eth_getLogs (tried in order)
const BSC_RPCS = [
  "https://bsc-rpc.publicnode.com",
  "https://bsc-dataseed1.defibit.io/",
  "https://bsc-dataseed1.ninicoin.io/",
];

// ERC-20 Transfer(address,address,uint256) event topic
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// Blocks to scan per poll (~5 min on BSC = ~100 blocks, scan 200 for safety)
const BLOCKS_PER_POLL = 200;

// Track last scanned block across polls
let lastScannedBlock: number | null = null;

// ─── RPC helpers ────────────────────────────────────────────────────────────

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  let lastErr: Error = new Error("No RPC endpoints available");
  for (const rpc of BSC_RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(10_000),
      });
      const json = (await res.json()) as { result?: unknown; error?: { message: string } };
      if (json.error) throw new Error(json.error.message);
      return json.result;
    } catch (err) {
      lastErr = err as Error;
      // Try next RPC
    }
  }
  throw lastErr;
}

async function getBlockNumber(): Promise<number> {
  const hex = await rpcCall("eth_blockNumber", []) as string;
  return parseInt(hex, 16);
}

interface LogEntry {
  transactionHash: string;
  topics: string[];
  data: string;
  blockNumber: string;
}

async function getUsdtTransfersToWallet(fromBlock: number, toBlock: number): Promise<LogEntry[]> {
  // topic[2] = padded recipient address (32 bytes)
  const paddedWallet = "0x000000000000000000000000" + COMPANY_WALLET.replace("0x", "");

  const logs = await rpcCall("eth_getLogs", [{
    fromBlock: "0x" + fromBlock.toString(16),
    toBlock:   "0x" + toBlock.toString(16),
    address:   USDT_CONTRACT,
    topics:    [TRANSFER_TOPIC, null, paddedWallet],
  }]) as LogEntry[];

  return logs;
}

function parseTransferLog(log: LogEntry): { txHash: string; from: string; amountRaw: bigint } {
  const from = "0x" + log.topics[1].slice(26); // remove padding
  const amountRaw = BigInt(log.data);
  return { txHash: log.transactionHash, from: from.toLowerCase(), amountRaw };
}

function rawToUsd(amountRaw: bigint): number {
  // USDT on BSC has 18 decimals
  return Number(amountRaw) / 1e18;
}

/**
 * Look up a specific tx hash via public RPC and check whether it is a valid
 * USDT transfer to the company wallet. Returns the USD amount if valid, null otherwise.
 */
export async function verifyTxHash(
  txHash: string
): Promise<{ amountUsd: number; from: string } | null> {
  try {
    const receipt = await rpcCall("eth_getTransactionReceipt", [txHash]) as {
      logs: LogEntry[];
      from: string;
    } | null;

    if (!receipt) {
      console.warn("[BSCScanner] verifyTxHash: tx not found:", txHash);
      return null;
    }

    const paddedWallet = "0x000000000000000000000000" + COMPANY_WALLET.replace("0x", "");

    const transferLog = receipt.logs.find(
      (log) =>
        log.topics[0]?.toLowerCase() === TRANSFER_TOPIC &&
        log.topics[2]?.toLowerCase() === paddedWallet &&
        // log.address is the token contract
        (log as any).address?.toLowerCase() === USDT_CONTRACT.toLowerCase()
    );

    if (!transferLog) return null;

    const { from, amountRaw } = parseTransferLog(transferLog);
    return { amountUsd: rawToUsd(amountRaw), from };
  } catch (err) {
    console.error("[BSCScanner] verifyTxHash error:", err);
    return null;
  }
}

// ─── Main poller ─────────────────────────────────────────────────────────────

export async function pollDeposits(): Promise<void> {
  try {
    const currentBlock = await getBlockNumber();

    // First run: start from 200 blocks back
    const fromBlock = lastScannedBlock !== null
      ? lastScannedBlock + 1
      : currentBlock - BLOCKS_PER_POLL;

    const toBlock = currentBlock;

    if (fromBlock > toBlock) return; // nothing new

    console.log(`[BSCScanner] Scanning blocks ${fromBlock}–${toBlock} for USDT transfers`);

    // Fetch users awaiting deposit
    const awaitingUsers = await db
      .select({
        userId:    nwpUsersTable.id,
        email:     nwpUsersTable.email,
        fullName:  nwpUsersTable.fullName,
        bnbWallet: nwpUsersTable.bnbWallet,
      })
      .from(nwpUsersTable)
      .where(eq(nwpUsersTable.status, "approved_inactive"));

    if (awaitingUsers.length === 0) {
      lastScannedBlock = toBlock;
      return;
    }

    // Fetch their awaiting deposits
    const awaitingDeposits = await db
      .select()
      .from(nwpDepositsTable)
      .where(eq(nwpDepositsTable.status, "awaiting"));

    if (awaitingDeposits.length === 0) {
      lastScannedBlock = toBlock;
      return;
    }

    const awaitingMap = new Map(awaitingDeposits.map((d) => [d.userId, d]));

    // Fetch on-chain transfers
    const logs = await getUsdtTransfersToWallet(fromBlock, toBlock);
    console.log(`[BSCScanner] Found ${logs.length} USDT transfer(s) to wallet`);

    for (const log of logs) {
      const { txHash, from, amountRaw } = parseTransferLog(log);
      const txAmountUsd = rawToUsd(amountRaw);

      // Match by sender wallet
      const matchedUser = awaitingUsers.find(
        (u) => u.bnbWallet && u.bnbWallet.toLowerCase() === from
      );
      if (!matchedUser) continue;

      const deposit = awaitingMap.get(matchedUser.userId);
      if (!deposit) continue;

      const expectedAmount = parseFloat(deposit.amountUsd);
      const tolerance = expectedAmount * 0.01; // 1%
      if (Math.abs(txAmountUsd - expectedAmount) > tolerance) {
        console.log(`[BSCScanner] Amount mismatch for user ${matchedUser.userId}: expected $${expectedAmount}, got $${txAmountUsd.toFixed(2)}`);
        continue;
      }

      // Mark deposit as detected
      await db
        .update(nwpDepositsTable)
        .set({ status: "detected", txHash, updatedAt: new Date() })
        .where(eq(nwpDepositsTable.id, deposit.id));

      console.log(`[BSCScanner] ✅ Deposit detected for user ${matchedUser.userId}: tx ${txHash}`);

      await sendDepositDetectedEmails({
        user:    { email: matchedUser.email, fullName: matchedUser.fullName },
        deposit: { amountUsd: deposit.amountUsd, package: deposit.package, txHash },
      });
    }

    lastScannedBlock = toBlock;
  } catch (err) {
    console.error("[BSCScanner] Poll error:", err);
  }
}
