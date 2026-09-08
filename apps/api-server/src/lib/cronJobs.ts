import cron from "node-cron";
import { creditDailyProfits, creditVipBonuses } from "./financialEngine";
import { pollDeposits } from "./bscScanner";

let initialized = false;

export function initCronJobs(): void {
  if (initialized) return;
  initialized = true;

  // Daily profit credit — 8:00 AM UTC, Monday–Friday
  cron.schedule("0 8 * * 1-5", async () => {
    console.info("[NWP Cron] Running daily profit job");
    try {
      await creditDailyProfits();
    } catch (err) {
      console.error("[NWP Cron] Daily profit job failed:", err);
    }
  }, { timezone: "UTC" });

  // VIP variable bonus — last day of each month at 10 AM UTC
  cron.schedule("0 10 28-31 * *", async () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isLastDay = tomorrow.getMonth() !== now.getMonth();

    if (isLastDay) {
      console.info("[NWP Cron] Running VIP month-end bonus job");
      try {
        await creditVipBonuses();
      } catch (err) {
        console.error("[NWP Cron] VIP bonus job failed:", err);
      }
    }
  }, { timezone: "UTC" });

  // BSCScan deposit poller — every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      await pollDeposits();
    } catch (err) {
      console.error("[NWP Cron] Deposit poll failed:", err);
    }
  }, { timezone: "UTC" });

  console.info("[NWP Cron] Cron jobs initialized (daily profits, VIP bonus, deposit poller)");
}
