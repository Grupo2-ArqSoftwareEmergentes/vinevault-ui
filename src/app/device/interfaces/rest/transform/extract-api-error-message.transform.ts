export const extractApiErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'error' in error) {
    const responseBody = (error as { error?: unknown }).error;
    if (responseBody && typeof responseBody === 'object' && 'message' in responseBody) {
      const message = (responseBody as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim().length > 0) return message;
    }
    if (responseBody && typeof responseBody === 'object' && 'detail' in responseBody) {
       const detail = (responseBody as { detail?: unknown }).detail;
       if (detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string' && detail.message.trim()) return detail.message;
      if (typeof detail === 'string' && detail.trim()) return detail;
      if (Array.isArray(detail)) {
        const messages = detail.map((item) => typeof item?.msg === 'string' ? item.msg : '').filter(Boolean);
        if (messages.length) return messages.join('. ');
      }
    }
  }
  return fallback;
};

