import fs from "node:fs";
import path from "node:path";
import openapiTS from "openapi-typescript";

const openapiUrl =
  process.env.OPENAPI_URL || "http://127.0.0.1:8765/openapi.json";
const outputPath = path.join("src", "lib", "api-types.ts");

const schema = await openapiTS(openapiUrl);
fs.writeFileSync(outputPath, schema);
console.log(`OpenAPI types written to ${outputPath}`);
