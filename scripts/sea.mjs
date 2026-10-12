// Builds a single executable (Node's single executable applications) for this machine's
// platform: the bundled CLI injected into a copy of the Node binary. CI runs it on Linux,
// macOS and Windows for the releases.
import { execFileSync } from "node:child_process";
import { copyFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const windows = process.platform === "win32";
const mac = process.platform === "darwin";
const binary = `build/benchsort-sync-${process.platform}-${process.arch}${windows ? ".exe" : ""}`;

writeFileSync(
  "build/sea-config.json",
  JSON.stringify({
    main: "build/benchsort-sync.cjs",
    output: "build/sea-prep.blob",
    disableExperimentalSEAWarning: true,
  }),
);
execFileSync(process.execPath, ["--experimental-sea-config", "build/sea-config.json"], {
  stdio: "inherit",
});
copyFileSync(process.execPath, binary);
if (mac) execFileSync("codesign", ["--remove-signature", binary]);
execFileSync(
  windows ? "npx.cmd" : "npx",
  [
    "postject",
    binary,
    "NODE_SEA_BLOB",
    "build/sea-prep.blob",
    "--sentinel-fuse",
    "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
    ...(mac ? ["--macho-segment-name", "NODE_SEA"] : []),
  ],
  { stdio: "inherit", shell: windows },
);
if (mac) execFileSync("codesign", ["--sign", "-", binary]);
console.log(`Built ${binary}`);
