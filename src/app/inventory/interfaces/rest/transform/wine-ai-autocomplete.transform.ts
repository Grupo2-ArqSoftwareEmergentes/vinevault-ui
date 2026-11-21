import { WineDetails } from '../../../domain/model/wine-details';
import { WineAiAutocompleteResponse } from '../resources/wine-ai-autocomplete.resource';

/** Explicit whitelist: AI suggestions can never touch stock, prices or tasting controls. */
export function wineAiSuggestions(response: WineAiAutocompleteResponse): Partial<WineDetails> {
  const result: Partial<WineDetails> = {};
  const fields = {
    winery: 'winery', vintage: 'vintage', country: 'country', region: 'region',
    appellation: 'denomination', wineType: 'grape_type', bottleFormat: 'format', aging: 'aging',
    alcoholPercentage: 'alcohol',
  } as const;
  for (const [key, apiKey] of Object.entries(fields) as [keyof typeof fields, typeof fields[keyof typeof fields]][]) {
    const raw = response?.[apiKey];
    if (typeof raw !== 'string') continue;
    const value = key === 'alcoholPercentage' ? raw.replace(/[%\s]/g, '') : raw.trim();
    if (value) result[key] = value;
  }
  const bounds = [response?.drinking_window_start, response?.drinking_window_end]
    .filter((value): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0);
  if (bounds.length) result.consumptionWindow = bounds.join('–');
  return result;
}
