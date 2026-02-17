/**
 * Convert analytics data to CSV format and trigger download
 */

interface CSVExportOptions {
  filename: string;
  headers: string[];
  rows: any[][];
}

export function exportToCSV({ filename, headers, rows }: CSVExportOptions) {
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((cell) => {
          // Escape quotes and wrap in quotes if contains comma
          const cellStr = String(cell ?? '');
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        })
        .join(',')
    ),
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export overview metrics to CSV
 */
export function exportOverviewToCSV(overview: any) {
  const headers = ['Metric', 'Value'];
  const rows = [
    ['Period Start', overview.period?.startDate || ''],
    ['Period End', overview.period?.endDate || ''],
    ['Total Revenue', `R$ ${Number(overview.totalRevenue || 0).toFixed(2)}`],
    ['Total Bookings', overview.totalBookings || 0],
    ['Confirmed Bookings', overview.confirmedBookings || 0],
    ['Cancelled Bookings', overview.cancelledBookings || 0],
    ['Unique Clients', overview.uniqueClients || 0],
    ['Average Ticket', `R$ ${Number(overview.averageTicket || 0).toFixed(2)}`],
    ['Cancellation Rate', `${Number(overview.cancelledRate || 0).toFixed(2)}%`],
    ['QR Scan Bookings', overview.qrScanBookings || 0],
    ['Computed At', overview.computedAt || ''],
  ];

  exportToCSV({
    filename: 'analytics-overview',
    headers,
    rows,
  });
}

/**
 * Export revenue time series to CSV
 */
export function exportRevenueToCSV(data: any) {
  const headers = [
    'Period',
    'Total Revenue',
    'Total Bookings',
    'Unique Clients',
    'Average Ticket',
    'Cancellation Rate',
  ];

  const rows = (data.data || []).map((item: any) => [
    item.period,
    `R$ ${Number(item.total_revenue || 0).toFixed(2)}`,
    item.total_bookings || 0,
    item.unique_clients || 0,
    `R$ ${Number(item.avg_ticket || 0).toFixed(2)}`,
    `${Number(item.cancelled_rate || 0).toFixed(2)}%`,
  ]);

  exportToCSV({
    filename: `analytics-revenue-${data.granularity || 'daily'}`,
    headers,
    rows,
  });
}

/**
 * Export services ranking to CSV
 */
export function exportServicesToCSV(data: any) {
  const headers = [
    'Rank',
    'Service Name',
    'Price',
    'Total Bookings',
    'Total Revenue',
    'Avg Bookings Per Day',
  ];

  const rows = (data.services || []).map((service: any, index: number) => [
    index + 1,
    service.service_name,
    `R$ ${Number(service.service_price || 0).toFixed(2)}`,
    service.total_bookings || 0,
    `R$ ${Number(service.total_revenue || 0).toFixed(2)}`,
    Number(service.avg_bookings_per_day || 0).toFixed(1),
  ]);

  exportToCSV({
    filename: 'analytics-services-ranking',
    headers,
    rows,
  });
}

/**
 * Export clients to CSV
 */
export function exportClientsToCSV(data: any) {
  const headers = [
    'Client Name',
    'Phone',
    'Type',
    'Engagement Status',
    'Total Bookings',
    'Lifetime Value',
    'Average Ticket',
    'First Booking',
    'Last Booking',
    'Days Since Last',
  ];

  const rows = (data.clients || []).map((client: any) => [
    client.client_name,
    client.client_phone,
    client.client_type,
    client.engagement_status,
    client.total_bookings || 0,
    `R$ ${Number(client.lifetime_value || 0).toFixed(2)}`,
    `R$ ${Number(client.avg_ticket || 0).toFixed(2)}`,
    client.first_booking_date || '',
    client.last_booking_date || '',
    client.days_since_last_booking || 0,
  ]);

  exportToCSV({
    filename: 'analytics-clients',
    headers,
    rows,
  });
}
