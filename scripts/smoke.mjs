// End-to-end smoke test of Milo in real Chrome (fake camera/mic). Prints PASS/FAIL per flow.
import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const OUT = process.argv[2] || ".";
const results = [];
const consoleErrors = [];
const badResponses = [];

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["camera", "microphone", "clipboard-read", "clipboard-write"] });
const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(`[${page.url().replace(BASE, "")}] ${m.text().slice(0, 220)}`);
});
page.on("pageerror", (e) => consoleErrors.push(`[pageerror ${page.url().replace(BASE, "")}] ${String(e).slice(0, 220)}`));
page.on("response", (r) => {
  const u = r.url();
  if (r.status() >= 400 && !u.includes("/api/tts") && !u.includes("favicon")) badResponses.push(`${r.status()} ${r.request().method()} ${u.replace(BASE, "").slice(0, 120)}`);
});

async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push(`PASS  ${name}  (${Date.now() - t0} ms)`);
  } catch (e) {
    results.push(`FAIL  ${name}: ${String(e.message || e).split("\n")[0].slice(0, 200)}`);
    await page.screenshot({ path: `${OUT}/fail-${name.replace(/\W+/g, "_")}.png` }).catch(() => {});
  }
}
const yes = () => page.getByRole("button", { name: "Yes, do it" }).click();
const lastMilo = () => page.locator("[role=log] >> text=/./").last();

// ---------------------------------------------------------------- onboarding
await step("onboarding: press-anything gate", async () => {
  await page.goto(`${BASE}/welcome`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByText("press any key").waitFor();
  await page.keyboard.press("a");
  await page.getByRole("button", { name: "Let’s start" }).waitFor({ timeout: 5000 });
});
await step("onboarding: needs → plan", async () => {
  await page.getByRole("button", { name: "Let’s start" }).click();
  await page.getByRole("button", { name: /Using my hands is hard/ }).click();
  await page.getByRole("button", { name: /I’m Deaf/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Turned on for you").waitFor();
  await page.getByText("Captions for everything").waitFor();
  await page.getByText(/Head mode — point with your nose/).waitFor();
});
await step("onboarding: measurements helper", async () => {
  await page.getByRole("button", { name: "Looks good" }).click();
  await page.getByText("Hip width (sitting)").waitFor();
  await page.getByRole("button", { name: "Change Narrowest doorway" }).click();
  await page.getByRole("button", { name: "More Narrowest doorway" }).click();
  await page.getByRole("button", { name: /Save 28.5/ }).click();
  await page.getByText("entered by you").first().waitFor();
});
await step("onboarding: calibration has a way out (Esc)", async () => {
  await page.getByRole("button", { name: "Continue to head setup" }).click();
  await page.getByText("Let’s calibrate head mode").waitFor();
  await page.keyboard.press("Escape");
  await page.waitForURL(`${BASE}/`, { timeout: 8000 });
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("milo.settings")));
  if (!s.onboarded || !s.needs.includes("deaf") || !s.captions || !s.scanning) throw new Error("settings not applied: " + JSON.stringify(s).slice(0, 160));
});
await step("head mode opens and Exit button leaves it", async () => {
  // onboarding chose head mode → HeadBoard (needs calibration first)
  const exit = page.getByRole("button", { name: /Exit calibration|Exit head mode/ });
  await exit.first().waitFor({ timeout: 8000 });
  await exit.first().click();
  await page.getByRole("radio", { name: /Type/ }).waitFor();
});

// reset to a typical typing user for the rest
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("milo.settings"));
  localStorage.setItem("milo.settings", JSON.stringify({ ...s, scanning: false, hoverDwell: false, visualAlerts: false, voiceOutput: true, needs: [], inputModes: ["text", "voice", "head", "sign"] }));
});
await page.goto(`${BASE}/?demo=1`);
await page.waitForTimeout(800);

// ---------------------------------------------------------------- core flows
await step("home renders (cards + quick phrases)", async () => {
  await page.getByText("Chairs that fit").first().waitFor();
  await page.getByText("Quick phrases").waitFor({ timeout: 8000 });
});
await step("typed question → fit check page with 2 fits", async () => {
  await page.getByLabel("Message Milo").fill("which chairs fit my home?");
  await page.keyboard.press("Enter");
  await page.waitForURL(`${BASE}/fit`, { timeout: 20000 });
  await page.getByText("Glide P2 Mid-Wheel").first().waitFor();
  await page.getByText("✅ Fits").first().waitFor({ timeout: 10000 });
  const n = await page.getByText("✅ Fits").count();
  if (n !== 2) throw new Error(`expected 2 fits, got ${n}`);
});
await step("fit detail shows numbers (Terra 29″ > 28″)", async () => {
  await page.goto(`${BASE}/fit/terra-hd`);
  await page.getByText(/29″ > bathroom door 28″/).waitFor({ timeout: 8000 });
});
await step("first letters W W A → appeal status answer", async () => {
  await page.goto(`${BASE}/`);
  await page.getByLabel("Message Milo").fill("W W A");
  await page.keyboard.press("Enter");
  const tile = page.getByRole("button", { name: /Suggestion 1: Where's my wheelchair appeal/ });
  await tile.waitFor({ timeout: 8000 });
  await tile.click();
  await page.getByText(/You have until Jan 12/).first().waitFor({ timeout: 20000 });
});
await step("AAC: quick phrase → confirm → spoken overlay → Esc closes", async () => {
  await page.getByRole("button", { name: "I want water" }).first().click();
  await page.getByText("Say “I want water” out loud?").first().waitFor();
  await yes();
  await page.locator("p.text-\\[64px\\]", { hasText: "I want water" }).waitFor({ timeout: 10000 });
  await page.keyboard.press("Escape");
  await page.locator("p.text-\\[64px\\]").waitFor({ state: "detached", timeout: 15000 });
});
await step("typed AAC sentence (I'm cold) → speak confirm", async () => {
  await page.getByLabel("Message Milo").fill("I'm cold");
  await page.keyboard.press("Enter");
  await page.getByText(/out loud\?/).first().waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "No, cancel" }).click();
  await page.getByText("Okay, I won’t do that.").or(page.getByText("Okay, I won't do that.")).first().waitFor({ timeout: 10000 });
});
await step("appeal: draft → review → fix (v2 diff)", async () => {
  await page.goto(`${BASE}/appeal`);
  await page.getByRole("button", { name: "Draft my appeal" }).click();
  await page.getByText(/Why the covered alternative/).waitFor({ timeout: 60000 });
  await page.getByRole("button", { name: /Run strict reviewer/ }).click();
  await page.getByText("Strict reviewer says…").waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Fix with Milo" }).click();
  await page.getByText(/Changes in v2/).waitFor({ timeout: 30000 });
});
await step("appeal: verify & file → sandbox verification → filed", async () => {
  await page.getByRole("button", { name: /Verify & file/ }).click();
  await yes();
  await page.getByRole("button", { name: "Verify (sandbox)" }).click({ timeout: 15000 });
  await page.getByText(/Appeal filed/).first().waitFor({ timeout: 20000 });
});
await step("shop: checkout → caregiver approval → verify → ordered", async () => {
  await page.goto(`${BASE}/shop`);
  await page.getByRole("button", { name: /Checkout with Milo/ }).first().click();
  await yes();
  // Milo's reply card shows on the Shop page itself
  const link = page.locator("[role=status] a[href^='/caregiver/']").last();
  await link.waitFor({ timeout: 20000 });
  const href = await link.getAttribute("href");
  const alex = await ctx.newPage();
  await alex.goto(`${BASE}${href}`);
  await alex.getByRole("button", { name: "✓ Approve" }).click();
  await alex.getByText(/You approved/).waitFor();
  await alex.close();
  await page.getByRole("button", { name: "Verify (sandbox)" }).click({ timeout: 25000 });
  await page.getByText(/Order placed/).first().waitFor({ timeout: 20000 });
});
await step("receipts panel lists steps with evidence", async () => {
  await page.getByRole("button", { name: "Open receipts" }).click();
  await page.getByRole("complementary", { name: "Receipts" }).getByText("✓ confirmed").first().waitFor({ timeout: 8000 });
  await page.keyboard.press("Escape");
});
await step("sign mode opens and Exit leaves it", async () => {
  await page.getByRole("radio", { name: /Sign/ }).click();
  await page.getByRole("button", { name: "Exit sign mode (Esc)" }).click({ timeout: 10000 });
  await page.getByRole("radio", { name: /Type/ }).waitFor();
});
await step("head mode Esc leaves it", async () => {
  await page.getByRole("radio", { name: /Head/ }).click();
  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("radio", { name: /Type/, checked: true }).waitFor({ timeout: 5000 });
});
await step("chat question gets a clean grounded answer", async () => {
  await page.goto(`${BASE}/`);
  await page.getByLabel("Message Milo").fill("how wide is the Glide?");
  await page.keyboard.press("Enter");
  await page.getByText(/24\.5 inches/).first().waitFor({ timeout: 30000 });
});
await step("shop refuses a chair that doesn't fit", async () => {
  await page.getByLabel("Message Milo").fill("order the Terra HD");
  await page.keyboard.press("Enter");
  await yes();
  await page.getByText(/I didn’t order the Terra|I didn't order the Terra/).first().waitFor({ timeout: 20000 });
});
await step("route: get there page plans (fallback ok)", async () => {
  await page.goto(`${BASE}/route`);
  await page.getByLabel("Where to?").fill("Oakland Public Library Main Library");
  await page.getByRole("button", { name: /Plan route/ }).click();
  await page.getByRole("link", { name: /Open in Google Maps/ }).waitFor({ timeout: 40000 });
});
for (const p of ["/settings", "/listen", "/measure", "/receipts"]) {
  await step(`page ${p} renders`, async () => {
    await page.goto(`${BASE}${p}`);
    await page.locator("h1").first().waitFor({ timeout: 8000 });
  });
}
await step("I need help button → confirm", async () => {
  await page.goto(`${BASE}/`);
  await page.getByRole("button", { name: /I need help/ }).click();
  await page.getByText("Say “I need help” out loud?").first().waitFor();
  await page.getByRole("button", { name: "No, cancel" }).click();
});

await browser.close();
console.log(results.join("\n"));
console.log(`\nconsole errors (${consoleErrors.length}):\n` + [...new Set(consoleErrors)].slice(0, 25).join("\n"));
console.log(`\nHTTP errors (${badResponses.length}):\n` + [...new Set(badResponses)].slice(0, 25).join("\n"));
