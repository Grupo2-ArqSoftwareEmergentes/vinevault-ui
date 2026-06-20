export const API_CONFIG = {
  baseUrl: 'http://localhost:8000',
  endpoints: {
    organizations: '/api/v1/organizations',
    spaces: '/api/v1/spaces',
    devices: '/api/v1/devices',
  },
} as const;
