// ========================================================
// REAL ESTATE CRM - EXCEL / CSV EXPORT UTILITY
// Hỗ trợ xuất file Excel với UTF-8 BOM hiển thị tiếng Việt hoàn hảo
// ========================================================

export interface ExportColumn {
  header: string;
  key: string;
}

export interface ExportExcelOptions {
  filename: string;
  title?: string;
  metadata?: Record<string, string | number>;
  columns: ExportColumn[];
  data: any[];
  totals?: Record<string, string | number>;
}

export function exportToExcel({
  filename,
  title,
  metadata,
  columns,
  data,
  totals,
}: ExportExcelOptions): void {
  const lines: string[] = [];

  // 1. Tiêu đề bảng biểu (nếu có)
  if (title) {
    lines.push(`"${title.replace(/"/g, '""')}"`);
    lines.push('');
  }

  // 2. Metadata (Thời gian xuất, Dự án, Người phụ trách...)
  if (metadata) {
    Object.entries(metadata).forEach(([k, v]) => {
      lines.push(`"${k}","${String(v).replace(/"/g, '""')}"`);
    });
    lines.push('');
  }

  // 3. Header cột
  const headerRow = columns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',');
  lines.push(headerRow);

  // 4. Các hàng dữ liệu
  data.forEach(row => {
    const rowValues = columns.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '""';
      if (typeof val === 'number') return `"${val}"`;
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    lines.push(rowValues.join(','));
  });

  // 5. Dòng tổng cộng (nếu có)
  if (totals) {
    const totalRow = columns.map((c, idx) => {
      if (idx === 0) return `"${totals[c.key] || 'TỔNG CỘNG'}"`;
      const val = totals[c.key];
      if (val !== undefined && val !== null) {
        return `"${String(val).replace(/"/g, '""')}"`;
      }
      return '""';
    });
    lines.push(totalRow.join(','));
  }

  // Tạo Blob với BOM UTF-8 (\uFEFF) để Excel nhận diện bảng mã tiếng Việt Unicode
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
