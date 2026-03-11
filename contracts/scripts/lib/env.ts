export function nativeSymbol(): string {
  return "EGF";
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}

export function requirePrivateKey(name: string): string {
  const value = requireEnv(name);
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a 32-byte hex string prefixed with 0x.`);
  }
  return value;
}

export function requireAddress(ethers: any, name: string): string {
  const value = requireEnv(name);
  if (!ethers.isAddress(value)) {
    throw new Error(`Environment variable ${name} is not a valid address: ${value}`);
  }
  return value;
}
