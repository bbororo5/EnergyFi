export interface RegionCatalogEntry {
  code: string;
  regionId: `0x${string}`;
  name: string;
  fullName: string;
}

export const regionCatalog: RegionCatalogEntry[] = [
  {
    code: 'KR11',
    regionId: '0x4b523131',
    name: 'Seoul',
    fullName: 'Seoul Metropolitan City',
  },
  {
    code: 'KR26',
    regionId: '0x4b523236',
    name: 'Busan',
    fullName: 'Busan Metropolitan City',
  },
  {
    code: 'KR27',
    regionId: '0x4b523237',
    name: 'Daegu',
    fullName: 'Daegu Metropolitan City',
  },
  {
    code: 'KR28',
    regionId: '0x4b523238',
    name: 'Incheon',
    fullName: 'Incheon Metropolitan City',
  },
  {
    code: 'KR29',
    regionId: '0x4b523239',
    name: 'Gwangju',
    fullName: 'Gwangju Metropolitan City',
  },
  {
    code: 'KR41',
    regionId: '0x4b523431',
    name: 'Gyeonggi',
    fullName: 'Gyeonggi-do',
  },
  {
    code: 'KR49',
    regionId: '0x4b523439',
    name: 'Jeju',
    fullName: 'Jeju Special Self-Governing Province',
  },
];
