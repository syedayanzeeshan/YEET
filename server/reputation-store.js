const fs = require("fs");
const path = require("path");

const storePath = path.join(process.cwd(), "data", "reputation.json");

function readReputation() {
  try {
    return JSON.parse(fs.readFileSync(storePath, "utf8"));
  } catch {
    return {};
  }
}

function writeReputation(reputation) {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(reputation, null, 2));
}

function ensureReputation(reputation, nodeId) {
  if (!reputation[nodeId]) {
    reputation[nodeId] = {
      nodeId,
      reputationScore: 72,
      slashCount: 0,
      successfulValidations: 0,
      challengeWins: 0,
      maliciousFlags: 0,
      lastSeen: Date.now()
    };
  }
  return reputation[nodeId];
}

function applyReceipt(reputation, receipt) {
  const entry = ensureReputation(reputation, receipt.nodeId);
  entry.lastSeen = Date.now();
  if (receipt.verified) {
    entry.reputationScore = Math.min(100, entry.reputationScore + 1);
    if (receipt.role === "validator") entry.successfulValidations += 1;
    if (receipt.role === "challenger") entry.challengeWins += 1;
  } else {
    entry.reputationScore = Math.max(0, entry.reputationScore - 8);
    entry.maliciousFlags += 1;
  }
  return entry;
}

function applySlash(reputation, nodeId) {
  const entry = ensureReputation(reputation, nodeId);
  entry.slashCount += 1;
  entry.maliciousFlags += 1;
  entry.reputationScore = Math.max(0, entry.reputationScore - 18);
  entry.lastSeen = Date.now();
  return entry;
}

module.exports = {
  applyReceipt,
  applySlash,
  ensureReputation,
  readReputation,
  writeReputation
};
