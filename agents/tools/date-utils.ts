/**
 * Date normalization utilities for the Crowdia extraction pipeline.
 *
 * The LLM extracts dates from Italian event sources and returns naive datetime
 * strings like "2026-02-07T23:00:00" (no timezone suffix). These represent
 * local Palermo time (Europe/Rome, UTC+1 in winter / UTC+2 in summer).
 *
 * Problem: JavaScript's Date constructor and PostgreSQL both treat bare
 * datetime strings without a timezone as UTC. This causes a 1-2 hour offset:
 * an event at 23:00 local time gets stored as 23:00 UTC and displayed as
 * midnight local time — the wrong date.
 *
 * Fix: detect naive datetime strings and append the correct UTC offset for
 * Europe/Rome before storing, so the DB holds the true UTC instant.
 */

const PALERMO_TIMEZONE = "Europe/Rome";

/**
 * Returns true if the string looks like a naive datetime (no offset/Z suffix).
 * Examples of naive: "2026-02-07T23:00:00", "2026-02-07 23:00:00"
 * Examples of aware: "2026-02-07T23:00:00Z", "2026-02-07T22:00:00+01:00"
 */
function isNaiveDatetime(dt: string): boolean {
  // Has explicit Z or +/- timezone offset → already aware
  if (/Z$/i.test(dt)) return false;
  if (/[+-]\d{2}:\d{2}$/.test(dt)) return false;
  if (/[+-]\d{4}$/.test(dt)) return false;
  return true;
}

/**
 * Get the UTC offset in minutes for Europe/Rome at a given local date/time.
 * Returns e.g. 60 for CET (UTC+1) or 120 for CEST (UTC+2).
 */
function getRomeOffsetMinutes(localDateStr: string): number {
  // Parse the date components from the string (treat as local Rome time)
  // We use a trick: format a known UTC time as Europe/Rome and compare
  // to determine the offset at that local time.
  //
  // Approach: binary-approximate using Intl.DateTimeFormat.
  // Simpler approach: check if the date falls in CEST period.
  // Europe/Rome: CET (UTC+1) Oct last Sun → Mar last Sun
  //              CEST (UTC+2) Mar last Sun → Oct last Sun
  const normalized = localDateStr.replace("T", " ");
  const [datePart, timePart] = normalized.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const hour = timePart ? parseInt(timePart.split(":")[0], 10) : 12;

  // Last Sunday of March (switch to CEST at 02:00 local)
  const cestStart = lastSundayOfMonth(year, 3); // month 3 = March
  // Last Sunday of October (switch to CET at 03:00 local)
  const cestEnd = lastSundayOfMonth(year, 10); // month 10 = October

  const dateNum = year * 10000 + month * 100 + day;
  const cestStartNum = year * 10000 + 3 * 100 + cestStart;
  const cestEndNum = year * 10000 + 10 * 100 + cestEnd;

  // On transition days, account for the exact hour of the switch
  if (dateNum === cestStartNum) {
    // March last Sunday: CET before 02:00, CEST from 02:00 onward
    return hour >= 2 ? 120 : 60;
  }
  if (dateNum === cestEndNum) {
    // October last Sunday: CEST before 03:00, CET from 03:00 onward
    return hour >= 3 ? 60 : 120;
  }

  if (dateNum > cestStartNum && dateNum < cestEndNum) {
    return 120; // CEST: UTC+2
  }
  return 60; // CET: UTC+1
}

/**
 * Returns the day of the last Sunday in a given month/year (1-indexed month).
 */
function lastSundayOfMonth(year: number, month: number): number {
  // Find last day of month, then back up to Sunday (0)
  const lastDay = new Date(year, month, 0).getDate(); // day 0 = last day of prev month
  const lastDate = new Date(year, month - 1, lastDay);
  const dow = lastDate.getDay(); // 0=Sun
  return lastDay - dow;
}

/**
 * Normalize a datetime string extracted by the LLM (assumed to be local
 * Palermo / Europe/Rome time if naive) to a UTC ISO 8601 string.
 *
 * - Already-aware strings (with Z or ±HH:MM) are returned as-is after
 *   validation.
 * - Naive strings get the correct Rome UTC offset applied, then are returned
 *   as UTC ISO strings.
 * - Invalid strings return null.
 */
export function normalizePalermoDatetime(dt: string | null | undefined): string | null {
  if (!dt) return null;

  const trimmed = dt.trim();
  if (!trimmed) return null;

  if (!isNaiveDatetime(trimmed)) {
    // Already has timezone info — parse and re-serialize as UTC ISO string
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  // Naive datetime — interpret as Europe/Rome local time
  const offsetMinutes = getRomeOffsetMinutes(trimmed);
  const offsetSign = "+";
  const offsetHours = Math.floor(offsetMinutes / 60).toString().padStart(2, "0");
  const offsetMins = (offsetMinutes % 60).toString().padStart(2, "0");
  const offsetStr = `${offsetSign}${offsetHours}:${offsetMins}`;

  // Build aware datetime string and parse as UTC
  const awareStr = trimmed.includes("T")
    ? `${trimmed}${offsetStr}`
    : `${trimmed.replace(" ", "T")}${offsetStr}`;

  const d = new Date(awareStr);
  if (isNaN(d.getTime())) return null;

  return d.toISOString();
}
