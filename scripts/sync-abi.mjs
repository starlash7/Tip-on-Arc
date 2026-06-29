import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const artifactPath = resolve("out/TipJar.sol/TipJar.json");
const abiPath = resolve("src/web/abi/TipJar.json");

const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
const abi = artifact.abi;

await mkdir(dirname(abiPath), { recursive: true });
await writeFile(abiPath, `${JSON.stringify(abi, null, 2)}\n`);
