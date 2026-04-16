import TagBlocks from './TagBlocks';
import CaptionGenerator from './CaptionGenerator';
import type { SelectionSlot } from '../lib/selection';

interface ShareCaptionSectionProps {
  allPreviewsReady: boolean;
  slideGroups: SelectionSlot[][];
  onHandlesResolved: (handles: Map<string, any>) => void;
  selections: SelectionSlot[];
  resolvedHandles: Map<string, any>;
  weekDate: string;
}

export default function ShareCaptionSection({
  allPreviewsReady, slideGroups, onHandlesResolved,
  selections, resolvedHandles, weekDate,
}: ShareCaptionSectionProps) {
  if (allPreviewsReady) {
    return (
      <div style={{ marginTop: 24, borderTop: '1px solid var(--midnight-border)', paddingTop: 16 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', marginBottom: 12 }}>
          ③ Share
        </h3>
        <TagBlocks slideGroups={slideGroups} onHandlesResolved={onHandlesResolved} />
        <CaptionGenerator selections={selections} handles={resolvedHandles} weekDate={weekDate} showShare />
      </div>
    );
  }

  return (
    <details style={{ marginTop: 24, borderTop: '1px solid var(--midnight-border)', paddingTop: 16 }}>
      <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 'var(--fs-lg)', fontWeight: 600 }}>
        Instagram Tags
      </summary>
      <TagBlocks slideGroups={slideGroups} onHandlesResolved={onHandlesResolved} />
      <CaptionGenerator selections={selections} handles={resolvedHandles} weekDate={weekDate} />
    </details>
  );
}
