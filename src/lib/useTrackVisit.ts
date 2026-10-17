import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "./supabase";

/**
 * Counts one page view per route.
 *
 * public/visit-tracker.js has been logging the legacy static pages for
 * a while, but nothing logged the React app -- which is the actual
 * site. Every visitor number for this domain was therefore a count of
 * the handful of old .html pages, and read as though traffic had
 * collapsed.
 *
 * This writes the same three columns to the same page_views table, with
 * the same localStorage key, so a person who sees a legacy page and
 * then the app is one visitor rather than two.
 *
 * Deliberately silent. A view is a side effect of looking at a page: if
 * logging it fails, the person looking at the page must never find out.
 */

// Shared with public/visit-tracker.js on purpose -- see above.
const VISITOR_ID_KEY = "ac_visitor_id";

function visitorId(): string | null {
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    // Private browsing, or storage blocked. Still log the view, just
    // without a stable id to dedupe against -- an undercounted unique
    // is better than a missing visit.
    return null;
  }
}

export function useTrackVisit(): void {
  const { pathname } = useLocation();
  // React runs effects twice in StrictMode during development, and these
  // pages re-render on auth and data changes. Without this guard a
  // single visit is counted several times, which is worse than not
  // counting it: it looks like real traffic.
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    void supabase
      .from("page_views")
      .insert({
        path: pathname,
        referrer: document.referrer || null,
        visitor_id: visitorId(),
      })
      .then(
        () => {},
        () => {},
      );
  }, [pathname]);
}
