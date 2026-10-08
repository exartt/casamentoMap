import type Konva from 'konva';
import { EXPORT_PIXEL_RATIO, NO_GROUP_COLOR, PX_PER_M } from '@shared/config/defaults';
import type { ProjectData } from '@shared/domain/types';
import { COLORS } from '../components/canvas/canvasUtils';
import { getRegisteredStage } from '../components/canvas/stageRegistry';
import { t } from '../i18n/strings';
import { formatDateTime } from '../i18n/format';
import { getDerived } from '../store/derived';
import { dateStamp, downloadBlob, fileSlug } from './download';

const MARGIN_M = 1;

const LEGEND_HEIGHT = 210;

const LEGEND_PADDING = 32;

const SWATCH = 26;

const FONT = '600 34px system-ui, sans-serif';

const FONT_SMALL = '26px system-ui, sans-serif';

/** Renders the whole venue of the registered stage to a PNG data URL at export resolution. */
export function renderPlanDataUrl(project: ProjectData, pixelRatio = EXPORT_PIXEL_RATIO): string | null {
  const stage = getRegisteredStage();
  if (!stage) return null;
  const saved = { width: stage.width(), height: stage.height(), scale: stage.scale(), position: stage.position() };
  const layers = stage.getLayers();
  const overlay = layers[layers.length - 1] as Konva.Layer | undefined;
  const overlayVisible = overlay ? overlay.visible() : true;
  try {
    stage.size({ width: (project.venue.widthM + MARGIN_M * 2) * PX_PER_M, height: (project.venue.depthM + MARGIN_M * 2) * PX_PER_M });
    stage.scale({ x: PX_PER_M, y: PX_PER_M });
    stage.position({ x: MARGIN_M * PX_PER_M, y: MARGIN_M * PX_PER_M });
    if (overlay) overlay.hide();
    stage.draw();
    return stage.toDataURL({ pixelRatio, mimeType: 'image/png' });
  } finally {
    if (overlay && overlayVisible) overlay.show();
    stage.size({ width: saved.width, height: saved.height });
    stage.scale(saved.scale);
    stage.position(saved.position);
    stage.batchDraw();
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar a imagem'));
    img.src = src;
  });
}

/** Exports the plan as a high-resolution PNG with a scale bar and a legend. */
export async function exportPlanPng(project: ProjectData): Promise<boolean> {
  const dataUrl = renderPlanDataUrl(project);
  if (!dataUrl) return false;
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height + LEGEND_HEIGHT * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  const derived = getDerived(project);
  const top = img.height + LEGEND_PADDING;
  ctx.fillStyle = COLORS.text;
  ctx.font = FONT;
  ctx.textBaseline = 'top';
  ctx.fillText(`${project.name} · ${formatDateTime(new Date())}`, LEGEND_PADDING, top);

  const scalePx = PX_PER_M * EXPORT_PIXEL_RATIO;
  const scaleY = top + 70;
  ctx.fillStyle = COLORS.text;
  ctx.fillRect(LEGEND_PADDING, scaleY, scalePx * 5, 10);
  for (let i = 0; i <= 5; i += 1) ctx.fillRect(LEGEND_PADDING + i * scalePx - 1, scaleY - 10, 3, 30);
  ctx.font = FONT_SMALL;
  ctx.fillText(`${t.export.scale}: 0 — 5 m (1 m = ${scalePx} px)`, LEGEND_PADDING, scaleY + 30);

  let x = LEGEND_PADDING;
  const rowY = scaleY + 90;
  ctx.font = FONT_SMALL;
  const drawSwatch = (color: string, text: string, stroke?: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, rowY, SWATCH, SWATCH);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, rowY, SWATCH, SWATCH);
    }
    ctx.fillStyle = COLORS.text;
    ctx.fillText(text, x + SWATCH + 8, rowY);
    x += SWATCH + 8 + ctx.measureText(text).width + 28;
  };
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`${t.export.legendTables}:`, x, rowY);
  x += ctx.measureText(`${t.export.legendTables}:`).width + 12;
  drawSwatch(COLORS.tableEmpty, t.export.legendEmpty, COLORS.tableStroke);
  drawSwatch(COLORS.tablePartial, t.export.legendPartial, COLORS.tableStroke);
  drawSwatch(COLORS.tableFull, t.export.legendFull, COLORS.tableStroke);

  if (derived.groups.length > 0) {
    x = LEGEND_PADDING;
    const groupY = rowY + 50;
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`${t.export.legendGroups}:`, x, groupY);
    x += ctx.measureText(`${t.export.legendGroups}:`).width + 12;
    let line = 0;
    for (const group of derived.groups) {
      const color = derived.groupColors.get(group) ?? NO_GROUP_COLOR;
      const width = SWATCH + 8 + ctx.measureText(group).width + 28;
      if (x + width > canvas.width - LEGEND_PADDING) {
        line += 1;
        x = LEGEND_PADDING;
        if (line > 3) break;
      }
      const y = groupY + line * 40;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, SWATCH, SWATCH);
      ctx.fillStyle = COLORS.text;
      ctx.fillText(group, x + SWATCH + 8, y);
      x += width;
    }
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return false;
  downloadBlob(blob, `planta-${fileSlug(project.name)}-${dateStamp()}.png`);
  return true;
}
