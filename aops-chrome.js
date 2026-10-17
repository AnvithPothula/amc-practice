// AoPS put /wiki behind a Cloudflare "Verify you are human" check, so the
// browser can't call api.php cross-origin and a plain server proxy gets the
// challenge page too. Instead we drive a real Chrome window: requests run as
// same-origin fetches inside an AoPS tab (over the DevTools protocol, using
// Node's built-in WebSocket). If the check shows up, click it once.
// Used by the Vite dev server (vite.config.js) and scripts/snapshot.js.
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const AOPS = "https://artofproblemsolving.com";
const CDP = "http://127.0.0.1:9333";
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const listTabs = () =>
  fetch(`${CDP}/json`)
    .then((r) => r.json())
    .catch(() => null);

async function aopsTab() {
  let tabs = await listTabs();
  if (!tabs) {
    spawn(
      CHROME,
      [
        "--remote-debugging-port=9333",
        `--user-data-dir=${resolve(import.meta.dirname, ".aops-chrome")}`,
        "--no-first-run",
        "--no-default-browser-check",
        `${AOPS}/wiki/index.php/Main_Page`,
      ],
      { detached: true, stdio: "ignore" },
    ).unref();
    for (let i = 0; i < 50 && !tabs; i++) {
      await sleep(200);
      tabs = await listTabs();
    }
    if (!tabs) throw new Error(`Couldn't start Chrome at ${CHROME}`);
  }
  return (
    tabs.find((t) => t.type === "page" && t.url.startsWith(AOPS)) ??
    fetch(`${CDP}/json/new?${AOPS}/wiki/index.php/Main_Page`, {
      method: "PUT",
    }).then((r) => r.json())
  );
}

// Runs fetch(path) inside the AoPS tab. Resolves to { status, type, body }
// (body is base64 when `binary`), or null if the page wasn't ready (e.g.
// mid-navigation right after the check is passed).
// ponytail: one WebSocket per call; pool it if request volume ever matters.
async function fetchInTab(tab, path, binary) {
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  try {
    await new Promise((ok, fail) => {
      ws.onopen = ok;
      ws.onerror = () => fail(new Error("DevTools connection failed"));
    });
    const reply = new Promise((ok) => {
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === 1) ok(msg);
      };
    });
    const read = binary
      ? `new Uint8Array(await r.arrayBuffer()).reduce((s, b) => s + String.fromCharCode(b), "")`
      : "await r.text()";
    ws.send(
      JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: {
          expression: `fetch(${JSON.stringify(path)}).then(async (r) => ({
            status: r.status,
            type: r.headers.get("content-type"),
            body: ${binary ? `btoa(${read})` : read},
          }))`,
          awaitPromise: true,
          returnByValue: true,
        },
      }),
    );
    const msg = await Promise.race([reply, sleep(30000).then(() => null)]);
    return msg?.result?.result?.value ?? null;
  } finally {
    ws.close();
  }
}

// While the Cloudflare check is up, AoPS answers with an HTML challenge page
// (cf-mitigated). Bring the Chrome window forward and retry until it's solved.
async function aopsFetch(path, binary, isReal) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const tab = await aopsTab();
    const res = await fetchInTab(tab, path, binary);
    if (res && isReal(res)) return res;
    if (attempt === 0) fetch(`${CDP}/json/activate/${tab.id}`).catch(() => {});
    await sleep(2000);
  }
  throw new Error(
    "AoPS security check not passed: click 'Verify you are human' in the Chrome window.",
  );
}

// api.php query string -> JSON text.
export async function aopsApiText(query) {
  const res = await aopsFetch(`/wiki/api.php?${query}`, false, (r) =>
    r.type?.includes("json"),
  );
  return res.body;
}

// Path under /wiki/images/ -> { status, type, body (base64) }. A 404 is a
// real answer; only the challenge page (403 HTML) is retried.
export function aopsImage(path) {
  return aopsFetch(
    `/wiki/images/${path}`,
    true,
    (r) => r.status !== 403 || !r.type?.includes("html"),
  );
}
