// Create the storage buckets and check the access rules, which mirror Cloudflare R2.
//   npm run storage:init
import "dotenv/config";
import { buckets, ensureBuckets, putFile, publicUrl, signedUrl } from "../src/lib/storage";

async function main() {
  await ensureBuckets();
  console.log(`Buckets OK: ${buckets.public}, ${buckets.private}`);

  // Smoke test: public files are read from the public domain; the S3 API never answers anonymously.
  const body = new TextEncoder().encode("ok");
  await putFile("public", "_check/public.txt", body, "text/plain");
  await putFile("private", "_check/private.txt", body, "text/plain");
  const endpoint = process.env.STORAGE_ENDPOINT;
  const checks: [string, Promise<Response>, number][] = [
    ["public domain read", fetch(publicUrl("_check/public.txt")), 200],
    ["public domain folder listing", fetch(publicUrl("_check/")), 404],
    ["S3 API anonymous read, public bucket", fetch(`${endpoint}/${buckets.public}/_check/public.txt`), 403],
    ["S3 API anonymous read, private bucket", fetch(`${endpoint}/${buckets.private}/_check/private.txt`), 403],
    ["private signed read", signedUrl("_check/private.txt", 60).then((url) => fetch(url)), 200],
  ];
  let failed = 0;
  for (const [name, request, expected] of checks) {
    const status = (await request).status;
    if (status !== expected) failed++;
    console.log(`${status === expected ? "ok  " : "FAIL"} ${name}: ${status} (expected ${expected})`);
  }
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
