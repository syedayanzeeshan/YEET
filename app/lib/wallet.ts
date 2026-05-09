import { createWalletClient, custom, getAddress } from "viem";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
};

export async function connectInjectedWallet(provider?: EthereumProvider) {
  if (!provider) {
    return "demo://operator";
  }

  const walletClient = createWalletClient({
    transport: custom(provider)
  });
  const [address] = await walletClient.requestAddresses();

  return address ? getAddress(address) : "";
}
