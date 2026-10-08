import type { ProjectData } from '@shared/domain/types';
import { dateStamp, downloadBlob, fileSlug } from './download';

/** Downloads a project document as a formatted JSON file. */
export function downloadProjectJson(project: ProjectData, suffix = ''): void {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, `${fileSlug(project.name)}-${dateStamp()}${suffix}.json`);
}
