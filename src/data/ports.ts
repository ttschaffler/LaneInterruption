import type { GeoPoint } from '@/types';

/** A small reference set of ports/hubs used to build lanes. */
export const PORTS: Record<string, GeoPoint> = {
  CNSHA: { code: 'CNSHA', name: 'Shanghai', country: 'CN', lat: 31.23, lon: 121.47 },
  CNNGB: { code: 'CNNGB', name: 'Ningbo', country: 'CN', lat: 29.87, lon: 121.55 },
  CNYTN: { code: 'CNYTN', name: 'Yantian', country: 'CN', lat: 22.56, lon: 114.27 },
  VNSGN: { code: 'VNSGN', name: 'Ho Chi Minh City', country: 'VN', lat: 10.82, lon: 106.63 },
  BDCGP: { code: 'BDCGP', name: 'Chittagong', country: 'BD', lat: 22.33, lon: 91.83 },
  LKCMB: { code: 'LKCMB', name: 'Colombo', country: 'LK', lat: 6.93, lon: 79.85 },
  SGSIN: { code: 'SGSIN', name: 'Singapore', country: 'SG', lat: 1.29, lon: 103.85 },
  EGSUZ: { code: 'EGSUZ', name: 'Suez Canal', country: 'EG', lat: 30.5, lon: 32.35 },
  NLRTM: { code: 'NLRTM', name: 'Rotterdam', country: 'NL', lat: 51.95, lon: 4.14 },
  DEHAM: { code: 'DEHAM', name: 'Hamburg', country: 'DE', lat: 53.55, lon: 9.99 },
  USLAX: { code: 'USLAX', name: 'Los Angeles', country: 'US', lat: 33.74, lon: -118.27 },
  USNYC: { code: 'USNYC', name: 'New York', country: 'US', lat: 40.69, lon: -74.04 },
  FRADFRA: { code: 'DEFRA', name: 'Frankfurt Air', country: 'DE', lat: 50.04, lon: 8.56 },
  HKHKG: { code: 'HKHKG', name: 'Hong Kong Air', country: 'HK', lat: 22.31, lon: 113.91 },
};
