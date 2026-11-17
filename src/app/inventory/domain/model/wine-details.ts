/** Decimal values remain strings: never round prices or tasting scales through floats. */
export interface WineDetails {
  winery?: string | null;
  vintage?: string | null;
  physicalLocation?: string | null;
  country?: string | null;
  region?: string | null;
  appellation?: string | null;
  wineType?: string | null;
  bottleFormat?: string | null;
  aging?: string | null;
  alcoholPercentage?: string | null;
  consumptionWindow?: string | null;
  purchasePrice?: string | null;
  salePrice?: string | null;
  minStockAlert?: number | null;
  supplierName?: string | null;
  originType?: 'STORE' | 'GIFT' | 'TRIP' | 'SUPPLIER' | null;
  purchaseDate?: string | null;
  batchInvoiceNumber?: string | null;
  rating?: string | null;
  bodySlider?: string | null;
  aciditySlider?: string | null;
  tanninsSlider?: string | null;
  aromaTags?: readonly string[] | null;
  occasionNotes?: string | null;
  companyNotes?: string | null;
  wouldBuyAgain?: boolean | null;
  ageYears?: number | null;
}
