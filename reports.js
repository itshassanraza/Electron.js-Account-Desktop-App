// Reports functionality
// Reports functionality
document.addEventListener("DOMContentLoaded", () => {
    // Setup report type selection
    setupReportTypeSelection();
    
    // Setup export report button
    setupExportReportButton();
});

// Check if filterState already exists, if not create it
if (typeof filterState === 'undefined') {
    let filterState = {};
}

// Initialize reports filter if it doesn't exist
if (!filterState.reports) {
    filterState.reports = {
        type: null,
        dateFrom: null,
        dateTo: null,
        customer: null,
        category: null
    };
}

function loadReportsData() {
    // Your existing code here
}
function formatDate(date) {
    // Placeholder function - replace with actual implementation
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();

    if (month.length < 2) 
        month = '0' + month;
    if (day.length < 2) 
        day = '0' + day;

    return [year, month, day].join('-');
}

function showToast(title, message, type) {
    // Placeholder function - replace with actual implementation
    console.log(`Toast: ${title} - ${message} (${type})`);
}

function setupReportTypeSelection() {
    const reportTypeCards = document.querySelectorAll('.report-type-card');
    const reportTitle = document.getElementById('report-title');
    const reportContent = document.getElementById('report-content');
    
    reportTypeCards.forEach(card => {
        card.addEventListener('click', () => {
            // Remove active class from all cards
            reportTypeCards.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked card
            card.classList.add('active');
            
            // Get report type
            const reportType = card.getAttribute('data-report');
            
            // Update report title
            reportTitle.textContent = card.querySelector('.report-title').textContent;
            
            // Show appropriate filters based on report type
            toggleReportFilters(reportType);
            
            // Update filter state
            filterState.reports.type = reportType;
            
            // Load report data
            loadReportsData();
        });
    });
}

function toggleReportFilters(reportType) {
    const customerFilter = document.getElementById('report-customer-filter');
    const categoryFilter = document.getElementById('report-category-filter');
    
    // Reset filters
    customerFilter.style.display = 'none';
    categoryFilter.style.display = 'none';
    
    // Show appropriate filters based on report type
    if (reportType === 'customer-ledger') {
        customerFilter.style.display = 'block';
    } else if (reportType === 'stock-ledger' || reportType === 'expense-report') {
        categoryFilter.style.display = 'block';
    }
}

function setupExportReportButton() {
    const exportReportBtn = document.getElementById('export-report-btn');
    const exportReportModal = document.getElementById('export-report-modal');
    const closeExportReportModal = document.getElementById('close-export-report-modal');
    
    if (exportReportBtn) {
        exportReportBtn.addEventListener('click', () => {
            exportReportModal.style.display = 'flex';
        });
    }
    
    if (closeExportReportModal) {
        closeExportReportModal.addEventListener('click', () => {
            exportReportModal.style.display = 'none';
        });
    }
    
    // Setup export report form
    const exportReportForm = document.getElementById('export-report-form');
    if (exportReportForm) {
        exportReportForm.addEventListener('submit', (event) => {
            event.preventDefault();
            
            const format = document.getElementById('export-format').value;
            exportReport(format);
            
            // Close modal
            exportReportModal.style.display = 'none';
        });
    }
}

function exportReport(format) {
    try {
        const reportTitle = document.getElementById('report-title').textContent;
        const reportContent = document.getElementById('report-content');
        
        if (format === 'pdf') {
            // Create PDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Add title
            doc.setFontSize(18);
            doc.text(reportTitle, 14, 22);
            
            // Add date range
            doc.setFontSize(12);
            doc.text(`Period: ${formatDate(filterState.reports.dateFrom)} - ${formatDate(filterState.reports.dateTo)}`, 14, 30);
            
            // Add content
            doc.html(reportContent, {
                callback: function(doc) {
                    doc.save(`${reportTitle.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`);
                },
                x: 15,
                y: 40,
                width: 180,
                windowWidth: 800
            });
        } else if (format === 'excel' || format === 'csv') {
            // For Excel/CSV, we'll need to extract data from tables
            const tables = reportContent.querySelectorAll('table');
            if (tables.length > 0) {
                let csvContent = "data:text/csv;charset=utf-8,";
                
                // Add title
                csvContent += `${reportTitle}\r\n`;
                csvContent += `Period: ${formatDate(filterState.reports.dateFrom)} - ${formatDate(filterState.reports.dateTo)}\r\n\r\n`;
                
                // Process each table
                tables.forEach((table, tableIndex) => {
                    // Get table header
                    const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
                    csvContent += headers.join(',') + '\r\n';
                    
                    // Get table rows
                    const rows = table.querySelectorAll('tbody tr');
                    rows.forEach(row => {
                        const rowData = Array.from(row.querySelectorAll('td')).map(td => {
                            // Remove commas and quotes to avoid CSV issues
                            return `"${td.textContent.trim().replace(/"/g, '""')}"`;
                        });
                        csvContent += rowData.join(',') + '\r\n';
                    });
                    
                    // Add space between tables
                    if (tableIndex < tables.length - 1) {
                        csvContent += '\r\n';
                    }
                });
                
                // Create download link
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', `${reportTitle.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.${format}`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                showToast('Error', 'No table data found to export', 'error');
            }
        }
        
        showToast('Success', `Report exported as ${format.toUpperCase()} successfully`);
    } catch (error) {
        console.error('Error exporting report:', error);
        showToast('Error', 'Failed to export report', 'error');
    }
}

// Add CSS for active report type card
document.head.insertAdjacentHTML('beforeend', `
<style>
.report-type-card {
    cursor: pointer;
    transition: all 0.3s ease;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.report-type-card:hover {
    background-color: #f7fafc;
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.report-type-card.active {
    background-color: #ebf8ff;
    border-color: #4299e1;
}

.report-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    color: #4a5568;
}

.report-title {
    font-weight: 500;
    text-align: center;
}

.report-type-card.active .report-icon,
.report-type-card.active .report-title {
    color: #3182ce;
}
</style>
`);
