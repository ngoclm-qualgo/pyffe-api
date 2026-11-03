Email updated to new template with new app logo

Email is sent the product domain @pyffe.com 

Email is sent in all languages supported by Pyffe (English, Vietnamese, French, Portuguese, Spanish, Filipino)

No mention of KinShield / Qualgo / Uney in any of notification and email content, in all language

```
curl --location 'https://qa-pyffe-api.qualgo.dev/api/v1/auth/challenge/anonymous' \
--header 'Content-Type: application/json' \
--header 'x-device-id: 14D7B399-ADF3-411B-B4CF-D63A2FCE5E8G' \
--header 'x-language: en' \
--header 'x-country-code: VN' \
--header 'x-correlation-id: qa_001' \
--header 'x-device-information: ewogICJkZXZpY2VOYW1lIjogImlQaG9uZSAxNyIsCiAgImJyYW5kIjogIkFwcGxlIiwKICAib3NWZXJzaW9uIjogIjI0IiwKICAiYXBwVmVyc2lvbiI6ICIxLjAuMCIKfQ==' \
--data-raw '{
    "authFlow": "LOGIN",
    "challengeName": "INIT_CHALLENGE",
    "clientMetadata": {
        "type": "EMAIL",
        "email": "your-email@yopmail.com"
    }
}'
```

script for bypassing HMAC
```
// Skipping logic if local
const currentEnv = pm.environment.name;

if (currentEnv == "Qualgo LOCAL") {
    console.log(`Skipping HMAC script. Current environment: ${currentEnv}`);
    return;
}

// Start running logic
const crypto = require("crypto-js");

const secret = (
    pm.environment.get("hmacSecret") ||
    pm.collectionVariables.get("hmacSecret") ||
    pm.globals.get("hmacSecret") ||
    ""
).trim();

if (!secret) {
    throw new Error("hmacSecret is missing! Set it in Environment or Collection variables.");
}

const clientSecret = "1!K50<FVs";
const period = 1800;
const countryCode = pm.environment.get("countryCode") || "VN";

// ---------------------------------------------------------------------------
// HMAC helpers — match kong-plugins/hmac-validate/lib/hmac-validate.lua
// ---------------------------------------------------------------------------

const toLuaTable = (val) => {
    if (Array.isArray(val)) {
        const obj = {};
        val.forEach((item, i) => { obj[i + 1] = toLuaTable(item); });
        return obj;
    }
    if (val !== null && typeof val === "object") {
        const obj = {};
        for (const [k, v] of Object.entries(val)) obj[k] = toLuaTable(v);
        return obj;
    }
    return val;
};

const buildSortedJsonStr = (t) => {
    const sortedKeys = Object.keys(t).sort((a, b) => {
        const na = Number(a), nb = Number(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return String(a).localeCompare(String(b));
    });

    const parts = sortedKeys.map((key) => {
        const value = t[key];
        let dataVal;
        if (value !== null && typeof value === "object") dataVal = buildSortedJsonStr(value);
        else if (typeof value === "string") dataVal = `"${value}"`;
        else dataVal = String(value);
        return `"${key}":${dataVal}`;
    });
    return "{" + parts.join(",") + "}";
};

const convertJsonToFormattedString = (jsonObject) => {
    if (typeof jsonObject !== "object" || jsonObject === null) return "";
    const luaObj = toLuaTable(jsonObject);
    return Object.keys(luaObj).sort().map((key) => {
        const value = luaObj[key];
        const formatted = (value !== null && typeof value === "object")
            ? buildSortedJsonStr(value) : String(value);
        return `${key}=${formatted}`;
    }).join("\n");
};

const buildHmac = (message) =>
    crypto.HmacSHA256(message, secret).toString(crypto.enc.Hex).toLowerCase();

// ---------------------------------------------------------------------------
// Country code header
// ---------------------------------------------------------------------------

function encrypt(plaintext, encryptSecret) {
    const key = crypto.enc.Utf8.parse(encryptSecret);
    const iv = crypto.enc.Hex.parse("00000000000000000000000000000000");
    return crypto.AES.encrypt(plaintext, key, {
        iv, mode: crypto.mode.CFB, padding: crypto.pad.NoPadding,
    }).ciphertext.toString(crypto.enc.Hex);
}

function buildCountryCodeHeaderValue(cc) {
    const timeData = Math.floor(Date.now() / 1000 / period);
    return encrypt(`${cc}:${timeData}`, clientSecret);
}

// ---------------------------------------------------------------------------
// Build payload — match handler.lua
// ---------------------------------------------------------------------------

const method = pm.request.method.toUpperCase();
let canonicalString = "";
let bodyObj = null;
let hasBody = false;

const queryParams = {};
if (pm.request.url && pm.request.url.query) {
    pm.request.url.query.each((q) => {
        if (!q.disabled && q.key) {
            let val = pm.variables.replaceIn(q.value || "");
            try {
                // Kong's ngx.req.get_uri_args() parses URL-decoded values.
                // Decode here to prevent hash mismatch with encoded strings like "%2B07%3A00".
                val = decodeURIComponent(val);
            } catch (e) {
                // If decoding fails, fall back to the original value
            }
            queryParams[q.key] = val;
        }
    });
}

if (pm.request.body && pm.request.body.mode === "raw" && pm.request.body.raw) {
    const rawBody = pm.variables.replaceIn(pm.request.body.raw).trim();
    if (rawBody.length > 0) {
        try {
            bodyObj = JSON.parse(rawBody);
            hasBody = true;
        } catch (error) {
            throw new Error("Body is not valid JSON: " + error.message);
        }
    }
} else if (pm.request.body && pm.request.body.mode === "urlencoded") {
    bodyObj = {};
    pm.request.body.urlencoded.each((it) => {
        if (!it.disabled && it.key) {
            bodyObj[it.key] = pm.variables.replaceIn(it.value || "");
        }
    });
    hasBody = Object.keys(bodyObj).length > 0;
}

// ✅ Force Postman to actually send the body on the wire
if (hasBody && bodyObj) {
    const bodyJson = JSON.stringify(bodyObj);
    pm.request.body.update({
        mode: "raw",
        raw: bodyJson,
        options: { raw: { language: "json" } }
    });
    console.log("body forced, length:", bodyJson.length);
}

if (method === "GET" || method === "HEAD" || !hasBody) {
    canonicalString = Object.keys(queryParams).length > 0
        ? convertJsonToFormattedString(queryParams)
        : "";
} else {
    canonicalString = convertJsonToFormattedString(bodyObj);
}

// ---------------------------------------------------------------------------
// Sign and set headers
// ---------------------------------------------------------------------------

const signature = buildHmac(canonicalString);

console.log("signSource:", (method === "GET" || method === "HEAD" || !hasBody) ? "query/empty" : "body");
console.log("canonicalString:", canonicalString);
console.log("signature:", signature);

pm.request.headers.remove("x-signature");
pm.request.headers.upsert({ key: "x-signature", value: signature });
pm.request.headers.upsert({
    key: "x-country-code",
    value: buildCountryCodeHeaderValue(countryCode),
});
```