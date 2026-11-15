export const extractApiErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'error' in error) {
    const responseBody = (error as { error?: unknown }).error;
    if (responseBody && typeof responseBody === 'object' && 'message' in responseBody) {
      const message = (responseBody as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim().length > 0) return message;
    }
    if (responseBody && typeof responseBody === 'object' && 'detail' in responseBody) {
      const detail = (responseBody as { detail?: unknown }).detail;
      if (typeof detail === 'string' && detail.trim()) return detail;
    }
  }
  return fallback;
};

