export type VulnerabilityID = string;
export type PackageName = string;
export type Diff = string;
export type PatchMetadata = Map<VulnerabilityID, Set<PackageName>>;

export type PatchResponse = {
  id: string;
  comments: string[];
  modifictionTime: string;
  urls: string[];
  version: string;
};

export type VulnerabilityResponse = {
  id: VulnerabilityID;
  package: PackageName;
  patches: PatchResponse[];
};

export type TestResponse = {
  issues: {
    vulnerabilities: VulnerabilityResponse[];
  };
};

export type Patch = PatchResponse & {
  diffs: Diff[];
};

export type PackageAndVersion = {
  name: string;
  version: string;
};

export type InstalledPackage = PackageAndVersion & {
  path: string;
};
