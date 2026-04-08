/** Pluralize a word based on count: "1 track" vs "2 tracks" */
export function p(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural || singular + 's')}`;
}
