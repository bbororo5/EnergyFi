import type { EssentialDeploymentAddresses } from "./deployments.js";

export interface DeployedUpgradeableContract {
  contract: any;
  implementationAddress: string;
  proxyAddress: string;
}

export interface EssentialDeployResult {
  addresses: EssentialDeploymentAddresses;
  contracts: {
    deviceRegistry: any;
    stationRegistry: any;
    chargeTransaction: any;
    revenueTracker: any;
    chargeRouter: any;
  };
}

interface EssentialDeployConfig {
  adminAddress: string;
  chargeRouterBridgeAddress: string;
  log: (message: string) => void;
}

export async function deployPlainContract(
  ethers: any,
  contractName: string,
): Promise<{ contract: any; address: string }> {
  const Factory = await ethers.getContractFactory(contractName);
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  return {
    contract,
    address: await contract.getAddress(),
  };
}

export async function deployUpgradeableContract(
  ethers: any,
  contractName: string,
): Promise<DeployedUpgradeableContract> {
  const { address: implementationAddress } = await deployPlainContract(ethers, contractName);
  const Proxy = await ethers.getContractFactory("EnergyFiProxy");
  const proxy = await Proxy.deploy(implementationAddress, "0x");
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();

  return {
    contract: await ethers.getContractAt(contractName, proxyAddress),
    implementationAddress,
    proxyAddress,
  };
}

export async function deployEssentialSurface(
  ethers: any,
  config: EssentialDeployConfig,
): Promise<EssentialDeployResult> {
  config.log("─── Essential surface ───");

  const deviceRegistry = await deployUpgradeableContract(ethers, "DeviceRegistry");
  await (await deviceRegistry.contract.initialize(config.adminAddress)).wait();
  config.log(`DeviceRegistry     : ${deviceRegistry.proxyAddress}`);

  const stationRegistry = await deployUpgradeableContract(ethers, "StationRegistry");
  await (await stationRegistry.contract.initialize(config.adminAddress, deviceRegistry.proxyAddress)).wait();
  config.log(`StationRegistry    : ${stationRegistry.proxyAddress}`);

  const chargeTransaction = await deployUpgradeableContract(ethers, "ChargeTransaction");
  config.log(`ChargeTransaction  : ${chargeTransaction.proxyAddress}`);

  const revenueTracker = await deployUpgradeableContract(ethers, "RevenueTracker");
  config.log(`RevenueTracker     : ${revenueTracker.proxyAddress}`);

  const chargeRouter = await deployUpgradeableContract(ethers, "ChargeRouter");
  config.log(`ChargeRouter       : ${chargeRouter.proxyAddress}`);

  await (
    await chargeTransaction.contract.initialize(
      deviceRegistry.proxyAddress,
      stationRegistry.proxyAddress,
      chargeRouter.proxyAddress,
      config.adminAddress,
    )
  ).wait();

  await (
    await revenueTracker.contract.initialize(
      stationRegistry.proxyAddress,
      chargeRouter.proxyAddress,
      config.adminAddress,
    )
  ).wait();

  await (
    await chargeRouter.contract.initialize(
      chargeTransaction.proxyAddress,
      revenueTracker.proxyAddress,
      config.chargeRouterBridgeAddress,
      config.adminAddress,
    )
  ).wait();

  return {
    addresses: {
      DeviceRegistry: deviceRegistry.proxyAddress,
      StationRegistry: stationRegistry.proxyAddress,
      ChargeTransaction: chargeTransaction.proxyAddress,
      RevenueTracker: revenueTracker.proxyAddress,
      ChargeRouter: chargeRouter.proxyAddress,
    },
    contracts: {
      deviceRegistry: deviceRegistry.contract,
      stationRegistry: stationRegistry.contract,
      chargeTransaction: chargeTransaction.contract,
      revenueTracker: revenueTracker.contract,
      chargeRouter: chargeRouter.contract,
    },
  };
}
