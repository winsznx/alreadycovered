export type ManifestEntry = {
  archivePath: string;
  sourceRelativePath: string;
  sha256: string;
  sizeBytes: number;
  citedForSubject: string;
  attributionText?: string;
};

export type Manifest = {
  productVersion: string;
  classLabel: string;
  localDate: string;
  packetRevision: number;
  exportedWithWarnings: boolean;
  createdAt: string;
  materials: ManifestEntry[];
  omitted: Array<{ subject: string; reason: string }>;
};
