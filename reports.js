// Reports functionality
document.addEventListener("DOMContentLoaded", () => {
    // Setup report type selection
    setupReportTypeSelection()
  
    // Setup export report button
    setupExportReportButton()
  })
  
  // Setup report type selection
  function setupReportTypeSelection() {
    const reportTypeCards = document.querySelectorAll(".report-type-card")
    const reportTitle = document.getElementById("report-title")
  
    reportTypeCards.forEach((card) => {
      card.addEventListener("click", () => {
        // Remove active class from all cards
        reportTypeCards.forEach((c) => c.classList.remove("active"))
  
        // Add active class to clicked card
        card.classList.add("active")
  
        // Get report type
        const reportType = card.getAttribute("data-report")
  
        // Update report title
        reportTitle.textContent = card.querySelector(".report-title").textContent
  
        // Show appropriate filters based on report type
        toggleReportFilters(reportType)
  
        // Update filter state
        if (window.filterState && window.filterState.reports) {
          window.filterState.reports.type = reportType
  
          // Load report data
          if (typeof window.loadReportsData === "function") {
            window.loadReportsData()
          }
        }
      })
    })
  }
  
  function toggleReportFilters(reportType) {
    const customerFilter = document.getElementById("report-customer-filter")
    const categoryFilter = document.getElementById("report-category-filter")
  
    // Reset filters
    if (customerFilter) customerFilter.style.display = "none"
    if (categoryFilter) categoryFilter.style.display = "none"
  
    // Show appropriate filters based on report type
    if (reportType === "customer-ledger") {
      if (customerFilter) customerFilter.style.display = "block"
    } else if (reportType === "stock-ledger" || reportType === "expense-report") {
      if (categoryFilter) categoryFilter.style.display = "block"
    }
  }
  
  function setupExportReportButton() {
    const exportReportBtn = document.getElementById("export-report-btn")
    const exportReportModal = document.getElementById("export-report-modal")
    const closeExportReportModal = document.getElementById("close-export-report-modal")
  
    if (exportReportBtn) {
      exportReportBtn.addEventListener("click", () => {
        if (exportReportModal) {
          exportReportModal.style.display = "block"
        }
      })
    }
  
    if (closeExportReportModal) {
      closeExportReportModal.addEventListener("click", () => {
        if (exportReportModal) {
          exportReportModal.style.display = "none"
        }
      })
    }
  
    // Setup export report form
    const exportReportForm = document.getElementById("export-report-form")
    if (exportReportForm) {
      exportReportForm.addEventListener("submit", (event) => {
        event.preventDefault()
  
        const format = document.getElementById("export-format").value
        exportReport(format)
  
        // Close modal
        if (exportReportModal) {
          exportReportModal.style.display = "none"
        }
      })
    }
  }
  
  function exportReport(format) {
    try {
      const reportTitle = document.getElementById("report-title").textContent
      const reportContent = document.getElementById("report-content")
  
      if (format === "pdf") {
        // Create PDF
        const { jsPDF } = window.jspdf
        if (!jsPDF) {
          throw new Error("jsPDF library not loaded properly")
        }
  
        const doc = new jsPDF()
  
        // Add title
        doc.setFontSize(18)
        doc.text(reportTitle, 14, 22)
  
        // Add date range
        doc.setFontSize(12)
        if (window.filterState && window.filterState.reports) {
          doc.text(
            `Period: ${window.formatDate(window.filterState.reports.dateFrom)} - ${window.formatDate(window.filterState.reports.dateTo)}`,
            14,
            30,
          )
        }
  
        // Add content
        doc.html(reportContent, {
          callback: (doc) => {
            doc.save(`${reportTitle.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.pdf`)
          },
          x: 15,
          y: 40,
          width: 180,
          windowWidth: 800,
        })
      } else if (format === "excel" || format === "csv") {
        // For Excel/CSV, we'll need to extract data from tables
        const tables = reportContent.querySelectorAll("table")
        if (tables.length > 0) {
          let csvContent = "data:text/csv;charset=utf-8,"
  
          // Add title
          csvContent += `${reportTitle}\r\n`
          if (window.filterState && window.filterState.reports) {
            csvContent += `Period: ${window.formatDate(window.filterState.reports.dateFrom)} - ${window.formatDate(window.filterState.reports.dateTo)}\r\n\r\n`
          }
  
          // Process each table
          tables.forEach((table, tableIndex) => {
            // Get table header
            const headers = Array.from(table.querySelectorAll("th")).map((th) => th.textContent.trim())
            csvContent += headers.join(",") + "\r\n"
  
            // Get table rows
            const rows = table.querySelectorAll("tbody tr")
            rows.forEach((row) => {
              const rowData = Array.from(row.querySelectorAll("td")).map((td) => {
                // Remove commas and quotes to avoid CSV issues
                return `"${td.textContent.trim().replace(/"/g, '""')}"`
              })
              csvContent += rowData.join(",") + "\r\n"
            })
  
            // Add space between tables
            if (tableIndex < tables.length - 1) {
              csvContent += "\r\n"
            }
          })
  
          // Create download link
          const encodedUri = encodeURI(csvContent)
          const link = document.createElement("a")
          link.setAttribute("href", encodedUri)
          link.setAttribute(
            "download",
            `${reportTitle.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.${format}`,
          )
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        } else {
          if (window.showToast) {
            window.showToast("Error", "No table data found to export", "error")
          } else {
            alert("Error: No table data found to export")
          }
        }
      }
  
      if (window.showToast) {
        window.showToast("Success", `Report exported as ${format.toUpperCase()} successfully`)
      } else {
        alert(`Success: Report exported as ${format.toUpperCase()} successfully`)
      }
    } catch (error) {
      console.error("Error exporting report:", error)
      if (window.showToast) {
        window.showToast("Error", "Failed to export report", "error")
      } else {
        alert("Error: Failed to export report")
      }
    }
  }
  
  
