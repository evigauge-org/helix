import {
  EnterpriseReport,
  Sheet,
  Cell,
  ColumnType,
  ROLE_TEXT_COLORS,
  ASSUMPTION_BG,
  HEADER_BG,
  HEADER_FG,
  BANDED_ROW_BG,
  BORDER_COLOR,
  NUMBER_FORMATS,
} from "./types";

type SheetMeta = { sheetId: number; name: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Request = Record<string, any>;

function textColorFor(cell: Cell): { red: number; green: number; blue: number } {
  const value = typeof cell.value === "string" ? cell.value.trim() : "";
  if (value.startsWith("=")) return ROLE_TEXT_COLORS.formula;
  if (cell.role) return ROLE_TEXT_COLORS[cell.role];
  return ROLE_TEXT_COLORS.formula;
}

function bgColorFor(cell: Cell): { red: number; green: number; blue: number } | null {
  if (cell.background === "assumption") return ASSUMPTION_BG;
  return null;
}

function numberFormatFor(type: ColumnType, override: string | undefined): string | null {
  if (override) return override;
  return NUMBER_FORMATS[type];
}

function cellValue(cell: Cell): Request {
  const v = cell.value;
  if (typeof v === "string" && v.trim().startsWith("=")) {
    return { formulaValue: v };
  }
  if (typeof v === "number") return { numberValue: v };
  return { stringValue: String(v) };
}

export function buildBatchUpdate(
  spec: EnterpriseReport,
  existingSheets: SheetMeta[],
): { requests: Request[]; sheetIds: Record<string, number> } {
  const requests: Request[] = [];
  const sheetIds: Record<string, number> = {};

  const firstSheet = spec.sheets[0];
  const defaultMeta = existingSheets[0];
  sheetIds[firstSheet.name] = defaultMeta.sheetId;
  if (defaultMeta.name !== firstSheet.name) {
    requests.push({
      updateSheetProperties: {
        properties: { sheetId: defaultMeta.sheetId, title: firstSheet.name },
        fields: "title",
      },
    });
  }

  let nextSheetId = Math.max(...existingSheets.map((s) => s.sheetId)) + 1;
  for (const s of spec.sheets.slice(1)) {
    sheetIds[s.name] = nextSheetId;
    requests.push({
      addSheet: { properties: { sheetId: nextSheetId, title: s.name } },
    });
    nextSheetId++;
  }

  for (const sheet of spec.sheets) {
    const sid = sheetIds[sheet.name];
    requests.push(...buildPerSheet(sheet, sid));
  }

  return { requests, sheetIds };
}

function buildPerSheet(sheet: Sheet, sheetId: number): Request[] {
  const out: Request[] = [];

  const headerRow: Request = {
    values: sheet.columns.map((col) => ({
      userEnteredValue: { stringValue: col.header },
      userEnteredFormat: {
        backgroundColor: HEADER_BG,
        textFormat: { foregroundColor: HEADER_FG, bold: true, fontFamily: "Arial", fontSize: 11 },
        horizontalAlignment: "CENTER",
        verticalAlignment: "MIDDLE",
      },
    })),
  };

  const dataRows: Request[] = sheet.rows.map((row, rowIdx) => ({
    values: row.cells.map((cell, colIdx) => {
      const col = sheet.columns[colIdx];
      const colType: ColumnType = col?.type ?? "text";
      const fmt = numberFormatFor(colType, cell.format_override);
      const banded = rowIdx % 2 === 1;
      const bg = bgColorFor(cell) ?? (banded ? BANDED_ROW_BG : undefined);
      const cellFormat: Request = {
        textFormat: {
          foregroundColor: textColorFor(cell),
          fontFamily: "Arial",
          fontSize: 11,
        },
      };
      if (bg) cellFormat.backgroundColor = bg;
      if (fmt) cellFormat.numberFormat = { type: colType === "date" ? "DATE" : "NUMBER", pattern: fmt };
      const entry: Request = {
        userEnteredValue: cellValue(cell),
        userEnteredFormat: cellFormat,
      };
      if (cell.source) entry.note = cell.source;
      return entry;
    }),
  }));

  out.push({
    updateCells: {
      rows: [headerRow, ...dataRows],
      fields: "userEnteredValue,userEnteredFormat,note",
      start: { sheetId, rowIndex: 0, columnIndex: 0 },
    },
  });

  if (sheet.frozen_header !== false) {
    out.push({
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    });
  }

  const totalRows = 1 + sheet.rows.length;
  const totalCols = sheet.columns.length;
  if (totalRows > 0 && totalCols > 0) {
    out.push({
      updateBorders: {
        range: { sheetId, startRowIndex: 0, endRowIndex: totalRows, startColumnIndex: 0, endColumnIndex: totalCols },
        top: { style: "SOLID", color: BORDER_COLOR, width: 1 },
        bottom: { style: "SOLID", color: BORDER_COLOR, width: 1 },
        left: { style: "SOLID", color: BORDER_COLOR, width: 1 },
        right: { style: "SOLID", color: BORDER_COLOR, width: 1 },
        innerHorizontal: { style: "SOLID", color: BORDER_COLOR, width: 1 },
        innerVertical: { style: "SOLID", color: BORDER_COLOR, width: 1 },
      },
    });
  }

  sheet.columns.forEach((col, idx) => {
    if (col.width) {
      out.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: "COLUMNS", startIndex: idx, endIndex: idx + 1 },
          properties: { pixelSize: col.width },
          fields: "pixelSize",
        },
      });
    } else {
      out.push({
        autoResizeDimensions: {
          dimensions: { sheetId, dimension: "COLUMNS", startIndex: idx, endIndex: idx + 1 },
        },
      });
    }
  });

  out.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 32 },
      fields: "pixelSize",
    },
  });

  (sheet.charts ?? []).forEach((c) => {
    const [anchorCol, anchorRow] = parseA1(c.anchor_cell);
    out.push({
      addChart: {
        chart: {
          spec: {
            title: c.title,
            basicChart: {
              chartType:
                c.type === "line" ? "LINE" :
                c.type === "bar" ? "BAR" :
                c.type === "pie" ? "PIE" :
                "COLUMN",
              legendPosition: "RIGHT_LEGEND",
              domains: [],
              series: [],
            },
          },
          position: {
            overlayPosition: {
              anchorCell: { sheetId, rowIndex: anchorRow, columnIndex: anchorCol },
              widthPixels: 480,
              heightPixels: 300,
            },
          },
        },
      },
    });
  });

  return out;
}

function parseA1(cell: string): [number, number] {
  const m = cell.match(/^([A-Z]+)(\d+)$/)!;
  const letters = m[1];
  const row = parseInt(m[2], 10) - 1;
  let col = 0;
  for (const ch of letters) col = col * 26 + (ch.charCodeAt(0) - 64);
  return [col - 1, row];
}
