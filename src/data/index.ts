/**
 * NMF taxonomy data types.
 * Runtime: import nmfTaxonomy from './nmf-taxonomy.json'
 * Types only here (no JSON import) for tsc clean with strict mode.
 */

export type TaxonomySource =
  | 'spotify'
  | 'spotify_partial'
  | 'spotify_fuzzy'
  | 'spotify_no_handle'
  | 'manual'
  | 'resolved_names';

export interface TaxonomyEntry {
  canonical_name: string;
  source: TaxonomySource;
  aliases: string[];
}

export interface NmfTaxonomy {
  version: string;
  generated: string;
  artists: Record<string, TaxonomyEntry>;
  venues?: Record<string, TaxonomyEntry>;
  showcases?: Record<string, TaxonomyEntry>;
  songs?: Record<string, TaxonomyEntry>;
}
