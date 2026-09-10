// Live SDK contract check; all event transport is intercepted, never sent to Meta.
import { webkit, devices } from "@playwright/test";
import ts from "typescript";
import { readFile } from "node:fs/promises";
import http from "node:http";
import assert from "node:assert/strict";

const pixelId = process.env.META_PIXEL_ID || "";
assert(/^\d{5,25}$/.test(pixelId), "Set META_PIXEL_ID to the dataset to check");
const source = await readFile(new URL("../src/lib/meta-pixel.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
}).outputText;
const server = http.createServer((request, response) => {
  response.setHeader("content-type", request.url === "/meta.js" ? "application/javascript" : "text/html");
  response.end(request.url === "/meta.js" ? compiled : `<button id="allow">Allow</button><button id="deny">Deny</button>
<script type="module">import * as meta from '/meta.js'; window.meta=meta; meta.configureMeta('${pixelId}');
document.querySelector('#allow').onclick=()=>{meta.setMetaConsent('granted');meta.startMeta()};
document.querySelector('#deny').onclick=()=>meta.setMetaConsent('denied');</script>`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  // Use the same WebKit/mobile profile as the app's acceptance suite.
  browser = await webkit.launch();
  const page = await browser.newPage({ ...devices["iPhone 13"] });
  const events = [];
  await page.route(/^https:\/\/(?:[^/]+\.)?facebook\.com\//, async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith("/tr")) return route.fulfill({ status: 200, body: "" });
    const parameters = new URLSearchParams(route.request().postData() || url.search);
    events.push(parameters.get("ev"));
    return route.fulfill({ status: 200, body: "" });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  assert.equal(await page.locator("#scanner-meta-pixel").count(), 0);
  const waitForEvent = async name => {
    for (let i = 0; i < 40 && !events.includes(name); i++) await page.waitForTimeout(500);
    assert(events.includes(name), `Real SDK did not emit ${name}`);
  };
  await page.evaluate(() => {
    window.meta.setMetaConsent("granted");
    window.meta.trackMetaPurchase({ eventId: `purchase_${"e".repeat(64)}`, value: 2.99, currency: "EUR" });
  });
  await page.locator("#allow").click();
  await waitForEvent("PageView");
  await waitForEvent("Purchase");
  await page.evaluate(() => window.meta.trackMetaPurchase({ eventId: `purchase_${"e".repeat(64)}`, value: 2.99, currency: "EUR" }));
  assert.equal(events.filter(name => name === "Purchase").length, 1);
  await page.evaluate(() => window.meta.trackMetaFunnel("onboarding_completed"));
  await waitForEvent("OnboardingCompleted");
  await page.locator("#deny").click();
  const count = events.length;
  await page.evaluate(() => window.meta.trackMetaFunnel("checkout_started"));
  await page.waitForTimeout(1000);
  assert.equal(events.length, count, "Withdrawal must stop subsequent events");
  console.log(JSON.stringify({ status: "passed", events, transport: "intercepted locally", withdrawal: "passed" }));
} finally {
  await browser?.close();
  server.close();
}
