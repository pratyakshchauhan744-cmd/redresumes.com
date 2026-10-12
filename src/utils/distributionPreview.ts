export type DistributionPreviewParams = {
  creditsPerStudent: number;
  program: string;
  course: string;
  section: string;
  batch: string;
};

export function getDistributionPreviewParams(data: DistributionPreviewParams): DistributionPreviewParams {
  return {
    creditsPerStudent: Number(data.creditsPerStudent),
    program: data.program,
    course: data.course,
    section: data.section,
    batch: data.batch,
  };
}

export function areDistributionPreviewParamsEqual(
  current: DistributionPreviewParams,
  previewed: DistributionPreviewParams
): boolean {
  return (
    current.creditsPerStudent === previewed.creditsPerStudent &&
    current.program === previewed.program &&
    current.course === previewed.course &&
    current.section === previewed.section &&
    current.batch === previewed.batch
  );
}

export function isDistributionPreviewValid(
  current: DistributionPreviewParams,
  previewed: DistributionPreviewParams | null,
  currentRevision: number,
  previewRevision: number | null
): boolean {
  return (
    previewed !== null &&
    previewRevision === currentRevision &&
    areDistributionPreviewParamsEqual(current, previewed)
  );
}
