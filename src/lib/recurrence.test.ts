import { describe, expect, it } from "vitest";

import { addPeriod, advance, recurrenceWord, upcoming } from "@/lib/recurrence";
import { toISODate } from "@/lib/dates";

/**
 * The month-end case in here is not hypothetical. A subscription anchored on
 * the 31st of January used to arrive in March, because adding a month to a
 * date that has no equivalent next month overflows into the one after.
 */

const iso = (y: number, m: number, d: number) =>
  toISODate(new Date(y, m - 1, d));

describe("addPeriod", () => {
  it("keeps the anchor day through a short month", () => {
    const jan31 = new Date(2026, 0, 31);
    const feb = addPeriod(jan31, "monthly", 31);
    expect(toISODate(feb)).toBe("2026-02-28");

    // And comes back to the 31st the month after, rather than staying on the 28th.
    expect(toISODate(addPeriod(feb, "monthly", 31))).toBe("2026-03-31");
  });

  it("handles February in a leap year", () => {
    expect(toISODate(addPeriod(new Date(2028, 0, 31), "monthly", 31))).toBe(
      "2028-02-29",
    );
  });

  it("adds seven days for a weekly period", () => {
    expect(toISODate(addPeriod(new Date(2026, 8, 28), "weekly", 28))).toBe(
      "2026-10-05",
    );
  });

  it("adds three months for a quarterly one, across a year boundary", () => {
    expect(toISODate(addPeriod(new Date(2026, 10, 15), "quarterly", 15))).toBe(
      "2027-02-15",
    );
  });

  // A yearly charge taken on a leap day has to land somewhere every other year.
  it("adds twelve months for a yearly one, off a leap day", () => {
    expect(toISODate(addPeriod(new Date(2028, 1, 29), "yearly", 29))).toBe(
      "2029-02-28",
    );
  });

  it("does not modify the date it was given", () => {
    const original = new Date(2026, 0, 31);
    addPeriod(original, "monthly", 31);
    expect(toISODate(original)).toBe("2026-01-31");
  });
});

describe("advance", () => {
  it("leaves a future date exactly where it is", () => {
    const result = advance("2026-12-01", "monthly", new Date(2026, 8, 5));
    expect(result.next).toBe("2026-12-01");
    expect(result.past).toEqual([]);
  });

  it("leaves today where it is — the charge has not happened yet", () => {
    const result = advance(
      "2026-09-05",
      "monthly",
      new Date(2026, 8, 5, 14, 0),
    );
    expect(result.next).toBe("2026-09-05");
  });

  it("steps a passed date forward and remembers where it has been", () => {
    const result = advance("2026-06-15", "monthly", new Date(2026, 8, 5));
    expect(result.next).toBe("2026-09-15");
    expect(result.past).toEqual(["2026-06-15", "2026-07-15", "2026-08-15"]);
  });

  it("keeps the anchor day across a February it had to skip", () => {
    const result = advance("2026-01-31", "monthly", new Date(2026, 3, 10));
    expect(result.next).toBe("2026-04-30");
    expect(result.past).toContain("2026-02-28");
    // The point of the anchor: March gets the 31st back.
    expect(result.past).toContain("2026-03-31");
  });

  it("gives up rather than spinning on an absurd date", () => {
    const result = advance("1901-01-01", "weekly", new Date(2026, 8, 5));
    // Bounded, and it says so by not reaching the present rather than hanging.
    expect(result.past.length).toBeLessThanOrEqual(400);
  });

  it("returns the input unchanged when it is not a date at all", () => {
    expect(advance("not a date", "monthly", new Date()).next).toBe(
      "not a date",
    );
  });
});

describe("upcoming", () => {
  it("lists the next few charges, starting with the one still ahead", () => {
    expect(upcoming("2026-10-03", "monthly", new Date(2026, 8, 5), 3)).toEqual([
      "2026-10-03",
      "2026-11-03",
      "2026-12-03",
    ]);
  });

  it("rolls a passed date forward before listing anything", () => {
    const dates = upcoming("2026-06-20", "monthly", new Date(2026, 8, 5), 2);
    expect(dates).toEqual(["2026-09-20", "2026-10-20"]);
  });

  it("holds the anchor day across every short month in the run", () => {
    const dates = upcoming(
      iso(2026, 1, 31),
      "monthly",
      new Date(2026, 0, 1),
      4,
    );
    expect(dates).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("covers three years for a yearly subscription", () => {
    expect(upcoming("2026-11-11", "yearly", new Date(2026, 8, 5), 3)).toEqual([
      "2026-11-11",
      "2027-11-11",
      "2028-11-11",
    ]);
  });

  it("returns nothing when asked for nothing", () => {
    expect(upcoming("2026-11-11", "yearly", new Date(2026, 8, 5), 0)).toEqual(
      [],
    );
  });
});

describe("recurrenceWord", () => {
  /*
   * Seven subscriptions all read "Subscription / Membership" under a heading
   * that already said Subscriptions. This says the thing that differs between
   * them: Fitness First is yearly and Netflix is not.
   */
  it("names how often it charges", () => {
    expect(recurrenceWord("weekly")).toBe("Weekly");
    expect(recurrenceWord("monthly")).toBe("Monthly");
    expect(recurrenceWord("quarterly")).toBe("Quarterly");
    expect(recurrenceWord("yearly")).toBe("Yearly");
  });
});
