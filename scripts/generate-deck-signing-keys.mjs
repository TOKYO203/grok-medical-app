import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const publicJwk = publicKey.export({ format: "jwk" });
const privateDer = privateKey.export({ format: "der", type: "pkcs8" });

console.log("Conservez la clé privée hors du dépôt GitHub.");
console.log(`DECK_SIGNING_PRIVATE_KEY=${privateDer.toString("base64")}`);
console.log(`VITE_DECK_SIGNING_PUBLIC_KEY=${publicJwk.x}`);
