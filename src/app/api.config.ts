import { environment } from '../environments/environment';

export const API_CONFIG = {
  baseUrl: environment.apiBaseUrl,
  endpoints: {
    organizations: '/api/v1/organizations',
    spaces: '/api/v1/spaces',
    devices: '/api/v1/devices',
    wineCellars: '/api/v1/wine-cellars',
  },
} as const;
