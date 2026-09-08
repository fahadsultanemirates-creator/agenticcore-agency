import json
import os
import tempfile
import unittest
from unittest.mock import patch

from integrations.crypto_memory import context_for_owner_query
from main import _is_valid_telegram_webhook_secret, TELEGRAM_WEBHOOK_SECRET


class CryptoMemoryContextTests(unittest.TestCase):
    def test_owner_context_returns_matching_symbol_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "memory.json")
            with open(path, "w", encoding="utf-8") as file:
                json.dump(
                    {
                        "summary": {"known_coins": 10, "active_coins": 9},
                        "radar": [],
                        "coins": {
                            "BTC_USDT": {
                                "profile": {
                                    "radar_state": "confirmed",
                                    "last_side": "long",
                                    "last_confidence": 82,
                                    "last_entry_status": "confirmed",
                                    "total_scans": 4,
                                    "total_trade_count": 1,
                                    "wins": 1,
                                    "losses": 0,
                                },
                                "setup_events": [
                                    {
                                        "evidence": {
                                            "cross_market_agreement": "long",
                                            "cross_market_status": "live",
                                            "cross_market_adjustment": 6,
                                        }
                                    }
                                ],
                            }
                        },
                    },
                    file,
                )
            with open(
                os.path.join(directory, "operator_reports.json"),
                "w",
                encoding="utf-8",
            ) as file:
                json.dump(
                    {
                        "reports": [
                            {
                                "label": "Daily (20 Aug 2026)",
                                "period_start": "2026-08-20",
                                "period_end": "2026-08-20",
                                "evidence": {
                                    "net_pnl_usdt": 1.25,
                                    "trade_count": 2,
                                    "open_positions": [],
                                    "daily_guard_status": "active",
                                },
                            }
                        ]
                    },
                    file,
                )
            with patch.dict(os.environ, {"CRYPTO_MEMORY_SNAPSHOT_FILE": path}):
                result = context_for_owner_query("What is BTC doing in crypto?")
        self.assertIn("BTC_USDT", result)
        self.assertIn("cross-market=long", result)
        self.assertIn("READ-ONLY FACTS", result)
        self.assertIn("Latest persisted owner reports", result)
        self.assertIn("net_pnl=1.25 USDT", result)

    def test_non_crypto_question_has_no_memory_injection(self):
        self.assertEqual(context_for_owner_query("Can you draft a homepage?"), "")

    def test_invalid_webhook_header_cannot_be_treated_as_owner_request(self):
        self.assertFalse(_is_valid_telegram_webhook_secret("forged-owner-chat"))
        if TELEGRAM_WEBHOOK_SECRET:
            self.assertTrue(_is_valid_telegram_webhook_secret(TELEGRAM_WEBHOOK_SECRET))


if __name__ == "__main__":
    unittest.main()