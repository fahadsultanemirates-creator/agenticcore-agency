import { Router } from "express";
import fs from "fs";
import path from "path";
import {
  GetMarketsFuturesMemoryParams,
  GetMarketsFuturesMemoryResponse,
  GetMarketsFuturesStatusResponse,
} from "@workspace/api-zod";
import { getSession } from "./auth";

const router = Router();

// Auth middleware (same as customer.ts)
async function requireAuth(req: any, res: any, next: any): Promise<void> {
  const user = await getSession(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  req.marketsUser = user;
  next();
}

// The bundled server runs from artifacts/api-server, not the source route
// directory. An explicit override supports a VPS layout where the worker and
// API server live in separate locations.
const STATE_FILE = process.env.CRYPTO_STATE_FILE
  ? path.resolve(process.env.CRYPTO_STATE_FILE)
  : path.resolve(
      process.cwd(),
      "../agenticcore-markets/crypto/runtime/state.json",
    );
const MEMORY_SNAPSHOT_FILE = process.env.CRYPTO_MEMORY_SNAPSHOT_FILE
  ? path.resolve(process.env.CRYPTO_MEMORY_SNAPSHOT_FILE)
  : path.resolve(
      process.cwd(),
      "../agenticcore-markets/crypto/runtime/memory_snapshot.json",
    );

// Safe pending default returned when the worker has never run
const PENDING_DEFAULT = {
  schemaVersion: "1",
  exchange: "MEXC Futures",
  mode: "signal",
  marketDataStatus: "not_connected",
  accountStatus: "unknown",
  executionStatus: "not_connected",
  blockchainStatus: "pending",
  lastSync: null,
  config: null,
  dailyPnlUsdt: null,
  dailyGuardStatus: "unknown",
  candidates: [],
  openPositions: [],
  lastError: null,
  cycleCount: 0,
  topGainers: [],
  topLosers: [],
  marketContext: {},
  paperSummary: {},
  scanCoverage: {},
  radar: [],
  memoryStatus: "not_initialized",
  memoryLastUpdate: null,
  memoryError: null,
  supervisorStatus: "unknown",
};

/**
 * GET /markets/futures-status
 *
 * Returns the last state written by the Python crypto worker (runtime/state.json).
 * If the file is absent or unreadable, returns PENDING_DEFAULT.
 * Uses req.log (pino-http), not console.log.
 */
router.get(
  "/futures-status",
  requireAuth,
  async (req: any, res: any): Promise<void> => {
    let rawState: Record<string, unknown>;

    try {
      const raw = fs.readFileSync(STATE_FILE, "utf-8");
      rawState = JSON.parse(raw);
      req.log.debug(
        { stateFile: STATE_FILE },
        "Crypto worker state file loaded",
      );
    } catch (err: any) {
      if (err?.code === "ENOENT") {
        req.log.info(
          { stateFile: STATE_FILE },
          "Crypto state file not found; returning pending default",
        );
      } else {
        req.log.warn(
          { stateFile: STATE_FILE, err: err?.message },
          "Failed to read crypto state file; returning pending default",
        );
      }
      rawState = { ...PENDING_DEFAULT };
    }

    // Normalize Python snake_case → camelCase where needed
    const normalized: Record<string, unknown> = {
      schemaVersion: rawState.schema_version ?? rawState.schemaVersion ?? "1",
      exchange: rawState.exchange ?? "MEXC Futures",
      mode: rawState.mode ?? "signal",
      marketDataStatus:
        rawState.market_data_status ?? rawState.marketDataStatus ?? "not_connected",
      accountStatus:
        rawState.account_status ?? rawState.accountStatus ?? "unknown",
      executionStatus:
        rawState.execution_status ?? rawState.executionStatus ?? "not_connected",
      blockchainStatus:
        rawState.blockchain_status ?? rawState.blockchainStatus ?? "pending",
      lastSync: rawState.last_sync ?? rawState.lastSync ?? null,
      config: normalizeConfig(rawState.config),
      dailyPnlUsdt: rawState.daily_pnl_usdt ?? rawState.dailyPnlUsdt ?? null,
      dailyGuardStatus:
        rawState.daily_guard_status ?? rawState.dailyGuardStatus ?? "unknown",
      candidates: normalizeCandidates(rawState.candidates),
      openPositions: normalizeOpenPositions(rawState.open_positions ?? rawState.openPositions),
      lastError: rawState.last_error ?? rawState.lastError ?? null,
      cycleCount:
        typeof rawState.cycle_count === "number"
          ? rawState.cycle_count
          : typeof rawState.cycleCount === "number"
          ? rawState.cycleCount
          : 0,
      topGainers: normalizeMovers(rawState.top_gainers ?? rawState.topGainers),
      topLosers: normalizeMovers(rawState.top_losers ?? rawState.topLosers),
      marketContext: rawState.market_context ?? rawState.marketContext ?? {},
      paperSummary: rawState.paper_summary ?? rawState.paperSummary ?? {},
      scanCoverage: normalizeScanCoverage(rawState.scan_coverage ?? rawState.scanCoverage),
      radar: normalizeRadar(rawState.radar),
      memoryStatus: rawState.memory_status ?? rawState.memoryStatus ?? "not_initialized",
      memoryLastUpdate: rawState.memory_last_update ?? rawState.memoryLastUpdate ?? null,
      memoryError: rawState.memory_error ?? rawState.memoryError ?? null,
      supervisorStatus:
        rawState.supervisor_status ?? rawState.supervisorStatus ?? "unknown",
    };

    const parsed = GetMarketsFuturesStatusResponse.safeParse(normalized);
    if (!parsed.success) {
      req.log.warn(
        { issues: parsed.error.issues },
        "Crypto state failed schema validation; returning pending default",
      );
      res.json(GetMarketsFuturesStatusResponse.parse(PENDING_DEFAULT));
      return;
    }

    res.json(parsed.data);
  },
);

/**
 * GET /markets/futures-memory/:symbol
 *
 * The worker creates this compact export atomically from its local SQLite
 * memory. The API serves a normalized, authenticated view only; it never opens
 * the worker database or participates in trading decisions.
 */
router.get(
  "/futures-memory/:symbol",
  requireAuth,
  async (req: any, res: any): Promise<void> => {
    const params = GetMarketsFuturesMemoryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Symbol must be an uppercase MEXC USDT perpetual." });
      return;
    }
    let rawSnapshot: Record<string, unknown>;
    try {
      rawSnapshot = JSON.parse(fs.readFileSync(MEMORY_SNAPSHOT_FILE, "utf-8"));
    } catch (err: any) {
      req.log.info(
        { snapshotFile: MEMORY_SNAPSHOT_FILE, err: err?.code },
        "Crypto memory snapshot is not available",
      );
      res.status(404).json({ error: "No durable coin memory is available yet." });
      return;
    }
    const coins = rawSnapshot.coins;
    const rawCoin =
      coins && typeof coins === "object" && !Array.isArray(coins)
        ? (coins as Record<string, unknown>)[params.data.symbol]
        : undefined;
    if (!rawCoin || typeof rawCoin !== "object" || Array.isArray(rawCoin)) {
      res.status(404).json({ error: "No retained evidence for this symbol." });
      return;
    }
    const parsed = GetMarketsFuturesMemoryResponse.safeParse(normalizeCoinMemory(rawCoin));
    if (!parsed.success) {
      req.log.warn(
        { symbol: params.data.symbol, issues: parsed.error.issues },
        "Crypto coin memory failed schema validation",
      );
      res.status(404).json({ error: "Stored evidence is incomplete for this symbol." });
      return;
    }
    res.json(parsed.data);
  },
);

function normalizeConfig(raw: unknown): Record<string, unknown> | null {
  if (raw == null || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  return {
    signalMode: c.signal_mode ?? c.signalMode ?? true,
    candidateCount: c.candidate_count ?? c.candidateCount ?? 5,
    maxOpenPositions: c.max_open_positions ?? c.maxOpenPositions ?? 5,
    riskPerTradeUsdt: c.risk_per_trade_usdt ?? c.riskPerTradeUsdt ?? 2,
    dailyLossLimitUsdt: c.daily_loss_limit_usdt ?? c.dailyLossLimitUsdt ?? 20,
    dailyProfitTargetUsdt:
      c.daily_profit_target_usdt ?? c.dailyProfitTargetUsdt ?? 40,
    takeProfitUsdt: c.take_profit_usdt ?? c.takeProfitUsdt ?? 3,
    basketProfitTargetUsdt:
      c.basket_profit_target_usdt ?? c.basketProfitTargetUsdt ?? 5,
    stopAtrPeriod: c.stop_atr_period ?? c.stopAtrPeriod ?? 14,
    stopAtrMultiplier: c.stop_atr_multiplier ?? c.stopAtrMultiplier ?? 1.5,
    minimumStopPct: c.minimum_stop_pct ?? c.minimumStopPct ?? 0.002,
    maximumStopPct: c.maximum_stop_pct ?? c.maximumStopPct ?? 0.02,
    profitLockActivationPct:
      c.profit_lock_activation_pct ?? c.profitLockActivationPct ?? 65,
    profitLockProtectionPct:
      c.profit_lock_protection_pct ?? c.profitLockProtectionPct ?? 35,
    leverageMin: c.leverage_min ?? c.leverageMin ?? 15,
    leverageMax: c.leverage_max ?? c.leverageMax ?? 20,
    marginMode: c.margin_mode ?? c.marginMode ?? "isolated",
  };
}

function normalizeCandidates(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => ({
    rank: item.rank ?? 0,
    symbol: item.symbol ?? "—",
    selectionStatus: item.selection_status ?? item.selectionStatus ?? "pending",
    signalStatus: item.signal_status ?? item.signalStatus ?? "unknown",
    dataStatus: item.data_status ?? item.dataStatus ?? "pending",
    riskTier: item.risk_tier ?? item.riskTier ?? "unassigned",
    confidence: item.confidence ?? null,
    plannedQuantity: item.planned_quantity ?? item.plannedQuantity ?? null,
    plannedSide: item.planned_side ?? item.plannedSide ?? null,
    note: item.note ?? "",
    lastPrice: item.last_price ?? item.lastPrice ?? null,
    spreadPct: item.spread_pct ?? item.spreadPct ?? null,
    turnover24hUsdt: item.turnover_24h_usdt ?? item.turnover24hUsdt ?? null,
    fundingRate: item.funding_rate ?? item.fundingRate ?? null,
    oiUsdt: item.oi_usdt ?? item.oiUsdt ?? null,
    plannedMarginUsdt: item.planned_margin_usdt ?? item.plannedMarginUsdt ?? null,
    plannedStopPrice: item.planned_stop_price ?? item.plannedStopPrice ?? null,
    plannedTakeProfitPrice:
      item.planned_take_profit_price ?? item.plannedTakeProfitPrice ?? null,
    profitLockTriggerPrice:
      item.profit_lock_trigger_price ?? item.profitLockTriggerPrice ?? null,
    profitLockStopPrice:
      item.profit_lock_stop_price ?? item.profitLockStopPrice ?? null,
    plannedTargetProfitUsdt:
      item.planned_target_profit_usdt ?? item.plannedTargetProfitUsdt ?? null,
    relativeVolume: item.relative_volume ?? item.relativeVolume ?? null,
    supportPrice: item.support_price ?? item.supportPrice ?? null,
    resistancePrice: item.resistance_price ?? item.resistancePrice ?? null,
    pullbackConfirmed:
      item.pullback_confirmed ?? item.pullbackConfirmed ?? null,
    correlationStatus:
      item.correlation_status ?? item.correlationStatus ?? "unknown",
    supportZoneLow: item.support_zone_low ?? item.supportZoneLow ?? null,
    supportZoneHigh: item.support_zone_high ?? item.supportZoneHigh ?? null,
    supportZoneTouches: item.support_zone_touches ?? item.supportZoneTouches ?? null,
    resistanceZoneLow: item.resistance_zone_low ?? item.resistanceZoneLow ?? null,
    resistanceZoneHigh: item.resistance_zone_high ?? item.resistanceZoneHigh ?? null,
    resistanceZoneTouches:
      item.resistance_zone_touches ?? item.resistanceZoneTouches ?? null,
    entryStatus: item.entry_status ?? item.entryStatus ?? "unknown",
    entryZoneLow: item.entry_zone_low ?? item.entryZoneLow ?? null,
    entryZoneHigh: item.entry_zone_high ?? item.entryZoneHigh ?? null,
    entryInvalidationPrice:
      item.entry_invalidation_price ?? item.entryInvalidationPrice ?? null,
    entryExpiresAt: item.entry_expires_at ?? item.entryExpiresAt ?? null,
    fakeReversalDetected:
      item.fake_reversal_detected ?? item.fakeReversalDetected ?? null,
    opposingZoneDistancePct:
      item.opposing_zone_distance_pct ?? item.opposingZoneDistancePct ?? null,
    priceAction15mPct:
      item.price_action_15m_pct ?? item.priceAction15mPct ?? null,
    priceAction1hPct:
      item.price_action_1h_pct ?? item.priceAction1hPct ?? null,
    trend1h: item.trend_1h ?? item.trend1h ?? null,
    buyPressurePct:
      item.buy_pressure_pct ?? item.buyPressurePct ?? null,
    orderBookImbalancePct:
      item.order_book_imbalance_pct ?? item.orderBookImbalancePct ?? null,
    largeTradeCount:
      item.large_trade_count ?? item.largeTradeCount ?? null,
    largestTradeNotionalUsdt:
      item.largest_trade_notional_usdt ?? item.largestTradeNotionalUsdt ?? null,
    marketCapUsd: item.market_cap_usd ?? item.marketCapUsd ?? null,
    marketCapRank: item.market_cap_rank ?? item.marketCapRank ?? null,
    fullyDilutedValuationUsd:
      item.fully_diluted_valuation_usd ?? item.fullyDilutedValuationUsd ?? null,
    circulatingSupply:
      item.circulating_supply ?? item.circulatingSupply ?? null,
    crossMarketStatus:
      item.cross_market_status ?? item.crossMarketStatus ?? "unavailable",
    crossMarketAgreement:
      item.cross_market_agreement ?? item.crossMarketAgreement ?? "neutral",
    crossMarketAdjustment:
      item.cross_market_adjustment ?? item.crossMarketAdjustment ?? 0,
    crossMarketEvidence:
      item.cross_market_evidence ?? item.crossMarketEvidence ?? {},
  }));
}

function normalizeScanCoverage(raw: unknown): Record<string, number> {
  if (raw == null || typeof raw !== "object") return {};
  const coverage = raw as Record<string, unknown>;
  const normalize = (snake: string, camel: string): number | undefined => {
    const value = coverage[snake] ?? coverage[camel];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  };
  return {
    ...(normalize("contracts_discovered", "contractsDiscovered") !== undefined
      ? { contractsDiscovered: normalize("contracts_discovered", "contractsDiscovered")! }
      : {}),
    ...(normalize("tickers_received", "tickersReceived") !== undefined
      ? { tickersReceived: normalize("tickers_received", "tickersReceived")! }
      : {}),
    ...(normalize("liquidity_eligible", "liquidityEligible") !== undefined
      ? { liquidityEligible: normalize("liquidity_eligible", "liquidityEligible")! }
      : {}),
    ...(normalize("deep_probed", "deepProbed") !== undefined
      ? { deepProbed: normalize("deep_probed", "deepProbed")! }
      : {}),
    ...(normalize("microstructure_probed", "microstructureProbed") !== undefined
      ? { microstructureProbed: normalize("microstructure_probed", "microstructureProbed")! }
      : {}),
    ...(normalize("selected", "selected") !== undefined
      ? { selected: normalize("selected", "selected")! }
      : {}),
    ...(normalize("radar_count", "radarCount") !== undefined
      ? { radarCount: normalize("radar_count", "radarCount")! }
      : {}),
  };
}

function normalizeRadar(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeRadarRecord);
}

function normalizeRadarRecord(raw: unknown): Record<string, unknown> {
  const record = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  return {
    symbol: record.symbol ?? "—",
    baseCoin: record.base_coin ?? record.baseCoin ?? null,
    displayName: record.display_name ?? record.displayName ?? null,
    active: record.is_active === 1 || record.is_active === true || record.active === true,
    lastObservedAt: record.last_observed_at ?? record.lastObservedAt ?? null,
    lastPrice: record.last_price ?? record.lastPrice ?? null,
    lastTurnoverUsdt: record.last_turnover_usdt ?? record.lastTurnoverUsdt ?? null,
    lastChangePct24h: record.last_change_pct_24h ?? record.lastChangePct24h ?? null,
    radarState: record.radar_state ?? record.radarState ?? "watch",
    radarRank: record.radar_rank ?? record.radarRank ?? null,
    lastConfidence: record.last_confidence ?? record.lastConfidence ?? null,
    lastSignalStatus: record.last_signal_status ?? record.lastSignalStatus ?? null,
    lastEntryStatus: record.last_entry_status ?? record.lastEntryStatus ?? null,
    lastSide: record.last_side ?? record.lastSide ?? null,
    lastReason: record.last_reason ?? record.lastReason ?? null,
    totalScans: record.total_scans ?? record.totalScans ?? 0,
    totalEligibleScans: record.total_eligible_scans ?? record.totalEligibleScans ?? 0,
    totalProbes: record.total_probes ?? record.totalProbes ?? 0,
    totalSetupEvents: record.total_setup_events ?? record.totalSetupEvents ?? 0,
    totalTradeCount: record.total_trade_count ?? record.totalTradeCount ?? 0,
    wins: record.wins ?? 0,
    losses: record.losses ?? 0,
    flats: record.flats ?? 0,
  };
}

function normalizeCoinMemory(raw: unknown): Record<string, unknown> {
  const record = raw as Record<string, unknown>;
  const profile = record.profile;
  const rawProfile =
    profile && typeof profile === "object" && !Array.isArray(profile)
      ? (profile as Record<string, unknown>)
      : {};
  return {
    profile: {
      ...normalizeRadarRecord(rawProfile),
      quoteCoin: rawProfile.quote_coin ?? rawProfile.quoteCoin ?? null,
      contractType: rawProfile.contract_type ?? rawProfile.contractType ?? null,
      firstSeenAt: rawProfile.first_seen_at ?? rawProfile.firstSeenAt ?? "",
      lastSeenAt: rawProfile.last_seen_at ?? rawProfile.lastSeenAt ?? "",
      lastDataStatus: rawProfile.last_data_status ?? rawProfile.lastDataStatus ?? null,
      updatedAt: rawProfile.updated_at ?? rawProfile.updatedAt ?? null,
    },
    recentObservations: normalizeMemoryEvents(record.recent_observations ?? record.recentObservations, "market_observation"),
    setupEvents: normalizeMemoryEvents(record.setup_events ?? record.setupEvents, "candidate_observed"),
    tradeEvents: normalizeMemoryEvents(record.trade_events ?? record.tradeEvents, "paper_event"),
  };
}

function normalizeMemoryEvents(raw: unknown, fallbackType: string): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: unknown, index) => {
    const event = item && typeof item === "object" && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : {};
    const evidence =
      event.evidence && typeof event.evidence === "object" && !Array.isArray(event.evidence)
        ? event.evidence
        : {};
    return {
      eventKey: event.event_key ?? event.eventKey ?? `${fallbackType}:${index}`,
      occurredAt: event.observed_at ?? event.occurred_at ?? event.occurredAt ?? "",
      eventType: event.event_type ?? event.eventType ?? fallbackType,
      cycleCount: event.cycle_count ?? event.cycleCount ?? null,
      dataStatus: event.data_status ?? event.dataStatus ?? null,
      eligible: event.eligible == null ? null : Boolean(event.eligible),
      probed: event.probed == null ? null : Boolean(event.probed),
      side: event.side ?? null,
      outcome: event.outcome ?? null,
      structureId: event.structure_id ?? event.structureId ?? null,
      entryStatus: event.entry_status ?? event.entryStatus ?? null,
      confidence: event.confidence ?? null,
      reason: event.reason ?? null,
      evidence,
    };
  });
}

function normalizeMovers(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => ({
    symbol: item.symbol ?? "—",
    changePct24h: item.change_pct_24h ?? item.changePct24h ?? null,
    turnover24hUsdt:
      item.turnover_24h_usdt ?? item.turnover24hUsdt ?? null,
    spreadPct: item.spread_pct ?? item.spreadPct ?? null,
  }));
}

function normalizeOpenPositions(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item: any) => item && (item.status == null || item.status === "open"))
    .map((item: any) => ({
      symbol: item.symbol ?? "—",
      side: item.side ?? "unknown",
      quantity: item.quantity ?? item.hold_vol ?? item.holdVol ?? null,
      entryPrice: item.entry_price ?? item.entryPrice ?? item.open_price ?? item.openPrice ?? null,
      markPrice: item.mark_price ?? item.markPrice ?? null,
      unrealizedPnl:
        item.unrealized_pnl ?? item.unrealised_pnl ?? item.unrealizedProfit ?? null,
      liquidationPrice: item.liquidation_price ?? item.liquidationPrice ?? null,
      stopPrice: item.stop_price ?? item.stopPrice ?? null,
      takeProfitPrice: item.take_profit_price ?? item.takeProfitPrice ?? null,
      profitLockApplied: item.profit_lock_applied ?? item.profitLockApplied ?? null,
      source: item.id ? "local_paper" : "account_readonly",
    }));
}

export default router;
