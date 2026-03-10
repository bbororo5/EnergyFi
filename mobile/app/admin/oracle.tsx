import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import {
  Address,
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  isAddress,
  isAddressEqual,
  keccak256,
  parseAbi,
  stringToHex,
  zeroHash,
} from 'viem';
import { Button } from '@/components/ui/button';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import {
  chargeRouterAddress,
  demoOperatorAddress,
  deviceRegistryAddress,
  energyfiChain,
  energyfiChainId,
  energyfiRpcUrl,
  reputationRegistryAddress,
  revenueTrackerAddress,
  stationRegistryAddress,
} from '@/constants/contracts';

const accessControlAbi = parseAbi([
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function grantRole(bytes32 role, address account)',
]);

const bridgeAdminAbi = parseAbi([
  'function bridgeAddress() view returns (address)',
  'function updateBridgeAddress(address newBridge)',
]);

const adminRole = keccak256(stringToHex('ADMIN_ROLE'));
const expectedAdminAddress = '0x47dd41EA66180816f53eFE0836E021818438E9eF' as Address;
const injectedRpcUrl = energyfiChain.rpcUrls.default.http[0] ?? energyfiRpcUrl;

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  providers?: EthereumProvider[];
};

type PermissionState = {
  deviceAdmin: boolean;
  stationAdmin: boolean;
  revenueAdmin: boolean;
  chargeRouterBridge: Address;
  reputationBridge: Address;
};

type LogTone = 'info' | 'success' | 'danger';
type LogEntry = { id: number; tone: LogTone; message: string };
type ProviderResolution = { provider: EthereumProvider | null; label: string };

function resolveInjectedProvider(): ProviderResolution {
  if (typeof window === 'undefined') {
    return { provider: null, label: 'Unavailable during SSR' };
  }

  const injectedWindow = window as unknown as {
    avalanche?: EthereumProvider;
    ethereum?: EthereumProvider;
  };

  if (injectedWindow.avalanche?.request) {
    return { provider: injectedWindow.avalanche, label: 'window.avalanche' };
  }

  const providerList = injectedWindow.ethereum?.providers;
  const firstInjected = providerList?.find((candidate) => typeof candidate?.request === 'function');
  if (firstInjected) {
    return { provider: firstInjected, label: 'window.ethereum.providers[]' };
  }

  if (injectedWindow.ethereum?.request) {
    return { provider: injectedWindow.ethereum, label: 'window.ethereum' };
  }

  return { provider: null, label: 'Not detected' };
}

function createReadClient() {
  return createPublicClient({
    chain: energyfiChain,
    transport: custom({
      async request({ method, params }) {
        const body = await fetch(injectedRpcUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params: params ?? [],
          }),
        });
        const payload = (await body.json()) as { result?: unknown; error?: { message?: string } };
        if (payload.error) {
          throw new Error(payload.error.message ?? 'RPC request failed');
        }
        return payload.result;
      },
    }),
  });
}

function shorten(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function chainHex(id: number) {
  return `0x${id.toString(16)}`;
}

export default function OracleAdminScreen() {
  const [provider, setProvider] = useState<EthereumProvider | null>(null);
  const [providerLabel, setProviderLabel] = useState('Not detected');
  const [walletAddress, setWalletAddress] = useState<Address | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [operatorAddress, setOperatorAddress] = useState(demoOperatorAddress);
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);
  const [balanceLabel, setBalanceLabel] = useState<string>('0');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const isWeb = Platform.OS === 'web';
  const hasProvider = provider !== null;
  const operatorIsValid = isAddress(operatorAddress);
  const walletMatchesAdmin = walletAddress ? isAddressEqual(walletAddress, expectedAdminAddress) : false;
  const chainMatches = walletChainId === energyfiChainId;

  const pushLog = (message: string, tone: LogTone = 'info') => {
    setLogs((current) => [{ id: Date.now() + current.length, message, tone }, ...current].slice(0, 12));
  };

  const syncInjectedProvider = useCallback(() => {
    if (!isWeb) {
      setProvider(null);
      setProviderLabel('Web-only');
      return null;
    }

    const next = resolveInjectedProvider();
    setProvider(next.provider);
    setProviderLabel(next.label);
    return next.provider;
  }, [isWeb]);

  const readPermissionState = useCallback(async (targetAddress: Address) => {
    const client = createReadClient();
    const [deviceAdmin, stationAdmin, revenueAdmin, routerBridge, repBridge, balance] = await Promise.all([
      client.readContract({
        address: deviceRegistryAddress,
        abi: accessControlAbi,
        functionName: 'hasRole',
        args: [adminRole, targetAddress],
      }),
      client.readContract({
        address: stationRegistryAddress,
        abi: accessControlAbi,
        functionName: 'hasRole',
        args: [adminRole, targetAddress],
      }),
      client.readContract({
        address: revenueTrackerAddress,
        abi: accessControlAbi,
        functionName: 'hasRole',
        args: [zeroHash, targetAddress],
      }),
      client.readContract({
        address: chargeRouterAddress,
        abi: bridgeAdminAbi,
        functionName: 'bridgeAddress',
      }),
      client.readContract({
        address: reputationRegistryAddress,
        abi: bridgeAdminAbi,
        functionName: 'bridgeAddress',
      }),
      client.getBalance({ address: targetAddress }),
    ]);

    setPermissionState({
      deviceAdmin,
      stationAdmin,
      revenueAdmin,
      chargeRouterBridge: routerBridge,
      reputationBridge: repBridge,
    });
    setBalanceLabel(formatEther(balance));
  }, []);

  const refreshWalletSession = useCallback(async (activeProvider?: EthereumProvider | null) => {
    const targetProvider = activeProvider ?? provider;
    if (!targetProvider) {
      return;
    }

    const [accounts, rawChainId] = await Promise.all([
      targetProvider.request({ method: 'eth_accounts' }) as Promise<string[]>,
      targetProvider.request({ method: 'eth_chainId' }) as Promise<string>,
    ]);

    const nextAddress = accounts[0] && isAddress(accounts[0]) ? (accounts[0] as Address) : null;
    const nextChainId = rawChainId ? Number.parseInt(rawChainId, 16) : null;
    setWalletAddress(nextAddress);
    setWalletChainId(nextChainId);
  }, [provider]);

  useEffect(() => {
    const nextProvider = syncInjectedProvider();
    if (nextProvider) {
      refreshWalletSession(nextProvider).catch((error: unknown) => {
        pushLog(String(error), 'danger');
      });
    }

    const handleAccountsChanged = (accounts: unknown) => {
      const next = Array.isArray(accounts) && typeof accounts[0] === 'string' && isAddress(accounts[0])
        ? (accounts[0] as Address)
        : null;
      setWalletAddress(next);
    };

    const handleChainChanged = (value: unknown) => {
      const rawValue = typeof value === 'string' ? value : null;
      setWalletChainId(rawValue ? Number.parseInt(rawValue, 16) : null);
    };

    nextProvider?.on?.('accountsChanged', handleAccountsChanged);
    nextProvider?.on?.('chainChanged', handleChainChanged);

    const retryId = window.setInterval(() => {
      const refreshedProvider = syncInjectedProvider();
      if (refreshedProvider) {
        refreshWalletSession(refreshedProvider).catch(() => null);
        window.clearInterval(retryId);
      }
    }, 1500);

    return () => {
      window.clearInterval(retryId);
      nextProvider?.removeListener?.('accountsChanged', handleAccountsChanged);
      nextProvider?.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [refreshWalletSession, syncInjectedProvider]);

  useEffect(() => {
    if (!operatorIsValid) {
      setPermissionState(null);
      setBalanceLabel('0');
      return;
    }

    readPermissionState(operatorAddress).catch((error: unknown) => {
      pushLog(`Status read failed: ${String(error)}`, 'danger');
    });
  }, [operatorAddress, operatorIsValid, readPermissionState]);

  const runAction = async (key: string, action: () => Promise<void>) => {
    try {
      setBusyKey(key);
      await action();
    } catch (error) {
      pushLog(String(error), 'danger');
    } finally {
      setBusyKey(null);
    }
  };

  const connectWallet = async () => runAction('connect', async () => {
    const activeProvider = provider ?? syncInjectedProvider();
    if (!activeProvider) {
      pushLog('Core extension provider not detected. Use Chrome with the Core extension unlocked, then refresh once.', 'danger');
      return;
    }

    await activeProvider.request({ method: 'eth_requestAccounts' });
    await refreshWalletSession(activeProvider);
    pushLog('Core wallet connected.', 'success');
  });

  const switchChain = async () => runAction('chain', async () => {
    const activeProvider = provider ?? syncInjectedProvider();
    if (!activeProvider) {
      throw new Error('Core extension wallet not found in this browser.');
    }

    try {
      await activeProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainHex(energyfiChainId) }],
      });
    } catch {
      await activeProvider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: chainHex(energyfiChainId),
          chainName: energyfiChain.name,
          nativeCurrency: energyfiChain.nativeCurrency,
          rpcUrls: [injectedRpcUrl],
        }],
      });
    }

    await refreshWalletSession(activeProvider);
    pushLog(`Wallet switched to chain ${energyfiChainId}.`, 'success');
  });

  const writeContract = async (
    contractAddress: Address,
    abi: typeof accessControlAbi | typeof bridgeAdminAbi,
    functionName: 'grantRole' | 'updateBridgeAddress',
    args: readonly unknown[],
    successMessage: string,
  ) => {
    if (!provider) {
      throw new Error('Core extension wallet not found in this browser.');
    }
    if (!walletAddress) {
      throw new Error('Connect the Core wallet first.');
    }

    const walletClient = createWalletClient({
      chain: energyfiChain,
      transport: custom(provider),
    });
    const hash = await walletClient.writeContract({
      account: walletAddress,
      address: contractAddress,
      abi,
      functionName,
      args: args as any,
    });

    pushLog(`${successMessage} submitted: ${hash}`, 'info');
    const client = createReadClient();
    await client.waitForTransactionReceipt({ hash });
    pushLog(successMessage, 'success');
    await readPermissionState(operatorAddress);
    await refreshWalletSession();
  };

  const grantDeviceAdmin = async () => runAction('device-admin', async () => {
    if (!operatorIsValid) {
      throw new Error('Operator address is invalid.');
    }
    await writeContract(
      deviceRegistryAddress,
      accessControlAbi,
      'grantRole',
      [adminRole, operatorAddress],
      `DeviceRegistry ADMIN_ROLE granted to ${shorten(operatorAddress)}`,
    );
  });

  const grantStationAdmin = async () => runAction('station-admin', async () => {
    if (!operatorIsValid) {
      throw new Error('Operator address is invalid.');
    }
    await writeContract(
      stationRegistryAddress,
      accessControlAbi,
      'grantRole',
      [adminRole, operatorAddress],
      `StationRegistry ADMIN_ROLE granted to ${shorten(operatorAddress)}`,
    );
  });

  const grantRevenueAdmin = async () => runAction('revenue-admin', async () => {
    if (!operatorIsValid) {
      throw new Error('Operator address is invalid.');
    }
    await writeContract(
      revenueTrackerAddress,
      accessControlAbi,
      'grantRole',
      [zeroHash, operatorAddress],
      `RevenueTracker DEFAULT_ADMIN_ROLE granted to ${shorten(operatorAddress)}`,
    );
  });

  const updateChargeRouterBridge = async () => runAction('router-bridge', async () => {
    if (!operatorIsValid) {
      throw new Error('Operator address is invalid.');
    }
    await writeContract(
      chargeRouterAddress,
      bridgeAdminAbi,
      'updateBridgeAddress',
      [operatorAddress],
      `ChargeRouter bridge updated to ${shorten(operatorAddress)}`,
    );
  });

  const updateReputationBridge = async () => runAction('reputation-bridge', async () => {
    if (!operatorIsValid) {
      throw new Error('Operator address is invalid.');
    }
    await writeContract(
      reputationRegistryAddress,
      bridgeAdminAbi,
      'updateBridgeAddress',
      [operatorAddress],
      `ReputationRegistry bridge updated to ${shorten(operatorAddress)}`,
    );
  });

  const applyAllMissing = async () => runAction('apply-all', async () => {
    if (!permissionState) {
      await readPermissionState(operatorAddress);
      return;
    }

    if (!permissionState.deviceAdmin) {
      await grantDeviceAdmin();
    }
    if (!permissionState.stationAdmin) {
      await grantStationAdmin();
    }
    if (!permissionState.revenueAdmin) {
      await grantRevenueAdmin();
    }
    if (!isAddressEqual(permissionState.chargeRouterBridge, operatorAddress)) {
      await updateChargeRouterBridge();
    }
    if (!isAddressEqual(permissionState.reputationBridge, operatorAddress)) {
      await updateReputationBridge();
    }

    pushLog('All missing admin changes have been applied.', 'success');
  });

  const refreshStatus = async () => runAction('refresh', async () => {
    const activeProvider = syncInjectedProvider();
    await refreshWalletSession(activeProvider);
    if (operatorIsValid) {
      await readPermissionState(operatorAddress);
    }
    pushLog('On-chain status refreshed.', 'success');
  });

  const needsChanges = permissionState
    ? !permissionState.deviceAdmin
      || !permissionState.stationAdmin
      || !permissionState.revenueAdmin
      || !isAddressEqual(permissionState.chargeRouterBridge, operatorAddress)
      || !isAddressEqual(permissionState.reputationBridge, operatorAddress)
    : false;

  if (!isWeb) {
    return (
      <View style={styles.blockedContainer}>
        <Text style={styles.blockedTitle}>Web-only admin screen</Text>
        <Text style={styles.blockedText}>
          Open this route in a desktop browser with the Core extension wallet installed.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Hackathon Admin</Text>
        <Text style={styles.title}>Oracle Bridge Console</Text>
        <Text style={styles.subtitle}>
          Connect the Core wallet that controls {shorten(expectedAdminAddress)} and point bridge/admin rights at the demo operator.
        </Text>
        <View style={styles.linkRow}>
          <Link href="/(tabs)" style={styles.linkText}>Back to app</Link>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Connection</Text>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Wallet provider</Text>
          <Text style={hasProvider ? styles.goodValue : styles.badValue}>
            {hasProvider ? providerLabel : `Missing (${providerLabel})`}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Connected wallet</Text>
          <Text style={walletMatchesAdmin ? styles.goodValue : styles.statValue}>
            {walletAddress ? shorten(walletAddress) : 'Not connected'}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Wallet chain</Text>
          <Text style={chainMatches ? styles.goodValue : styles.statValue}>
            {walletChainId ?? 'Unknown'}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Expected admin</Text>
          <Text style={styles.statValue}>{shorten(expectedAdminAddress)}</Text>
        </View>
        <View style={styles.buttonGrid}>
          <Button
            title={busyKey === 'connect' ? 'Connecting...' : 'Connect Core Wallet'}
            onPress={connectWallet}
            disabled={busyKey !== null}
            style={styles.buttonCell}
          />
          <Button
            title={busyKey === 'chain' ? 'Switching...' : 'Switch Chain'}
            onPress={switchChain}
            variant="secondary"
            disabled={!hasProvider || busyKey !== null}
            style={styles.buttonCell}
          />
          <Button
            title={busyKey === 'refresh' ? 'Refreshing...' : 'Refresh Status'}
            onPress={refreshStatus}
            variant="ghost"
            disabled={busyKey !== null || !operatorIsValid}
            style={styles.fullWidthButton}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Demo Operator</Text>
        <Text style={styles.inputLabel}>Target operator address</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          value={operatorAddress}
          onChangeText={(value) => setOperatorAddress(value as Address)}
          style={[styles.input, !operatorIsValid && styles.inputError]}
          placeholder="0x..."
          placeholderTextColor={colors.textTertiary}
        />
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Balance</Text>
          <Text style={styles.statValue}>{balanceLabel} EGF</Text>
        </View>
        <Text style={styles.helperText}>
          This should stay on the demo seeder wallet, currently {shorten(demoOperatorAddress)}.
        </Text>
        {!hasProvider ? (
          <Text style={[styles.helperText, styles.warningText]}>
            Core docs expose the extension via `window.avalanche`. If this still reads missing, open the page in Chrome with the Core extension unlocked and refresh once.
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>On-chain Permissions</Text>
        <StatusRow
          label="DeviceRegistry.ADMIN_ROLE"
          value={permissionState?.deviceAdmin ?? false}
        />
        <StatusRow
          label="StationRegistry.ADMIN_ROLE"
          value={permissionState?.stationAdmin ?? false}
        />
        <StatusRow
          label="RevenueTracker.DEFAULT_ADMIN_ROLE"
          value={permissionState?.revenueAdmin ?? false}
        />
        <AddressRow
          label="ChargeRouter.bridgeAddress"
          value={permissionState?.chargeRouterBridge}
          expected={operatorIsValid ? operatorAddress : null}
        />
        <AddressRow
          label="ReputationRegistry.bridgeAddress"
          value={permissionState?.reputationBridge}
          expected={operatorIsValid ? operatorAddress : null}
        />

        <View style={styles.buttonStack}>
          <Button
            title={busyKey === 'apply-all' ? 'Applying...' : needsChanges ? 'Apply Missing Changes' : 'All Changes Applied'}
            onPress={applyAllMissing}
            variant={needsChanges ? 'emerald' : 'secondary'}
            disabled={
              busyKey !== null
              || !walletAddress
              || !walletMatchesAdmin
              || !chainMatches
              || !operatorIsValid
            }
          />
          <Button
            title={busyKey === 'device-admin' ? 'Submitting...' : 'Grant Device Admin'}
            onPress={grantDeviceAdmin}
            variant="ghost"
            disabled={busyKey !== null || !walletAddress || !walletMatchesAdmin || !chainMatches || !operatorIsValid}
          />
          <Button
            title={busyKey === 'station-admin' ? 'Submitting...' : 'Grant Station Admin'}
            onPress={grantStationAdmin}
            variant="ghost"
            disabled={busyKey !== null || !walletAddress || !walletMatchesAdmin || !chainMatches || !operatorIsValid}
          />
          <Button
            title={busyKey === 'revenue-admin' ? 'Submitting...' : 'Grant Revenue Admin'}
            onPress={grantRevenueAdmin}
            variant="ghost"
            disabled={busyKey !== null || !walletAddress || !walletMatchesAdmin || !chainMatches || !operatorIsValid}
          />
          <Button
            title={busyKey === 'router-bridge' ? 'Submitting...' : 'Update ChargeRouter Bridge'}
            onPress={updateChargeRouterBridge}
            variant="ghost"
            disabled={busyKey !== null || !walletAddress || !walletMatchesAdmin || !chainMatches || !operatorIsValid}
          />
          <Button
            title={busyKey === 'reputation-bridge' ? 'Submitting...' : 'Update Reputation Bridge'}
            onPress={updateReputationBridge}
            variant="ghost"
            disabled={busyKey !== null || !walletAddress || !walletMatchesAdmin || !chainMatches || !operatorIsValid}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Execution Log</Text>
        {busyKey ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.helperText}>Waiting for wallet approval or transaction confirmation.</Text>
          </View>
        ) : null}
        {logs.length === 0 ? (
          <Text style={styles.helperText}>No transactions yet.</Text>
        ) : (
          logs.map((entry) => (
            <View key={entry.id} style={styles.logRow}>
              <View style={[styles.logDot, entry.tone === 'success' ? styles.dotSuccess : entry.tone === 'danger' ? styles.dotDanger : styles.dotInfo]} />
              <Text style={styles.logText}>{entry.message}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function StatusRow({ label, value }: { label: string; value: boolean }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={value ? styles.goodValue : styles.badValue}>{value ? 'Granted' : 'Missing'}</Text>
    </View>
  );
}

function AddressRow({ label, value, expected }: { label: string; value?: Address; expected: Address | null }) {
  const matches = value && expected ? isAddressEqual(value, expected) : false;

  return (
    <View style={styles.addressRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={matches ? styles.goodValue : styles.statValue}>
        {value ? shorten(value) : 'Unknown'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.backgroundDeep,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
    gap: spacing.lg,
  },
  hero: {
    padding: spacing.lg,
    borderRadius: radius['3xl'],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    ...shadows.lg,
  },
  eyebrow: {
    ...typography.micro,
    color: colors.accentLight,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  linkRow: {
    marginTop: spacing.md,
  },
  linkText: {
    ...typography.labelBold,
    color: colors.primaryLight,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius['2xl'],
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  addressRow: {
    gap: spacing.xs,
  },
  statLabel: {
    ...typography.label,
    color: colors.textSecondary,
    flex: 1,
  },
  statValue: {
    ...typography.labelBold,
    color: colors.textPrimary,
  },
  goodValue: {
    ...typography.labelBold,
    color: colors.emerald400,
  },
  badValue: {
    ...typography.labelBold,
    color: colors.rose500,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  buttonCell: {
    minWidth: '48%' as const,
    flexGrow: 1,
  },
  fullWidthButton: {
    width: '100%',
  },
  buttonStack: {
    gap: spacing.sm,
  },
  inputLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceMuted,
    ...typography.label,
  },
  inputError: {
    borderColor: colors.red500,
  },
  helperText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    marginTop: 6,
  },
  dotInfo: {
    backgroundColor: colors.primary,
  },
  dotSuccess: {
    backgroundColor: colors.emerald400,
  },
  dotDanger: {
    backgroundColor: colors.rose500,
  },
  logText: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
  },
  blockedContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  blockedTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  blockedText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  warningText: {
    color: colors.warning,
  },
});
