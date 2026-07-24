const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const homeDir = os.homedir();
const ANDROID_HOME = path.join(homeDir, "Android");
const JAVA_HOME = "C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.19.10-hotspot";

const env = {
  ...process.env,
  JAVA_HOME,
  ANDROID_HOME,
};

const bpCli = path.join(
  homeDir,
  "AppData/Roaming/npm/node_modules/@bubblewrap/cli/bin/bubblewrap.js"
);

const projectDir = path.join(homeDir, "dpr-twa");

console.log("=== Bubblewrap TWA Builder ===");
console.log("Android SDK:", ANDROID_HOME);
console.log("Java:", JAVA_HOME);
console.log("Project dir:", projectDir);

// Step 1: Initialize the TWA project
console.log("\n--- Step 1: Initializing TWA project ---");
try {
  const initCmd = `node "${bpCli}" init --manifest https://www.factorynerve.online/manifest.json --packageName com.factorynerve.app --host www.factorynerve.online`;
  console.log("Running:", initCmd);
  const result = execSync(initCmd, { env, cwd: projectDir, timeout: 180000, stdio: "pipe" });
  console.log("STDOUT:", result.stdout.toString());
  if (result.stderr) console.log("STDERR:", result.stderr.toString());
  console.log("Init successful!");
} catch (e) {
  console.log("Init error:", e.message);
  if (e.stdout) console.log("STDOUT:", e.stdout.toString());
  if (e.stderr) console.log("STDERR:", e.stderr.toString());
  process.exit(1);
}

// Step 2: Build the APK
console.log("\n--- Step 2: Building APK ---");
try {
  // First generate a signing key
  const keytoolCmd = `"${JAVA_HOME}\\bin\\keytool" -genkey -v -keystore "${projectDir}\\android.keystore" -alias dpr-key -keyalg RSA -keysize 2048 -validity 10000 -storepass password123 -keypass password123 -dname "CN=DPR.ai, OU=Dev, O=FactoryNerve, L=City, S=State, C=IN"`;
  console.log("Running keytool...");
  execSync(keytoolCmd, { env, cwd: projectDir, timeout: 30000, stdio: "pipe" });
  console.log("Keystore created!");

  // Build the APK
  const buildCmd = `node "${bpCli}" build --keystore-path "${projectDir}\\android.keystore" --keystore-pass password123 --keystore-key-alias dpr-key --key-pass password123`;
  console.log("Running:", buildCmd);
  const buildResult = execSync(buildCmd, { env, cwd: projectDir, timeout: 300000, stdio: "pipe" });
  console.log("STDOUT:", buildResult.stdout.toString());
  if (buildResult.stderr) console.log("STDERR:", buildResult.stderr.toString());
  console.log("Build successful!");
} catch (e) {
  console.log("Build error:", e.message);
  if (e.stdout) console.log("STDOUT:", e.stdout.toString());
  if (e.stderr) console.log("STDERR:", e.stderr.toString());
}

console.log("\n=== Done ===");
