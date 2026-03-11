/* eslint-disable */
// AUTO-GENERATED from contracts/artifacts/contracts/interfaces/ops/IReputationRegistry.sol/IReputationRegistry.json
// Do not edit manually. Run `npm run sync:contracts` in mobile after contract ABI changes.

export const reputationRegistryAbi = [
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "regionId",
        "type": "bytes4"
      },
      {
        "internalType": "enum IReputationRegistry.PeriodGranularity",
        "name": "granularity",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "periodId",
        "type": "uint256"
      }
    ],
    "name": "InvalidSnapshotKey",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "regionId",
        "type": "bytes4"
      },
      {
        "internalType": "enum IReputationRegistry.PeriodGranularity",
        "name": "granularity",
        "type": "uint8"
      }
    ],
    "name": "LatestRegionSnapshotNotFound",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "regionId",
        "type": "bytes4"
      },
      {
        "internalType": "enum IReputationRegistry.PeriodGranularity",
        "name": "granularity",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "periodId",
        "type": "uint256"
      }
    ],
    "name": "RegionSnapshotNotFound",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes4",
        "name": "regionId",
        "type": "bytes4"
      },
      {
        "indexed": true,
        "internalType": "enum IReputationRegistry.PeriodGranularity",
        "name": "granularity",
        "type": "uint8"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "periodId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint32",
        "name": "metricVersion",
        "type": "uint32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "sourceHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "updatedAt",
        "type": "uint256"
      }
    ],
    "name": "RegionSnapshotUpserted",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "regionId",
        "type": "bytes4"
      },
      {
        "internalType": "enum IReputationRegistry.PeriodGranularity",
        "name": "granularity",
        "type": "uint8"
      }
    ],
    "name": "getLatestRegionSnapshot",
    "outputs": [
      {
        "components": [
          {
            "internalType": "bytes4",
            "name": "regionId",
            "type": "bytes4"
          },
          {
            "internalType": "enum IReputationRegistry.PeriodGranularity",
            "name": "granularity",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "periodId",
            "type": "uint256"
          },
          {
            "internalType": "uint32",
            "name": "metricVersion",
            "type": "uint32"
          },
          {
            "internalType": "bytes32",
            "name": "sourceHash",
            "type": "bytes32"
          },
          {
            "components": [
              {
                "internalType": "uint16",
                "name": "activeChargerRatioBps",
                "type": "uint16"
              },
              {
                "internalType": "uint16",
                "name": "maintenanceResolutionRateBps",
                "type": "uint16"
              },
              {
                "internalType": "uint16",
                "name": "settlementContinuityBps",
                "type": "uint16"
              }
            ],
            "internalType": "struct IReputationRegistry.TrustMetrics",
            "name": "trust",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "sessionVolume",
                "type": "uint256"
              },
              {
                "internalType": "uint16",
                "name": "revenueStabilityBps",
                "type": "uint16"
              },
              {
                "internalType": "uint8",
                "name": "peakStartHour",
                "type": "uint8"
              },
              {
                "internalType": "uint8",
                "name": "peakEndHour",
                "type": "uint8"
              }
            ],
            "internalType": "struct IReputationRegistry.RhythmMetrics",
            "name": "rhythm",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "enum IReputationRegistry.SiteType",
                "name": "primaryType",
                "type": "uint8"
              },
              {
                "internalType": "uint16",
                "name": "residentialBps",
                "type": "uint16"
              },
              {
                "internalType": "uint16",
                "name": "workplaceBps",
                "type": "uint16"
              },
              {
                "internalType": "uint16",
                "name": "publicCommercialBps",
                "type": "uint16"
              },
              {
                "internalType": "uint16",
                "name": "mixedBps",
                "type": "uint16"
              }
            ],
            "internalType": "struct IReputationRegistry.SiteMetrics",
            "name": "site",
            "type": "tuple"
          },
          {
            "internalType": "uint256",
            "name": "updatedAt",
            "type": "uint256"
          }
        ],
        "internalType": "struct IReputationRegistry.RegionSnapshot",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "regionId",
        "type": "bytes4"
      },
      {
        "internalType": "enum IReputationRegistry.PeriodGranularity",
        "name": "granularity",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "periodId",
        "type": "uint256"
      }
    ],
    "name": "getRegionSnapshot",
    "outputs": [
      {
        "components": [
          {
            "internalType": "bytes4",
            "name": "regionId",
            "type": "bytes4"
          },
          {
            "internalType": "enum IReputationRegistry.PeriodGranularity",
            "name": "granularity",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "periodId",
            "type": "uint256"
          },
          {
            "internalType": "uint32",
            "name": "metricVersion",
            "type": "uint32"
          },
          {
            "internalType": "bytes32",
            "name": "sourceHash",
            "type": "bytes32"
          },
          {
            "components": [
              {
                "internalType": "uint16",
                "name": "activeChargerRatioBps",
                "type": "uint16"
              },
              {
                "internalType": "uint16",
                "name": "maintenanceResolutionRateBps",
                "type": "uint16"
              },
              {
                "internalType": "uint16",
                "name": "settlementContinuityBps",
                "type": "uint16"
              }
            ],
            "internalType": "struct IReputationRegistry.TrustMetrics",
            "name": "trust",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "sessionVolume",
                "type": "uint256"
              },
              {
                "internalType": "uint16",
                "name": "revenueStabilityBps",
                "type": "uint16"
              },
              {
                "internalType": "uint8",
                "name": "peakStartHour",
                "type": "uint8"
              },
              {
                "internalType": "uint8",
                "name": "peakEndHour",
                "type": "uint8"
              }
            ],
            "internalType": "struct IReputationRegistry.RhythmMetrics",
            "name": "rhythm",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "enum IReputationRegistry.SiteType",
                "name": "primaryType",
                "type": "uint8"
              },
              {
                "internalType": "uint16",
                "name": "residentialBps",
                "type": "uint16"
              },
              {
                "internalType": "uint16",
                "name": "workplaceBps",
                "type": "uint16"
              },
              {
                "internalType": "uint16",
                "name": "publicCommercialBps",
                "type": "uint16"
              },
              {
                "internalType": "uint16",
                "name": "mixedBps",
                "type": "uint16"
              }
            ],
            "internalType": "struct IReputationRegistry.SiteMetrics",
            "name": "site",
            "type": "tuple"
          },
          {
            "internalType": "uint256",
            "name": "updatedAt",
            "type": "uint256"
          }
        ],
        "internalType": "struct IReputationRegistry.RegionSnapshot",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "regionId",
        "type": "bytes4"
      },
      {
        "internalType": "enum IReputationRegistry.PeriodGranularity",
        "name": "granularity",
        "type": "uint8"
      }
    ],
    "name": "getRegionSnapshotPeriods",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "regionId",
        "type": "bytes4"
      },
      {
        "internalType": "enum IReputationRegistry.PeriodGranularity",
        "name": "granularity",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "periodId",
        "type": "uint256"
      }
    ],
    "name": "hasRegionSnapshot",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "bytes4",
            "name": "regionId",
            "type": "bytes4"
          },
          {
            "internalType": "enum IReputationRegistry.PeriodGranularity",
            "name": "granularity",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "periodId",
            "type": "uint256"
          },
          {
            "internalType": "uint32",
            "name": "metricVersion",
            "type": "uint32"
          },
          {
            "internalType": "bytes32",
            "name": "sourceHash",
            "type": "bytes32"
          },
          {
            "components": [
              {
                "internalType": "uint16",
                "name": "activeChargerRatioBps",
                "type": "uint16"
              },
              {
                "internalType": "uint16",
                "name": "maintenanceResolutionRateBps",
                "type": "uint16"
              },
              {
                "internalType": "uint16",
                "name": "settlementContinuityBps",
                "type": "uint16"
              }
            ],
            "internalType": "struct IReputationRegistry.TrustMetrics",
            "name": "trust",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "sessionVolume",
                "type": "uint256"
              },
              {
                "internalType": "uint16",
                "name": "revenueStabilityBps",
                "type": "uint16"
              },
              {
                "internalType": "uint8",
                "name": "peakStartHour",
                "type": "uint8"
              },
              {
                "internalType": "uint8",
                "name": "peakEndHour",
                "type": "uint8"
              }
            ],
            "internalType": "struct IReputationRegistry.RhythmMetrics",
            "name": "rhythm",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "enum IReputationRegistry.SiteType",
                "name": "primaryType",
                "type": "uint8"
              },
              {
                "internalType": "uint16",
                "name": "residentialBps",
                "type": "uint16"
              },
              {
                "internalType": "uint16",
                "name": "workplaceBps",
                "type": "uint16"
              },
              {
                "internalType": "uint16",
                "name": "publicCommercialBps",
                "type": "uint16"
              },
              {
                "internalType": "uint16",
                "name": "mixedBps",
                "type": "uint16"
              }
            ],
            "internalType": "struct IReputationRegistry.SiteMetrics",
            "name": "site",
            "type": "tuple"
          }
        ],
        "internalType": "struct IReputationRegistry.RegionSnapshotInput",
        "name": "snapshot",
        "type": "tuple"
      }
    ],
    "name": "upsertRegionSnapshot",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "bytes4",
            "name": "regionId",
            "type": "bytes4"
          },
          {
            "internalType": "enum IReputationRegistry.PeriodGranularity",
            "name": "granularity",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "periodId",
            "type": "uint256"
          },
          {
            "internalType": "uint32",
            "name": "metricVersion",
            "type": "uint32"
          },
          {
            "internalType": "bytes32",
            "name": "sourceHash",
            "type": "bytes32"
          },
          {
            "components": [
              {
                "internalType": "uint16",
                "name": "activeChargerRatioBps",
                "type": "uint16"
              },
              {
                "internalType": "uint16",
                "name": "maintenanceResolutionRateBps",
                "type": "uint16"
              },
              {
                "internalType": "uint16",
                "name": "settlementContinuityBps",
                "type": "uint16"
              }
            ],
            "internalType": "struct IReputationRegistry.TrustMetrics",
            "name": "trust",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "sessionVolume",
                "type": "uint256"
              },
              {
                "internalType": "uint16",
                "name": "revenueStabilityBps",
                "type": "uint16"
              },
              {
                "internalType": "uint8",
                "name": "peakStartHour",
                "type": "uint8"
              },
              {
                "internalType": "uint8",
                "name": "peakEndHour",
                "type": "uint8"
              }
            ],
            "internalType": "struct IReputationRegistry.RhythmMetrics",
            "name": "rhythm",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "enum IReputationRegistry.SiteType",
                "name": "primaryType",
                "type": "uint8"
              },
              {
                "internalType": "uint16",
                "name": "residentialBps",
                "type": "uint16"
              },
              {
                "internalType": "uint16",
                "name": "workplaceBps",
                "type": "uint16"
              },
              {
                "internalType": "uint16",
                "name": "publicCommercialBps",
                "type": "uint16"
              },
              {
                "internalType": "uint16",
                "name": "mixedBps",
                "type": "uint16"
              }
            ],
            "internalType": "struct IReputationRegistry.SiteMetrics",
            "name": "site",
            "type": "tuple"
          }
        ],
        "internalType": "struct IReputationRegistry.RegionSnapshotInput[]",
        "name": "snapshots",
        "type": "tuple[]"
      }
    ],
    "name": "upsertRegionSnapshots",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
