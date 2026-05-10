const crypto = require("crypto");

function createNodeIdentity() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  return {
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" })
  };
}

function receiptPayload(receipt) {
  return JSON.stringify({
    taskId: receipt.taskId,
    nodeId: receipt.nodeId,
    digest: receipt.digest,
    role: receipt.role,
    issuedAt: receipt.issuedAt
  });
}

function signReceipt(unsignedReceipt, privateKeyPem) {
  const signature = crypto.sign(null, Buffer.from(receiptPayload(unsignedReceipt)), privateKeyPem);
  return {
    ...unsignedReceipt,
    signature: signature.toString("base64")
  };
}

function verifyReceipt(receipt) {
  try {
    return crypto.verify(
      null,
      Buffer.from(receiptPayload(receipt)),
      receipt.publicKey,
      Buffer.from(receipt.signature, "base64")
    );
  } catch {
    return false;
  }
}

function digestFor(task, salt) {
  return crypto.createHash("sha256").update(`${task.id}:${task.name}:${task.type}:${task.difficulty}:${salt}`).digest("hex").slice(0, 18);
}

module.exports = {
  createNodeIdentity,
  digestFor,
  signReceipt,
  verifyReceipt
};
