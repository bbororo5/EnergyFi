import { useState, useEffect } from 'react';

export interface PortfolioSTO {
    id: string;
    name: string;
    chargers: number;
    tokensMinted: string;
    apy: number;
    featured: boolean;
}

// In Phase 3, this will be fetched via:
// 1. IRegionSTOFactory.getAllRegionIds()
// 2. IRegionSTOFactory.getRegionToken(regionId)
// 3. IRegionSTO(token).totalSupply()
// 4. IStationRegistry.getStationsByRegion(regionId)
//
// For now, since Phase 3 contracts are not yet deployed to the local anvil network,
// we mock the data structure exactly as it would be returned from the blockchain reads.

const MOCK_ONCHAIN_STOS: PortfolioSTO[] = [
    {
        id: 'KR11', // Seoul
        name: 'Seoul Metropolitan',
        chargers: 284,
        tokensMinted: '1.2M', // formatEther(totalSupply)
        apy: 12.4, // Calculated from IRevenueTracker past data vs Token Supply
        featured: true,
    },
    {
        id: 'KR26', // Busan
        name: 'Busan Metropolitan',
        chargers: 156,
        tokensMinted: '850K',
        apy: 14.1,
        featured: false,
    },
    {
        id: 'KR49', // Jeju
        name: 'Jeju Special Province',
        chargers: 92,
        tokensMinted: '420K',
        apy: 18.2, // High yield test
        featured: true,
    },
];

export function usePortfolioSTOs() {
    const [stos, setStos] = useState<PortfolioSTO[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const fetchSTOs = async () => {
            setIsLoading(true);
            try {
                // TODO: Replace with actual viem calls when `RegionSTOFactory` is deployed
                // await client.readContract({ address: FACTORY_ADDRESS, abi: FACTORY_ABI, functionName: 'getAllRegionIds' });

                // Simulating network delay
                await new Promise(resolve => setTimeout(resolve, 500));

                if (mounted) {
                    setStos(MOCK_ONCHAIN_STOS);
                }
            } catch (err) {
                console.warn("Failed to fetch STOs", err);
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchSTOs();

        return () => {
            mounted = false;
        };
    }, []);

    return { stos, isLoading };
}
