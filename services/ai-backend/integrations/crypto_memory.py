"""Read-only owner-facing bridge to Crypto Tier 1's durable memory snapshot."""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List


def _snapshot_path() -> str:
    override = os.environ.get("CRYPTO_MEMORY_SNAPSHOT_FILE", "").strip()
    if override:
        return override
    return os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "..",
            "..",
            "agenticcore-markets",
            "crypto",
            "runtime",
            "memory_snapshot.json",
        )
    )


def _load_snapshot() -> Dict[str, Any]:
    try:
        with open(_snapshot_path(), "r", encoding="utf-8") as file:
            data = json.load(file)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _load_operator_reports() -> List[Dict[str, Any]]:
    try:
        path = os.path.join(os.path.dirname(_snapshot_path()), "operator_reports.json")
        with open(path, "r", encoding="utf-8") as file:
            data = json.load(file)
        return [
            report
            for report in data.get("reports") or []
            if isinstance(report, dict)
        ]
    except (OSError, json.JSONDecodeError, AttributeError):
        return []


def _asks_for_crypto(text: str) -> bool:
    value = str(text or "").lower()
    return any(
        word in value
        for word in (
            "crypto",
            "coin",
            "token",
            "futures",
            "market",
            "radar",
            "long",
            "short",
            "trade",
            "report",
            "pnl",
            "profit",
            "loss",
            "btc",
            "eth",
            "sol",
        )
    )


def _requested_symbols(text: str, available: List[str]) -> List[str]:
    upper = str(text or "").upper().replace("-", "_")
    requested = set(re.findall(r"\b[A-Z0-9]{2,20}(?:_USDT)?\b", upper))
    matches: List[str] = []
    for symbol in available:
        base = symbol.removesuffix("_USDT")
        if symbol in requested or base in requested:
            matches.append(symbol)
    return matches[:5]


def _coin_summary(symbol: str, payload: Dict[str, Any]) -> str:
    profile = payload.get("profile") if isinstance(payload.get("profile"), dict) else {}
    setup_events = payload.get("setup_events") if isinstance(payload.get("setup_events"), list) else []
    latest = setup_events[0] if setup_events and isinstance(setup_events[0], dict) else {}
    evidence = latest.get("evidence") if isinstance(latest.get("evidence"), dict) else {}
    return (
        f"{symbol}: radar={profile.get('radar_state', 'unknown')}, "
        f"side={profile.get('last_side', 'unknown')}, "
        f"confidence={profile.get('last_confidence', 'unavailable')}, "
        f"entry={profile.get('last_entry_status', 'unknown')}, "
        f"scans={profile.get('total_scans', 0)}, "
        f"trades={profile.get('total_trade_count', 0)} "
        f"(wins={profile.get('wins', 0)}, losses={profile.get('losses', 0)}). "
        f"Latest evidence: cross-market={evidence.get('cross_market_agreement', 'unavailable')}, "
        f"status={evidence.get('cross_market_status', 'unavailable')}, "
        f"adjustment={evidence.get('cross_market_adjustment', 0)}."
    )


def _report_summary(report: Dict[str, Any]) -> str:
    evidence = report.get("evidence") if isinstance(report.get("evidence"), dict) else {}
    return (
        f"{report.get('label', 'Crypto report')}: "
        f"period={report.get('period_start', 'unavailable')}→{report.get('period_end', 'unavailable')}, "
        f"net_pnl={evidence.get('net_pnl_usdt', 'unavailable')} USDT, "
        f"closed_trades={evidence.get('trade_count', 'unavailable')}, "
        f"open_positions={len(evidence.get('open_positions') or [])}, "
        f"guard={evidence.get('daily_guard_status', 'unavailable')}."
    )


def context_for_owner_query(text: str) -> str:
    """
    Return a compact, untrusted data block for the Manager's owner-only prompt.

    The calling service remains responsible for the owner authorization check.
    No credential, private exchange account data, or instruction is read here.
    """
    if not _asks_for_crypto(text):
        return ""
    snapshot = _load_snapshot()
    reports = _load_operator_reports()
    coins = snapshot.get("coins") if isinstance(snapshot.get("coins"), dict) else {}
    radar = snapshot.get("radar") if isinstance(snapshot.get("radar"), list) else []
    report_lines = [_report_summary(report) for report in reports[-3:]]
    if not coins:
        return (
            "\n\n[OWNER-ONLY CRYPTO MEMORY]\n"
            "No readable Crypto Tier 1 memory snapshot is currently available. "
            "Do not infer a trade or state.\n"
            + (
                "Latest persisted owner reports:\n" + "\n".join(report_lines) + "\n"
                if report_lines
                else ""
            )
        )
    selected = _requested_symbols(text, list(coins.keys()))
    summaries = [
        _coin_summary(symbol, coins[symbol])
        for symbol in selected
        if isinstance(coins.get(symbol), dict)
    ]
    if not summaries:
        radar_rows = [item for item in radar[:5] if isinstance(item, dict)]
        summaries = [
            (
                f"{item.get('symbol', 'unknown')}: radar={item.get('radar_state', 'unknown')}, "
                f"side={item.get('last_side', 'unknown')}, "
                f"confidence={item.get('last_confidence', 'unavailable')}, "
                f"entry={item.get('last_entry_status', 'unknown')}."
            )
            for item in radar_rows
        ]
    summary = snapshot.get("summary") if isinstance(snapshot.get("summary"), dict) else {}
    return (
        "\n\n[OWNER-ONLY CRYPTO MEMORY — READ-ONLY FACTS]\n"
        "Use this only to explain recorded paper/signal evidence. It is not a "
        "trading instruction, not a price feed, and cannot justify a live order.\n"
        f"Memory health: known coins={summary.get('known_coins', 'unavailable')}, "
        f"active={summary.get('active_coins', 'unavailable')}, "
        f"last update={summary.get('last_update', 'unavailable')}.\n"
        + "\n".join(summaries[:5])
        + (
            "\nLatest persisted owner reports:\n" + "\n".join(report_lines)
            if report_lines
            else "\nNo persisted owner report is currently available."
        )
        + "\n"
    )[:5000]