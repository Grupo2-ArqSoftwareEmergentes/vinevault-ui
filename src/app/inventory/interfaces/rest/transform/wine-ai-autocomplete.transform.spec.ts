import { wineAiSuggestions } from './wine-ai-autocomplete.transform';

describe('Safe AI wine suggestions', () => {
  it('maps the whitelist, normalizes alcohol, and keeps the window in the existing string field', () => {
    expect(wineAiSuggestions({ winery: ' Bodega ', vintage: 'NV', country: 'Perú', region: 'Ica', denomination: 'D.O.', grape_type: 'Malbec', format: '750 ml', aging: 'Roble', alcohol: ' 14.5 % ', drinking_window_start: 2026, drinking_window_end: 2032 })).toEqual({
      winery: 'Bodega', vintage: 'NV', country: 'Perú', region: 'Ica', appellation: 'D.O.', wineType: 'Malbec', bottleFormat: '750 ml', aging: 'Roble', alcoholPercentage: '14.5', consumptionWindow: '2026–2032',
    });
  });
  it('never invents a missing window bound', () => {
    expect(wineAiSuggestions({ drinking_window_start: 2026 })).toEqual({ consumptionWindow: '2026' });
    expect(wineAiSuggestions({ drinking_window_end: 2032 })).toEqual({ consumptionWindow: '2032' });
  });
  it('drops empty/null values and unknown tasting/stock keys', () => {
    const response = { winery: null, vintage: '', country: '  ', alcohol: ' % ', tasting_notes: 'Untrusted', quantity: 10, wouldBuyAgain: true };
    expect(wineAiSuggestions(response)).toEqual({});
    expect(wineAiSuggestions({})).toEqual({});
  });
});
