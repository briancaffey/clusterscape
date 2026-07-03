import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--use-angle=metal", "--window-size=1600,1000"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.error("PAGEERROR:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("CONSOLE:", m.text()));
await page.goto(process.argv[2] ?? "http://localhost:4173/", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 6000));
await page.screenshot({ path: process.argv[3] ?? "/tmp/cs.png" });
await browser.close();
