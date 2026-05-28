#!/usr/bin/env node
import { createPrivateKey, sign as cryptoSign } from "node:crypto";
import { appendFile } from "node:fs/promises";

const requiredEnv = [
  "ASC_KEY_ID",
  "ASC_ISSUER_ID",
  "ASC_PRIVATE_KEY",
  "IOS_BUNDLE_ID",
  "MARKETING_VERSION",
];

for (const name of requiredEnv) {
  if (!process.env[name]) {
    throw new Error(`${name} is required`);
  }
}

const keyId = process.env.ASC_KEY_ID;
const issuerId = process.env.ASC_ISSUER_ID;
const privateKeyPem = process.env.ASC_PRIVATE_KEY.replaceAll("\\n", "\n");
const bundleId = process.env.IOS_BUNDLE_ID;
const marketingVersion = process.env.MARKETING_VERSION;

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("=", "")
    .replaceAll("+", "-")
    .replaceAll("/", "_");
}

function jsonBase64Url(value) {
  return base64Url(JSON.stringify(value));
}

function createAppStoreConnectToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 20 * 60,
    aud: "appstoreconnect-v1",
  };
  const signingInput = `${jsonBase64Url(header)}.${jsonBase64Url(payload)}`;
  const privateKey = createPrivateKey(privateKeyPem);
  const signature = cryptoSign("sha256", Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${base64Url(signature)}`;
}

const token = createAppStoreConnectToken();

async function api(path, params) {
  const url = new URL(`https://api.appstoreconnect.apple.com/v1${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`App Store Connect API ${response.status} ${response.statusText}: ${body}`);
  }
  return response.json();
}

async function listAll(path, params) {
  const items = [];
  let page = await api(path, params);
  items.push(...page.data);

  while (page.links?.next) {
    const response = await fetch(page.links.next, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`App Store Connect API ${response.status} ${response.statusText}: ${body}`);
    }
    page = await response.json();
    items.push(...page.data);
  }

  return items;
}

const apps = await listAll("/apps", {
  "filter[bundleId]": bundleId,
  limit: "1",
});
if (apps.length === 0) {
  throw new Error(`No App Store Connect app found for bundle id ${bundleId}`);
}

const appId = apps[0].id;
const builds = await listAll("/builds", {
  "filter[app]": appId,
  "filter[version]": marketingVersion,
  "filter[platform]": "IOS",
  "fields[builds]": "version",
  limit: "200",
});

const buildNumbers = builds
  .map((build) => Number.parseInt(build.attributes?.version ?? "", 10))
  .filter(Number.isSafeInteger);
const nextBuildNumber = Math.max(0, ...buildNumbers) + 1;

if (process.env.GITHUB_ENV) {
  await appendFile(process.env.GITHUB_ENV, `BUILD_NUMBER=${nextBuildNumber}\n`);
}

console.log(`MARKETING_VERSION=${marketingVersion} BUILD_NUMBER=${nextBuildNumber}`);
