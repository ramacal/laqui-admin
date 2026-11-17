// Create the storage buckets and check public/private access rules.
//   npm run storage:init
import "dotenv/config";
import { buckets, ensureBuckets, putFile, publicUrl, signedUrl } from "../src/lib/storage";

async function main() {
  await ensureBuckets();
  console.log(`Buckets OK: ${buckets.public}, ${buckets.private}`);

  // Smoke test: public file readable anonymously, private file only via signed URL.
  const body = new TextEncoder().encode("ok");
  await putFile("public", "_check/public.txt", body, "text/plain");
  await putFile("private", "_check/private.txt", body, "text/plain");
  const pub = await fetch(publicUrl("_check/public.txt"));
  const privDirect = await fetch(`${process.env.STORAGE_ENDPOINT}/${buckets.private}/_check/private.txt`);
  const privSigned = await fetch(await signedUrl("_check/private.txt", 60));
  console.log(`public anonymous read:  ${pub.status} (expected 200)`);
  console.log(`private anonymous read: ${privDirect.status} (expected 403)`);
  console.log(`private signed read:    ${privSigned.status} (expected 200)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
