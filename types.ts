
export interface CropState {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
}

export interface ExportResult {
  blob: Blob;
  state: CropState;
  source: HTMLImageElement | HTMLVideoElement;
  isVideo: boolean;
  bgRemoved?: boolean;
}
