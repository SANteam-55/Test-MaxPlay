import test from "node:test";
import assert from "node:assert/strict";
import { SmartStreamService } from "./smartStreamService";

const TEST_STREAMTAPE_URL =
  "https://streamtape.com/v/6kjz8WP38qT9AKg/Crayon_Shin-chan_the_Movie_Super_Hot%21_The_Spicy_Kasukabe_Dancers_%282025%29_1080p_BluRay_x264_Dual_Audio_Hindi_Japanese_-_MoviesMod.Blue.mkv";

test("isExtractableSource detects Streamtape watch/embed URLs even with .mkv slug, while treating direct CDN/proxy URLs as playable", () => {
  assert.equal(SmartStreamService.isExtractableSource(TEST_STREAMTAPE_URL), true);
  assert.equal(
    SmartStreamService.isExtractableSource("https://streamtape.com/e/6kjz8WP38qT9AKg/video.mp4"),
    true
  );
  assert.equal(
    SmartStreamService.isExtractableSource("https://strtape.cloud/v/abc123def/episode.mkv"),
    true
  );
  assert.equal(
    SmartStreamService.isExtractableSource(
      "https://streamtape.com/get_video?id=6kjz8WP38qT9AKg&expires=1799999999&ip=1.2.3.4&token=REALTOKEN&stream=1"
    ),
    false
  );
  assert.equal(
    SmartStreamService.isExtractableSource(
      "https://cdn1.tapecontent.net/get_video?id=6kjz8WP38qT9AKg&stream=1"
    ),
    false
  );
  assert.equal(
    SmartStreamService.isExtractableSource(
      "/api/stream-proxy?url=https%3A%2F%2Fstreamtape.com%2Fget_video%3Fid%3D123&referer=https%3A%2F%2Fstreamtape.com%2F"
    ),
    false
  );
});

test("getEmbedUrl converts Streamtape /v/ watch URL to /e/ embed URL", () => {
  const embed = SmartStreamService.getEmbedUrl(TEST_STREAMTAPE_URL);
  assert.ok(embed);
  assert.ok(embed.startsWith("https://streamtape.com/e/6kjz8WP38qT9AKg/"));
});

test("resolveEmbedReferer resolves https://streamtape.com/ for Streamtape and tapecontent.net URLs", () => {
  assert.equal(SmartStreamService.resolveEmbedReferer(TEST_STREAMTAPE_URL), "https://streamtape.com/");
  assert.equal(
    SmartStreamService.resolveEmbedReferer("https://streamtape.com/get_video?id=6kjz8WP38qT9AKg&stream=1"),
    "https://streamtape.com/"
  );
  assert.equal(
    SmartStreamService.resolveEmbedReferer("https://edge12.tapecontent.net/get_video?id=abc"),
    "https://streamtape.com/"
  );
});

test("evaluateStreamtapeJsExpr accurately evaluates Streamtape JS obfuscation with substring, slice, parentheses, and fake-token avoidance", () => {
  // Multi-part concatenation + substring offset
  const expr1 =
    "('//streamtape.com/get_video?id=6kjz8WP38qT9AKg&expires=1800000&ip=1.1.1.1&token=' + 'FAKE_PREFIX_REAL_9988'.substring(12))";
  assert.equal(
    SmartStreamService.evaluateStreamtapeJsExpr(expr1),
    "//streamtape.com/get_video?id=6kjz8WP38qT9AKg&expires=1800000&ip=1.1.1.1&token=REAL_9988"
  );

  // Outer substring stripping junk prefix inside parentheses
  const expr2 =
    "('xxyy//streamtape.com/get_' + 'abcdvideo?id=6kjz8WP38qT9AKg&token=FINAL777'.substring(4)).substring(4)";
  assert.equal(
    SmartStreamService.evaluateStreamtapeJsExpr(expr2),
    "//streamtape.com/get_video?id=6kjz8WP38qT9AKg&token=FINAL777"
  );

  // Simulated DOM trap where last robotlink/ideoolink assignment wins over earlier trap assignment
  const simulatedHtml = `
    <div id="robotlink" style="display:none;">/streamtape.com/get_video?id=TRAP&token=FAKE_STATIC</div>
    <script>
      document.getElementById('robotlink').innerHTML = '/streamtape.com/get_video?id=TRAP2&token=' + 'BAD000'.substring(2);
      document.getElementById('ideoolink').innerHTML = ('//streamtape.com/' + 'zzzget_video?id=6kjz8WP38qT9AKg&token=TRUE_LIVE_TOKEN'.substring(3));
    </script>
  `;
  const extractedLegacy = SmartStreamService.extractStreamtapeUrlFromHtml(simulatedHtml);
  assert.equal(
    extractedLegacy,
    "https://streamtape.com/get_video?id=6kjz8WP38qT9AKg&token=TRUE_LIVE_TOKEN&stream=1"
  );

  // Live Streamtape /v/ watch page DOM IDs (norobotlink / captchalink / ideoooolink) + chained .substring(a).substring(b)
  const watchPageHtml = `
    <div id="norobotlink" style="display:none;">//streamtape.com/get_video?id=FAKE&token=TRAP</div>
    <script>
      document.getElementById('ideoooolink').innerHTML = '//streamtape.com/get_video?id=OLD&token=OLD_TOK';
      document.getElementById('captchalink').innerHTML = '//streamtape.c' + ('xcdom/get_video?id=6kjz8WP38qT9AKg&expires=1794903721&ip=FRMOD&token=REAL1').substring(2);
      document.getElementById('norobotlink').innerHTML = '//streamtape.' + ('xxxccom/get_video?id=6kjz8WP38qT9AKg&expires=1794903721&ip=FRMOD&token=WATCH_LIVE_99').substring(1).substring(3);
    </script>
  `;
  const extractedWatch = SmartStreamService.extractStreamtapeUrlFromHtml(watchPageHtml);
  assert.equal(
    extractedWatch,
    "https://streamtape.com/get_video?id=6kjz8WP38qT9AKg&expires=1794903721&ip=FRMOD&token=WATCH_LIVE_99&stream=1"
  );
});
