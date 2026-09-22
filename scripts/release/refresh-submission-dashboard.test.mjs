import assert from "node:assert/strict";
import test from "node:test";
import {applySubmissions} from "./refresh-submission-dashboard.mjs";

const snapshot = {queries: {
  platform_status: {rows: [{platform: "Example", releaseStatus: "Old"}]},
  html5_distribution_candidates: {rows: [{platform: "Example", submissionProgress: "Old", nextGate: "Old"}]},
  target_links: {rows: [{platform: "Example", gameUrl: "https://game.example", adminUrl: "https://admin.example", gameLinkStatus: "Old"}]},
  manual_action_checklist: {rows: [{platform: "Example", status: "To do", priority: "Now", action: "Old", destination: "", unlocks: "Listing"}]},
}};

const row = {platform: "Example", outcome: "live", status: "Live listing verified",
  verifiedAt: "2026-09-22T17:00:00Z", submissionUrl: "https://submit.example",
  listingUrl: "https://listing.example", gameUrl: "https://game.example", httpStatus: 200,
  evidence: "Independent listing reached", nextStep: "Monitor listing"};

test("verified live receipt updates status, links and action queue", () => {
  const result = applySubmissions(snapshot, {verifiedAt: row.verifiedAt, results: [row]});
  assert.equal(result.queries.platform_status.rows[0].releaseStatus, "Live listing verified. Monitor listing");
  assert.equal(result.queries.target_links.rows[0].gameUrl, row.listingUrl);
  assert.equal(result.queries.manual_action_checklist.rows[0].status, "Complete");
  assert.deepEqual(result.queries.submission_activity.rows, [row]);
});

test("live and submitted outcomes require a server receipt and live requires a listing", () => {
  assert.throws(() => applySubmissions(snapshot, {verifiedAt: row.verifiedAt, results: [{...row, httpStatus: null}]}), /Server receipt/);
  assert.throws(() => applySubmissions(snapshot, {verifiedAt: row.verifiedAt, results: [{...row, listingUrl: ""}]}), /Live listing URL/);
  assert.throws(() => applySubmissions(snapshot, {verifiedAt: row.verifiedAt, results: [row, row]}), /Duplicate/);
});
