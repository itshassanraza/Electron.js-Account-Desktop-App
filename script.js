 // Get references to HTML elements
 const { ipcRenderer } = require('electron');
 const navItems = document.querySelectorAll('.nav-item');
 const pages = document.querySelectorAll('.page');
 const toast = document.getElementById('toast-notification');
 const toastTitle = document.getElementById('toast-title');
 const toastMessage = document.getElementById('toast-message');
 const toastClose = document.querySelector('.toast-close');

 // Set current date as default for date inputs
 const today = new Date().toISOString().split('T')[0];
 document.getElementById('stock-date').value = today;
 document.getElementById('transaction-date').value = today;
 document.getElementById('expense-date').value = today;
 document.getElementById('pdf-start-date').value = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
 document.getElementById('pdf-end-date').value = today;

 // Global state variables
 let currentCustomerId = null;
 let stockData = [];
 let categoriesData = [];
 let customersData = [];
 let expensesData = [];
 let expenseCategoriesData = [];
 let ledgerEntries = [];
 let stockChart = null;
 let expenseChart = null;

 // Pagination state
 const paginationState = {
     stock: { page: 1, limit: 10, total: 0 },
     customers: { page: 1, limit: 10, total: 0 },
     ledger: { page: 1, limit: 10, total: 0 },
     expenses: { page: 1, limit: 10, total: 0 }
 };

 // Sorting state
 const sortState = {
     stock: { field: 'date', direction: 'desc' },
     customers: { field: 'name', direction: 'asc' },
     ledger: { field: 'date', direction: 'desc' },
     expenses: { field: 'date', direction: 'desc' }
 };

 // Filter state
 const filterState = {
     stock: {},
     customers: {},
     ledger: {},
     expenses: {}
 };

 // Utility functions
 function formatCurrency(amount) {
     return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PKR' }).format(amount);
 }

 function formatDate(dateString) {
     const date = new Date(dateString);
     return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
 }

 function showToast(title, message, type = 'success') {
     toastTitle.textContent = title;
     toastMessage.textContent = message;

     toast.className = 'toast';
     toast.classList.add(`toast-${type}`);

     const icon = toast.querySelector('.toast-icon i');
     if (type === 'success') {
         icon.className = 'fas fa-check-circle text-green-500';
     } else {
         icon.className = 'fas fa-exclamation-circle text-red-500';
     }

     toast.classList.add('show');

     setTimeout(() => {
         toast.classList.remove('show');
     }, 3000);
 }

 toastClose.addEventListener('click', () => {
     toast.classList.remove('show');
 });

 // Navigation
 navItems.forEach(item => {
     item.addEventListener('click', () => {
         const targetPage = item.getAttribute('data-page');

         // Hide customer ledger page if navigating away from ledger
         if (targetPage !== 'ledger' && document.getElementById('customer-ledger-page').classList.contains('active')) {
             document.getElementById('customer-ledger-page').classList.remove('active');
         }

         // Update active nav item
         navItems.forEach(nav => nav.classList.remove('active'));
         item.classList.add('active');

         // Show target page
         pages.forEach(page => page.classList.remove('active'));
         document.getElementById(`${targetPage}-page`).classList.add('active');

         // Refresh data for the active page
         if (targetPage === 'dashboard') {
             loadDashboardData();
         } else if (targetPage === 'stock') {
             loadStockData();
         } else if (targetPage === 'ledger') {
             loadCustomersData();
         } else if (targetPage === 'transactions') {
             loadExpensesData();
         }
     });
 });

 // Modal handlers
 function setupModal(modalId, openBtnId, closeBtnId) {
     const modal = document.getElementById(modalId);
     const openBtn = document.getElementById(openBtnId);
     const closeBtn = document.getElementById(closeBtnId);

     if (openBtn) {
         openBtn.addEventListener('click', () => {
             modal.style.display = 'flex';
         });
     }

     if (closeBtn) {
         closeBtn.addEventListener('click', () => {
             modal.style.display = 'none';
         });
     }

     window.addEventListener('click', (event) => {
         if (event.target === modal) {
             modal.style.display = 'none';
         }
     });
 }

 // Setup modals
 setupModal('add-stock-modal', 'add-stock-btn', 'close-add-stock-modal');
 setupModal('edit-stock-modal', null, 'close-edit-stock-modal');
 setupModal('add-category-modal', 'add-category-btn', 'close-add-category-modal');
 setupModal('add-customer-modal', 'add-customer-btn', 'close-add-customer-modal');
 setupModal('edit-customer-modal', null, 'close-edit-customer-modal');
 setupModal('add-transaction-modal', 'add-transaction-btn', 'close-add-transaction-modal');
 setupModal('edit-transaction-modal', null, 'close-edit-transaction-modal');
 setupModal('add-expense-category-modal', 'add-expense-category-btn', 'close-add-expense-category-modal');
 setupModal('add-expense-modal', 'add-expense-btn', 'close-add-expense-modal');
 setupModal('edit-expense-modal', null, 'close-edit-expense-modal');
 setupModal('generate-pdf-modal', 'generate-stock-pdf', 'close-generate-pdf-modal');
 setupModal('delete-confirmation-modal', null, 'close-delete-confirmation-modal');

 // Link PDF generation buttons to modal
 document.getElementById('generate-ledger-pdf').addEventListener('click', () => {
     document.getElementById('generate-pdf-modal').style.display = 'flex';
 });

 document.getElementById('generate-customer-ledger-pdf').addEventListener('click', () => {
     document.getElementById('generate-pdf-modal').style.display = 'flex';
 });

 document.getElementById('generate-expense-pdf').addEventListener('click', () => {
     document.getElementById('generate-pdf-modal').style.display = 'flex';
 });

 // Setup sorting
 function setupSorting(tableId, dataType) {
     const table = document.getElementById(tableId);
     if (!table) return;

     const headers = table.querySelectorAll('th[data-sort]');
     headers.forEach(header => {
         header.addEventListener('click', () => {
             const field = header.getAttribute('data-sort');

             // Toggle direction if clicking the same field
             if (sortState[dataType].field === field) {
                 sortState[dataType].direction = sortState[dataType].direction === 'asc' ? 'desc' : 'asc';
             } else {
                 sortState[dataType].field = field;
                 sortState[dataType].direction = 'asc';
             }

             // Update UI
             headers.forEach(h => {
                 h.classList.remove('sort-asc', 'sort-desc');
             });

             header.classList.add(`sort-${sortState[dataType].direction}`);

             // Refresh data
             if (dataType === 'stock') {
                 loadStockData();
             } else if (dataType === 'customers') {
                 loadCustomersData();
             } else if (dataType === 'ledger') {
                 viewCustomerLedger(currentCustomerId, document.getElementById('customer-name-title').textContent.replace("'s Ledger", ""));
             } else if (dataType === 'expenses') {
                 loadExpensesData();
             }
         });
     });
 }

 // Setup pagination
 function setupPagination(dataType) {
     const prevBtn = document.getElementById(`${dataType}-prev-page`);
     const nextBtn = document.getElementById(`${dataType}-next-page`);

     if (!prevBtn || !nextBtn) return;

     prevBtn.addEventListener('click', () => {
         if (paginationState[dataType].page > 1) {
             paginationState[dataType].page--;

             if (dataType === 'stock') {
                 loadStockData();
             } else if (dataType === 'customers') {
                 loadCustomersData();
             } else if (dataType === 'ledger') {
                 viewCustomerLedger(currentCustomerId, document.getElementById('customer-name-title').textContent.replace("'s Ledger", ""));
             } else if (dataType === 'expenses') {
                 loadExpensesData();
             }
         }
     });

     nextBtn.addEventListener('click', () => {
         const totalPages = Math.ceil(paginationState[dataType].total / paginationState[dataType].limit);
         if (paginationState[dataType].page < totalPages) {
             paginationState[dataType].page++;

             if (dataType === 'stock') {
                 loadStockData();
             } else if (dataType === 'customers') {
                 loadCustomersData();
             } else if (dataType === 'ledger') {
                 viewCustomerLedger(currentCustomerId, document.getElementById('customer-name-title').textContent.replace("'s Ledger", ""));
             } else if (dataType === 'expenses') {
                 loadExpensesData();
             }
         }
     });
 }

 function showLoading() {
     document.getElementById('loading-overlay').classList.add('show');
 }

 function hideLoading() {
     document.getElementById('loading-overlay').classList.remove('show');
 }

 function filterData(data, filters, type) {
     return data.filter(item => {
         // Apply text search filters
         if (type === 'stock') {
             if (filters.name && !item.name.toLowerCase().includes(filters.name.toLowerCase())) {
                 return false;
             }
             if (filters.category && item.category !== filters.category) {
                 return false;
             }
         } else if (type === 'ledger') {
             if (filters.title && !item.title.toLowerCase().includes(filters.title.toLowerCase())) {
                 return false;
             }
             if (filters.type && item.type !== filters.type) {
                 return false;
             }
         } else if (type === 'expenses') {
             if (filters.title && !item.title.toLowerCase().includes(filters.title.toLowerCase())) {
                 return false;
             }
             if (filters.category && item.category !== filters.category) {
                 return false;
             }
             if (filters.type && item.type !== filters.type) {
                 return false;
             }
         }

         // Apply date range filters
         if ((filters.dateFrom || filters.dateTo) && item.date) {
             const itemDate = new Date(item.date);
             if (filters.dateFrom) {
                 const fromDate = new Date(filters.dateFrom);
                 if (itemDate < fromDate) return false;
             }
             if (filters.dateTo) {
                 const toDate = new Date(filters.dateTo);
                 toDate.setHours(23, 59, 59, 999); // End of the day
                 if (itemDate > toDate) return false;
             }
         }

         return true;
     });
 }
 function applyFilters(dataType) {
     // Reset to first page when applying filters
     paginationState[dataType].page = 1;

     if (dataType === 'stock') {
         const nameFilter = document.getElementById('stock-search').value.trim();
         const categoryFilter = document.getElementById('stock-filter-category').value;
         const dateFromFilter = document.getElementById('stock-date-from').value;
         const dateToFilter = document.getElementById('stock-date-to').value;

         filterState.stock = {
             name: nameFilter,
             category: categoryFilter,
             dateFrom: dateFromFilter,
             dateTo: dateToFilter
         };

         loadStockData();
     } else if (dataType === 'customers') {
         const nameFilter = document.getElementById('customer-search').value.trim();

         filterState.customers = {
             name: nameFilter
         };

         loadCustomersData();
     } else if (dataType === 'ledger') {
         const titleFilter = document.getElementById('ledger-search').value.trim();
         const typeFilter = document.getElementById('ledger-filter-type').value;
         const dateFromFilter = document.getElementById('ledger-date-from').value;
         const dateToFilter = document.getElementById('ledger-date-to').value;

         filterState.ledger = {
             title: titleFilter,
             type: typeFilter,
             dateFrom: dateFromFilter,
             dateTo: dateToFilter
         };

         if (currentCustomerId) {
             viewCustomerLedger(currentCustomerId, document.getElementById('customer-name-title').textContent.replace("'s Ledger", ""));
         }
     } else if (dataType === 'expenses') {
         const titleFilter = document.getElementById('expense-search').value.trim();
         const categoryFilter = document.getElementById('expense-filter-category').value;
         const typeFilter = document.getElementById('expense-filter-type').value;
         const dateFromFilter = document.getElementById('expense-date-from').value;
         const dateToFilter = document.getElementById('expense-date-to').value;

         filterState.expenses = {
             title: titleFilter,
             category: categoryFilter,
             type: typeFilter,
             dateFrom: dateFromFilter,
             dateTo: dateToFilter
         };

         loadExpensesData();
     }
 }

 // Setup filters
 function setupFilters(dataType) {
     const applyBtn = document.getElementById(`${dataType}-filter-apply`);
     const resetBtn = document.getElementById(`${dataType}-filter-reset`);

     if (!applyBtn || !resetBtn) return;

     // Add event listener for apply button
     applyBtn.addEventListener('click', () => {
         applyFilters(dataType);
     });

     // Add event listeners for input fields to apply filters on Enter key
     if (dataType === 'stock') {
         document.getElementById('stock-search').addEventListener('keyup', (e) => {
             if (e.key === 'Enter') applyFilters(dataType);
         });
     } else if (dataType === 'customers') {
         document.getElementById('customer-search').addEventListener('keyup', (e) => {
             if (e.key === 'Enter') applyFilters(dataType);
         });
     } else if (dataType === 'ledger') {
         document.getElementById('ledger-search').addEventListener('keyup', (e) => {
             if (e.key === 'Enter') applyFilters(dataType);
         });
     } else if (dataType === 'expenses') {
         document.getElementById('expense-search').addEventListener('keyup', (e) => {
             if (e.key === 'Enter') applyFilters(dataType);
         });
     }

     // Add event listener for reset button
     resetBtn.addEventListener('click', () => {
         // Clear filter inputs based on dataType
         if (dataType === 'stock') {
             document.getElementById('stock-search').value = '';
             document.getElementById('stock-filter-category').value = '';
             document.getElementById('stock-date-from').value = '';
             document.getElementById('stock-date-to').value = '';
             filterState.stock = {};
         } else if (dataType === 'customers') {
             document.getElementById('customer-search').value = '';
             filterState.customers = {};
         } else if (dataType === 'ledger') {
             document.getElementById('ledger-search').value = '';
             document.getElementById('ledger-filter-type').value = '';
             document.getElementById('ledger-date-from').value = '';
             document.getElementById('ledger-date-to').value = '';
             filterState.ledger = {};
         } else if (dataType === 'expenses') {
             document.getElementById('expense-search').value = '';
             document.getElementById('expense-filter-category').value = '';
             document.getElementById('expense-filter-type').value = '';
             document.getElementById('expense-date-from').value = '';
             document.getElementById('expense-date-to').value = '';
             filterState.expenses = {};
         }

         // Reset to first page and reload data
         paginationState[dataType].page = 1;

         if (dataType === 'stock') {
             loadStockData();
         } else if (dataType === 'customers') {
             loadCustomersData();
         } else if (dataType === 'ledger' && currentCustomerId) {
             viewCustomerLedger(currentCustomerId, document.getElementById('customer-name-title').textContent.replace("'s Ledger", ""));
         } else if (dataType === 'expenses') {
             loadExpensesData();
         }
     });
 }

 // Setup all sorting, pagination, and filters
 window.addEventListener('DOMContentLoaded', () => {
     // Setup sorting
     setupSorting('stock-summary-table', 'stock');
     setupSorting('stock-entries-table', 'stock');
     setupSorting('customers-table', 'customers');
     setupSorting('customer-ledger-table', 'ledger');
     setupSorting('expenses-table', 'expenses');

     // Setup pagination
     setupPagination('stock');
     setupPagination('customers');
     setupPagination('ledger');
     setupPagination('expenses');

     // Setup filters
     setupFilters('stock');
     setupFilters('customers');
     setupFilters('ledger');
     setupFilters('expenses');

     // Load initial data
     loadDashboardData();
     loadCategories();
     loadExpenseCategories();
 });

 // Dashboard Data
 async function loadDashboardData() {
     try {
         // Load all required data
         stockData = await ipcRenderer.invoke('get-stocks');
         customersData = await ipcRenderer.invoke('get-customers');
         expensesData = await ipcRenderer.invoke('get-expenses');

         // Calculate totals
         let totalStockValue = 0;

         // Process stock data for summary and chart
         const stockSummary = {};

         stockData.forEach(stock => {
             const value = stock.quantity * stock.price;
             totalStockValue += value;

             // Group by category for chart
             if (!stockSummary[stock.category]) {
                 stockSummary[stock.category] = 0;
             }
             stockSummary[stock.category] += value;
         });

         // Process expense data for chart
         const expenseSummary = {};
         let totalExpenses = 0;

         expensesData.forEach(expense => {
             const amount = expense.amount;

             if (expense.type === 'debit') {
                 totalExpenses += amount;

                 // Group by category for chart
                 if (!expenseSummary[expense.category]) {
                     expenseSummary[expense.category] = 0;
                 }
                 expenseSummary[expense.category] += amount;
             }
         });

         // Update summary boxes
         document.getElementById('total-stock-value').textContent = formatCurrency(totalStockValue);
         document.getElementById('total-customers').textContent = customersData.length;
         document.getElementById('total-expenses').textContent = formatCurrency(totalExpenses);

         // Update charts
         updateStockChart(stockSummary);
         updateExpenseChart(expenseSummary);

     } catch (error) {
         console.error('Error loading dashboard data:', error);
         showToast('Error', 'Failed to load dashboard data', 'error');
     }
 }

 // Stock Chart
 function updateStockChart(stockSummary) {
     const ctx = document.getElementById('stock-chart').getContext('2d');

     // Destroy existing chart if it exists
     if (stockChart) {
         stockChart.destroy();
     }

     // Prepare data for chart
     const labels = Object.keys(stockSummary);
     const data = Object.values(stockSummary);

     // Create chart
     stockChart = new Chart(ctx, {
         type: 'bar',
         data: {
             labels: labels,
             datasets: [{
                 label: 'Stock Value by Category',
                 data: data,
                 backgroundColor: 'rgba(0, 0, 0, 0.7)',
                 borderColor: 'rgba(0, 0, 0, 1)',
                 borderWidth: 1
             }]
         },
         options: {
             responsive: true,
             maintainAspectRatio: false,
             scales: {
                 y: {
                     beginAtZero: true,
                     ticks: {
                         callback: function (value) {
                             return '$' + value;
                         }
                     }
                 }
             }
         }
     });
 }

 // Expense Chart
 function updateExpenseChart(expenseSummary) {
     const ctx = document.getElementById('expense-chart').getContext('2d');

     // Destroy existing chart if it exists
     if (expenseChart) {
         expenseChart.destroy();
     }

     // Prepare data for chart
     const labels = Object.keys(expenseSummary);
     const data = Object.values(expenseSummary);

     // Generate colors
     const backgroundColors = labels.map((_, index) => {
         const hue = (index * 137) % 360;
         return `hsla(${hue}, 70%, 60%, 0.7)`;
     });

     // Create chart
     expenseChart = new Chart(ctx, {
         type: 'pie',
         data: {
             labels: labels,
             datasets: [{
                 label: 'Expenses by Category',
                 data: data,
                 backgroundColor: backgroundColors,
                 borderColor: 'white',
                 borderWidth: 1
             }]
         },
         options: {
             responsive: true,
             maintainAspectRatio: false,
             plugins: {
                 legend: {
                     position: 'right'
                 },
                 tooltip: {
                     callbacks: {
                         label: function (context) {
                             const label = context.label || '';
                             const value = context.raw;
                             const total = context.dataset.data.reduce((a, b) => a + b, 0);
                             const percentage = Math.round((value / total) * 100);
                             return `${label}: ${formatCurrency(value)} (${percentage}%)`;
                         }
                     }
                 }
             }
         }
     });
 }

 // Stock Management
 async function loadStockData() {
     try {

         // Apply filters
         stockData = await ipcRenderer.invoke('get-stocks', filterState.stock);

         // Apply sorting
         stockData.sort((a, b) => {
             const field = sortState.stock.field;
             const direction = sortState.stock.direction === 'asc' ? 1 : -1;

             if (field === 'date') {
                 return new Date(a[field]) > new Date(b[field]) ? direction : -direction;
             } else if (field === 'name' || field === 'category' || field === 'color') {
                 return a[field].localeCompare(b[field]) * direction;
             } else {
                 return (a[field] - b[field]) * direction;
             }
         });

         // Update pagination
         paginationState.stock.total = stockData.length;
         const start = (paginationState.stock.page - 1) * paginationState.stock.limit;
         const end = start + paginationState.stock.limit;
         const paginatedStockData = stockData.slice(start, end);

         // Update pagination info
         document.getElementById('stock-page-info').textContent =
             `${start + 1}-${Math.min(end, stockData.length)} of ${stockData.length}`;

         // Process stock data for summary
         const stockSummary = {};

         stockData.forEach(stock => {
             const key = `${stock.name}`;

             if (!stockSummary[key]) {
                 stockSummary[key] = {
                     name: stock.name,
                     category: stock.category,
                     totalQuantity: 0,
                     totalValue: 0,
                     entries: []
                 };
             }

             stockSummary[key].totalQuantity += stock.quantity;
             stockSummary[key].totalValue += stock.quantity * stock.price;
             stockSummary[key].entries.push(stock);
         });

         // Update stock summary table
         const summaryTableBody = document.getElementById('stock-summary-body');
         summaryTableBody.innerHTML = '';

         Object.values(stockSummary).forEach(item => {
             if (item.totalQuantity > 0) {
                 const averagePrice = item.totalValue / item.totalQuantity;

                 const row = document.createElement('tr');
                 row.innerHTML = `
                     <td>${item.name}</td>
                     <td>${item.category}</td>
                     <td>${item.totalQuantity}</td>
                     <td>${formatCurrency(averagePrice)}</td>
                     <td>${formatCurrency(item.totalValue)}</td>
                 `;
                 summaryTableBody.appendChild(row);
             }
         });

         // Update stock entries table
         const entriesTableBody = document.getElementById('stock-entries-body');
         entriesTableBody.innerHTML = '';

         paginatedStockData.forEach(stock => {
             const row = document.createElement('tr');
             row.innerHTML = `
                 <td>${formatDate(stock.date)}</td>
                 <td>${stock.name}</td>
                 <td>${stock.category}</td>
                 <td>${stock.color || '-'}</td>
                 <td>${stock.quantity}</td>
                 <td>${formatCurrency(stock.price)}</td>
                 <td>${formatCurrency(stock.quantity * stock.price)}</td>
                 <td>
                     <button class="btn btn-secondary btn-sm edit-stock" data-id="${stock._id}">
                         <i class="fas fa-edit"></i>
                     </button>
                     <button  class="btn btn-danger btn-sm delete-stock" data-id="${stock._id}">
                         <i class="fas fa-trash-alt"></i>
                     </button>
                 </td>
             `;
             entriesTableBody.appendChild(row);

             // Attach event listeners to buttons
             const editBtn = row.querySelector('.edit-stock');
             const deleteBtn = row.querySelector('.delete-stock');

             editBtn.addEventListener('click', () => editStock(stock._id));
             deleteBtn.addEventListener('click', () => deleteItem(stock._id, 'stock'));
         });

     } catch (error) {
         console.error('Error loading stock data:', error);
         showToast('Error', 'Failed to load stock data', 'error');
     }
 }

 // Load Categories
 async function loadCategories() {
     try {
         categoriesData = await ipcRenderer.invoke('get-stock-categories');

         // Update category dropdown in add stock form
         const categorySelect = document.getElementById('stock-category');
         categorySelect.innerHTML = '';

         if (categoriesData.length === 0) {
             // Add default category if none exist
             const defaultCategory = { name: 'General' };
             await ipcRenderer.invoke('add-stock-category', defaultCategory);
             categoriesData.push(defaultCategory);
         }

         categoriesData.forEach(category => {
             const option = document.createElement('option');
             option.value = category.name;
             option.textContent = category.name;
             categorySelect.appendChild(option);
         });

         // Update category dropdown in filter
         const filterCategorySelect = document.getElementById('stock-filter-category');
         filterCategorySelect.innerHTML = '<option value="">All Categories</option>';

         categoriesData.forEach(category => {
             const option = document.createElement('option');
             option.value = category.name;
             option.textContent = category.name;
             filterCategorySelect.appendChild(option);
         });

     } catch (error) {
         console.error('Error loading categories:', error);
         showToast('Error', 'Failed to load categories', 'error');
     }
 }

 // Load Expense Categories
 async function loadExpenseCategories() {
     try {
         expenseCategoriesData = await ipcRenderer.invoke('get-expense-categories');

         // Update category dropdown in add expense form
         const categorySelect = document.getElementById('expense-category');
         categorySelect.innerHTML = '';

         if (expenseCategoriesData.length === 0) {
             // Add default categories if none exist
             const defaultCategories = [
                 { name: 'Shop Expense' },
                 { name: 'Car Expense' },
                 { name: 'Home Expense' },
                 { name: 'Other' }
             ];

             for (const category of defaultCategories) {
                 await ipcRenderer.invoke('add-expense-category', category);
                 expenseCategoriesData.push(category);
             }
         }

         expenseCategoriesData.forEach(category => {
             const option = document.createElement('option');
             option.value = category.name;
             option.textContent = category.name;
             categorySelect.appendChild(option);
         });

         // Update category dropdown in filter
         const filterCategorySelect = document.getElementById('expense-filter-category');
         filterCategorySelect.innerHTML = '<option value="">All Categories</option>';

         expenseCategoriesData.forEach(category => {
             const option = document.createElement('option');
             option.value = category.name;
             option.textContent = category.name;
             filterCategorySelect.appendChild(option);
         });

     } catch (error) {
         console.error('Error loading expense categories:', error);
         showToast('Error', 'Failed to load expense categories', 'error');
     }
 }

 // Add Stock Form
 document.getElementById('add-stock-form').addEventListener('submit', async (event) => {
     event.preventDefault();

     const stockData = {
         name: document.getElementById('stock-name').value,
         category: document.getElementById('stock-category').value,
         color: document.getElementById('stock-color').value,
         quantity: parseInt(document.getElementById('stock-quantity').value),
         price: parseFloat(document.getElementById('stock-price').value),
         date: document.getElementById('stock-date').value,
         addedOn: new Date().toISOString()
     };

     try {
         await ipcRenderer.invoke('add-stock', stockData);

         // Reset form and close modal
         document.getElementById('add-stock-form').reset();
         document.getElementById('stock-date').value = today;
         document.getElementById('add-stock-modal').style.display = 'none';

         // Refresh stock data
         loadStockData();
         loadDashboardData();

         showToast('Success', 'Stock added successfully');
     } catch (error) {
         console.error('Error adding stock:', error);
         showToast('Error', 'Failed to add stock', 'error');
     }
 });

 // Edit Stock
 function editStock(stockId) {
     const stock = stockData.find(item => item._id === stockId);
     if (!stock) return;

     // Load categories into select dropdown
     const categorySelect = document.getElementById('edit-stock-category');
     categorySelect.innerHTML = '';

     categoriesData.forEach(category => {
         const option = document.createElement('option');
         option.value = category.name;
         option.textContent = category.name;
         option.selected = category.name === stock.category;
         categorySelect.appendChild(option);
     });

     // Populate form with stock data
     document.getElementById('edit-stock-id').value = stock._id;
     document.getElementById('edit-stock-name').value = stock.name;
     document.getElementById('edit-stock-color').value = stock.color || '';
     document.getElementById('edit-stock-quantity').value = stock.quantity;
     document.getElementById('edit-stock-price').value = stock.price;
     document.getElementById('edit-stock-date').value = stock.date.split('T')[0];

     // Show modal
     document.getElementById('edit-stock-modal').style.display = 'flex';
 }

 // Edit Stock Form
 document.getElementById('edit-stock-form').addEventListener('submit', async (event) => {
     event.preventDefault();

     const stockId = document.getElementById('edit-stock-id').value;
     const updatedStock = {
         name: document.getElementById('edit-stock-name').value,
         category: document.getElementById('edit-stock-category').value,
         color: document.getElementById('edit-stock-color').value,
         quantity: parseInt(document.getElementById('edit-stock-quantity').value),
         price: parseFloat(document.getElementById('edit-stock-price').value),
         date: document.getElementById('edit-stock-date').value
     };

     try {
         await ipcRenderer.invoke('update-stock', stockId, updatedStock);

         // Close modal
         document.getElementById('edit-stock-modal').style.display = 'none';

         // Refresh stock data
         loadStockData();
         loadDashboardData();

         showToast('Success', 'Stock updated successfully');
     } catch (error) {
         console.error('Error updating stock:', error);
         showToast('Error', 'Failed to update stock', 'error');
     }
 });

 // Add Category Form
 document.getElementById('add-category-form').addEventListener('submit', async (event) => {
     event.preventDefault();

     const categoryData = {
         name: document.getElementById('category-name').value
     };

     try {
         await ipcRenderer.invoke('add-stock-category', categoryData);

         // Reset form and close modal
         document.getElementById('add-category-form').reset();
         document.getElementById('add-category-modal').style.display = 'none';

         // Refresh categories
         loadCategories();

         showToast('Success', 'Category added successfully');
     } catch (error) {
         console.error('Error adding category:', error);
         showToast('Error', 'Failed to add category', 'error');
     }
 });

 // Add Expense Category Form
 document.getElementById('add-expense-category-form').addEventListener('submit', async (event) => {
     event.preventDefault();

     const categoryData = {
         name: document.getElementById('expense-category-name').value
     };

     try {
         await ipcRenderer.invoke('add-expense-category', categoryData);

         // Reset form and close modal
         document.getElementById('add-expense-category-form').reset();
         document.getElementById('add-expense-category-modal').style.display = 'none';

         // Refresh categories
         loadExpenseCategories();

         showToast('Success', 'Expense category added successfully');
     } catch (error) {
         console.error('Error adding expense category:', error);
         showToast('Error', 'Failed to add expense category', 'error');
     }
 });

 // Customers Management
 async function loadCustomersData() {
     try {
         // Apply filters
         const searchTerm = filterState.customers.name || '';
         customersData = await ipcRenderer.invoke('get-customers', searchTerm);

         // Apply sorting
         customersData.sort((a, b) => {
             const field = sortState.customers.field;
             const direction = sortState.customers.direction === 'asc' ? 1 : -1;

             if (field === 'name') {
                 return a[field].localeCompare(b[field]) * direction;
             }
             // For other fields, we'll need to calculate them first
         });

         // Update pagination
         paginationState.customers.total = customersData.length;
         const start = (paginationState.customers.page - 1) * paginationState.customers.limit;
         const end = start + paginationState.customers.limit;
         const paginatedCustomersData = customersData.slice(start, end);

         // Update pagination info
         document.getElementById('customers-page-info').textContent =
             `${start + 1}-${Math.min(end, customersData.length)} of ${customersData.length}`;

         // Get ledger data for all customers to calculate totals
         const ledgerData = {};

         for (const customer of paginatedCustomersData) {
             const entries = await ipcRenderer.invoke('get-ledger', customer._id);

             let totalDebit = 0;
             let totalCredit = 0;

             entries.forEach(entry => {
                 if (entry.type === 'debit') {
                     totalDebit += entry.amount;
                 } else {
                     totalCredit += entry.amount;
                 }
             });

             ledgerData[customer._id] = {
                 totalDebit,
                 totalCredit,
                 balance: totalDebit - totalCredit
             };
         }

         // Update customers table
         const customersTableBody = document.getElementById('customers-body');
         customersTableBody.innerHTML = '';

         paginatedCustomersData.forEach(customer => {
             const data = ledgerData[customer._id] || { totalDebit: 0, totalCredit: 0, balance: 0 };

             const row = document.createElement('tr');
             row.innerHTML = `
                 <td>${customer.name}</td>
                 <td>${formatCurrency(data.totalDebit)}</td>
                 <td>${formatCurrency(data.totalCredit)}</td>
                 <td>${formatCurrency(data.balance)}</td>
                 <td>
                     <button class="btn btn-secondary btn-sm view-ledger" data-id="${customer._id}" data-name="${customer.name}">
                         <i class="fas fa-eye"></i> View
                     </button>
                     <button class="btn btn-secondary btn-sm edit-customer" data-id="${customer._id}">
                         <i class="fas fa-edit"></i>
                     </button>
                     <button class="btn btn-danger btn-sm delete-customer" data-id="${customer._id}">
                         <i class="fas fa-trash-alt"></i>
                     </button>
                 </td>
             `;
             customersTableBody.appendChild(row);

             // Attach event listeners to buttons
             const viewLedgerBtn = row.querySelector('.view-ledger');
             const editBtn = row.querySelector('.edit-customer');
             const deleteBtn = row.querySelector('.delete-customer');

             viewLedgerBtn.addEventListener('click', () => {
                 const customerId = viewLedgerBtn.getAttribute('data-id');
                 const customerName = viewLedgerBtn.getAttribute('data-name');
                 viewCustomerLedger(customerId, customerName);
             });

             editBtn.addEventListener('click', () => editCustomer(customer._id));
             deleteBtn.addEventListener('click', () => deleteItem(customer._id, 'customer'));
         });

     } catch (error) {
         console.error('Error loading customers data:', error);
         showToast('Error', 'Failed to load customers data', 'error');
     }
 }

 // Edit Customer
 function editCustomer(customerId) {
     const customer = customersData.find(item => item._id === customerId);
     if (!customer) return;

     // Populate form with customer data
     document.getElementById('edit-customer-id').value = customer._id;
     document.getElementById('edit-customer-name').value = customer.name;
     document.getElementById('edit-customer-phone').value = customer.phone || '';
     document.getElementById('edit-customer-email').value = customer.email || '';
     document.getElementById('edit-customer-address').value = customer.address || '';

     // Show modal
     document.getElementById('edit-customer-modal').style.display = 'flex';
 }

 // Edit Customer Form
 document.getElementById('edit-customer-form').addEventListener('submit', async (event) => {
     event.preventDefault();

     const customerId = document.getElementById('edit-customer-id').value;
     const updatedCustomer = {
         name: document.getElementById('edit-customer-name').value,
         phone: document.getElementById('edit-customer-phone').value,
         email: document.getElementById('edit-customer-email').value,
         address: document.getElementById('edit-customer-address').value
     };

     try {
         await ipcRenderer.invoke('update-customer', customerId, updatedCustomer);

         // Close modal
         document.getElementById('edit-customer-modal').style.display = 'none';

         // Refresh customers data
         loadCustomersData();

         showToast('Success', 'Customer updated successfully');
     } catch (error) {
         console.error('Error updating customer:', error);
         showToast('Error', 'Failed to update customer', 'error');
     }
 });

 // Add Customer Form
 document.getElementById('add-customer-form').addEventListener('submit', async (event) => {
     event.preventDefault();

     const customerData = {
         name: document.getElementById('customer-name').value,
         phone: document.getElementById('customer-phone').value,
         email: document.getElementById('customer-email').value,
         address: document.getElementById('customer-address').value,
         createdAt: new Date().toISOString()
     };

     try {
         await ipcRenderer.invoke('add-customer', customerData);

         // Reset form and close modal
         document.getElementById('add-customer-form').reset();
         document.getElementById('add-customer-modal').style.display = 'none';

         // Refresh customers data
         loadCustomersData();
         loadDashboardData();

         showToast('Success', 'Customer added successfully');
     } catch (error) {
         console.error('Error adding customer:', error);
         showToast('Error', 'Failed to add customer', 'error');
     }
 });

 // Customer Ledger
 async function viewCustomerLedger(customerId, customerName) {
     currentCustomerId = customerId;

     // Show customer ledger page
     pages.forEach(page => page.classList.remove('active'));
     document.getElementById('customer-ledger-page').classList.add('active');

     // Set customer name in title
     document.getElementById('customer-name-title').textContent = `${customerName}'s Ledger`;

     // Load ledger data
     try {
         // Apply filters
         ledgerEntries = await ipcRenderer.invoke('get-ledger', customerId, filterState.ledger);

         // Apply sorting
         ledgerEntries.sort((a, b) => {
             const field = sortState.ledger.field;
             const direction = sortState.ledger.direction === 'asc' ? 1 : -1;

             if (field === 'date') {
                 return new Date(a[field]) > new Date(b[field]) ? direction : -direction;
             } else if (field === 'title' || field === 'description' || field === 'reference' || field === 'product') {
                 return (a[field] || '').localeCompare(b[field] || '') * direction;
             } else {
                 return (a[field] - b[field]) * direction;
             }
         });

         // Update pagination
         paginationState.ledger.total = ledgerEntries.length;
         const start = (paginationState.ledger.page - 1) * paginationState.ledger.limit;
         const end = start + paginationState.ledger.limit;
         const paginatedLedgerEntries = ledgerEntries.slice(start, end);

         // Update pagination info
         document.getElementById('ledger-page-info').textContent =
             `${start + 1}-${Math.min(end, ledgerEntries.length)} of ${ledgerEntries.length}`;

         // Calculate running balance
         let runningBalance = 0;
         let totalDebit = 0;
         let totalCredit = 0;

         ledgerEntries.forEach(entry => {
             if (entry.type === 'debit') {
                 runningBalance += entry.amount;
                 totalDebit += entry.amount;
             } else {
                 runningBalance -= entry.amount;
                 totalCredit += entry.amount;
             }

             entry.balance = runningBalance;
         });

         // Update customer summary
         document.getElementById('customer-total-debit').textContent = formatCurrency(totalDebit);
         document.getElementById('customer-total-credit').textContent = formatCurrency(totalCredit);
         document.getElementById('customer-balance').textContent = formatCurrency(runningBalance);

         // Update ledger table
         const ledgerTableBody = document.getElementById('customer-ledger-body');
         ledgerTableBody.innerHTML = '';

         paginatedLedgerEntries.forEach(entry => {
             const row = document.createElement('tr');
             row.innerHTML = `
                 <td>${formatDate(entry.date)}</td>
                 <td>${entry.title}</td>
                 <td>${entry.description || '-'}</td>
                 <td>${entry.reference || '-'}</td>
                 <td>${entry.productName || '-'}</td>
                 <td>${entry.type === 'debit' ? formatCurrency(entry.amount) : '-'}</td>
                 <td>${entry.type === 'credit' ? formatCurrency(entry.amount) : '-'}</td>
                 <td>${formatCurrency(entry.balance)}</td>
                 <td>
                     <button class="btn btn-secondary btn-sm edit-transaction" data-id="${entry._id}">
                         <i class="fas fa-edit"></i>
                     </button>
                     <button class="btn btn-danger btn-sm delete-transaction" data-id="${entry._id}">
                         <i class="fas fa-trash-alt"></i>
                     </button>
                 </td>
             `;
             ledgerTableBody.appendChild(row);

             // Attach event listeners to buttons
             const editBtn = row.querySelector('.edit-transaction');
             const deleteBtn = row.querySelector('.delete-transaction');

             editBtn.addEventListener('click', () => editTransaction(entry._id));
             deleteBtn.addEventListener('click', () => deleteItem(entry._id, 'transaction'));
         });

         // Load products for transaction form
         await loadProductsForTransaction();

     } catch (error) {
         console.error('Error loading ledger data:', error);
         showToast('Error', 'Failed to load ledger data', 'error');
     }
 }

 // Edit Transaction
 function editTransaction(transactionId) {
     const transaction = ledgerEntries.find(item => item._id === transactionId);
     if (!transaction) return;

     // Populate form with transaction data
     document.getElementById('edit-transaction-id').value = transaction._id;
     document.getElementById('edit-transaction-customer-id').value = transaction.customerId;
     document.getElementById('edit-transaction-title').value = transaction.title;
     document.getElementById('edit-transaction-description').value = transaction.description || '';
     document.getElementById('edit-transaction-amount').value = transaction.amount;
     document.getElementById('edit-transaction-reference').value = transaction.reference || '';
     document.getElementById('edit-transaction-date').value = transaction.date.split('T')[0];

     // Set radio button based on type
     document.querySelector(`input[name="edit-transaction-type"][value="${transaction.type}"]`).checked = true;

     // Show modal
     document.getElementById('edit-transaction-modal').style.display = 'flex';
 }

 // Edit Transaction Form
 document.getElementById('edit-transaction-form').addEventListener('submit', async (event) => {
     event.preventDefault();

     const transactionId = document.getElementById('edit-transaction-id').value;
     const customerId = document.getElementById('edit-transaction-customer-id').value;
     const updatedTransaction = {
         title: document.getElementById('edit-transaction-title').value,
         description: document.getElementById('edit-transaction-description').value,
         amount: parseFloat(document.getElementById('edit-transaction-amount').value),
         reference: document.getElementById('edit-transaction-reference').value,
         date: document.getElementById('edit-transaction-date').value,
         type: document.querySelector('input[name="edit-transaction-type"]:checked').value
     };

     try {
         await ipcRenderer.invoke('update-ledger-entry', transactionId, updatedTransaction);

         // Close modal
         document.getElementById('edit-transaction-modal').style.display = 'none';

         // Refresh ledger data
         viewCustomerLedger(customerId, document.getElementById('customer-name-title').textContent.replace("'s Ledger", ""));

         showToast('Success', 'Transaction updated successfully');
     } catch (error) {
         console.error('Error updating transaction:', error);
         showToast('Error', 'Failed to update transaction', 'error');
     }
 });

 // Load products for transaction form
 async function loadProductsForTransaction() {
     try {
         stockData = await ipcRenderer.invoke('get-stocks');

         // Process stock data for summary (to show available products)
         const stockSummary = {};

         stockData.forEach(stock => {
             const key = `${stock.name}`;

             if (!stockSummary[key]) {
                 stockSummary[key] = {
                     id: stock._id,
                     name: stock.name,
                     category: stock.category,
                     totalQuantity: 0,
                     entries: []
                 };
             }

             stockSummary[key].totalQuantity += stock.quantity;
             stockSummary[key].entries.push(stock);
         });

         // Update product dropdown in add transaction form
         const productSelect = document.getElementById('transaction-product');

         // Clear existing options except the first one
         while (productSelect.options.length > 1) {
             productSelect.remove(1);
         }

         // Add products with quantity > 0
         Object.values(stockSummary)
             .filter(product => product.totalQuantity > 0)
             .forEach(product => {
                 const option = document.createElement('option');
                 option.value = product.id;
                 option.textContent = `${product.name} (${product.totalQuantity} available)`;
                 option.dataset.quantity = product.totalQuantity;
                 option.dataset.name = product.name;
                 productSelect.appendChild(option);
             });

     } catch (error) {
         console.error('Error loading products for transaction:', error);
     }
 }

 // Back to Ledger button
 document.getElementById('back-to-ledger-btn').addEventListener('click', () => {
     pages.forEach(page => page.classList.remove('active'));
     document.getElementById('ledger-page').classList.add('active');

     // Update active nav item
     navItems.forEach(nav => nav.classList.remove('active'));
     document.querySelector('[data-page="ledger"]').classList.add('active');

     // Reset current customer
     currentCustomerId = null;
 });

 // Product quantity toggle in transaction form
 document.getElementById('transaction-product').addEventListener('change', function () {
     const productQuantityGroup = document.getElementById('product-quantity-group');

     if (this.value) {
         productQuantityGroup.style.display = 'block';

         // Get max available quantity
         const selectedOption = this.options[this.selectedIndex];
         const maxQuantity = parseInt(selectedOption.dataset.quantity);

         // Set max attribute on quantity input
         const quantityInput = document.getElementById('product-quantity');
         quantityInput.max = maxQuantity;
         quantityInput.value = 1;
     } else {
         productQuantityGroup.style.display = 'none';
     }
 });

 // Add Transaction Form
 document.getElementById('add-transaction-form').addEventListener('submit', async (event) => {
     event.preventDefault();

     // Get selected product info
     const productSelect = document.getElementById('transaction-product');
     let productId = null;
     let productName = null;
     let productQuantity = null;

     if (productSelect.value) {
         productId = productSelect.value;
         const selectedOption = productSelect.options[productSelect.selectedIndex];
         productName = selectedOption.dataset.name;
         productQuantity = parseInt(document.getElementById('product-quantity').value);
     }

     const transactionData = {
         customerId: currentCustomerId,
         title: document.getElementById('transaction-title').value,
         description: document.getElementById('transaction-description').value,
         amount: parseFloat(document.getElementById('transaction-amount').value),
         reference: document.getElementById('transaction-reference').value,
         date: document.getElementById('transaction-date').value,
         type: document.querySelector('input[name="transaction-type"]:checked').value,
         productId,
         productName,
         productQuantity,
         createdAt: new Date().toISOString()
     };

     try {
         await ipcRenderer.invoke('add-ledger-entry', transactionData);

         // Reset form and close modal
         document.getElementById('add-transaction-form').reset();
         document.getElementById('transaction-date').value = today;
         document.getElementById('add-transaction-modal').style.display = 'none';

         // Refresh ledger data
         viewCustomerLedger(currentCustomerId, document.getElementById('customer-name-title').textContent.replace("'s Ledger", ""));

         showToast('Success', 'Transaction added successfully');
     } catch (error) {
         console.error('Error adding transaction:', error);
         showToast('Error', 'Failed to add transaction', 'error');
     }
 });

 // Expenses Management
 async function loadExpensesData() {
     try {
         // Apply filters
         expensesData = await ipcRenderer.invoke('get-expenses', filterState.expenses);
         expenseCategoriesData = await ipcRenderer.invoke('get-expense-categories');

         // Apply sorting
         expensesData.sort((a, b) => {
             const field = sortState.expenses.field;
             const direction = sortState.expenses.direction === 'asc' ? 1 : -1;

             if (field === 'date') {
                 return new Date(a[field]) > new Date(b[field]) ? direction : -direction;
             } else if (field === 'category' || field === 'title' || field === 'description') {
                 return (a[field] || '').localeCompare(b[field] || '') * direction;
             } else {
                 return (a[field] - b[field]) * direction;
             }
         });

         // Update pagination
         paginationState.expenses.total = expensesData.length;
         const start = (paginationState.expenses.page - 1) * paginationState.expenses.limit;
         const end = start + paginationState.expenses.limit;
         const paginatedExpensesData = expensesData.slice(start, end);

         // Update pagination info
         document.getElementById('expenses-page-info').textContent =
             `${start + 1}-${Math.min(end, expensesData.length)} of ${expensesData.length}`;

         // Calculate category totals
         const categorySummary = {};
         expenseCategoriesData.forEach(category => {
             categorySummary[category.name] = {
                 debit: 0,
                 credit: 0
             };
         });

         expensesData.forEach(expense => {
             if (!categorySummary[expense.category]) {
                 categorySummary[expense.category] = {
                     debit: 0,
                     credit: 0
                 };
             }

             if (expense.type === 'debit') {
                 categorySummary[expense.category].debit += expense.amount;
             } else {
                 categorySummary[expense.category].credit += expense.amount;
             }
         });

         // Update expense summary
         const expenseSummary = document.getElementById('expense-summary');
         expenseSummary.innerHTML = '';

         // Create a grid for summary boxes
         const summaryGrid = document.createElement('div');
         summaryGrid.className = 'grid';
         expenseSummary.appendChild(summaryGrid);

         // Calculate totals
         let totalDebit = 0;
         let totalCredit = 0;

         // Add category summary boxes
         Object.entries(categorySummary).forEach(([category, data]) => {
             totalDebit += data.debit;
             totalCredit += data.credit;

             const box = document.createElement('div');
             box.className = 'summary-box';
             box.innerHTML = `
                 <div class="summary-box-icon">
                     <i class="fas fa-tag"></i>
                 </div>
                 <div class="summary-box-content">
                     <h3>${category}</h3>
                     <p>Expense: ${formatCurrency(data.debit)} | Income: ${formatCurrency(data.credit)}</p>
                     <p>Net: ${formatCurrency(data.credit - data.debit)}</p>
                 </div>
             `;
             summaryGrid.appendChild(box);
         });

         // Add total summary box
         const totalBox = document.createElement('div');
         totalBox.className = 'summary-box';
         totalBox.innerHTML = `
             <div class="summary-box-icon">
                 <i class="fas fa-calculator"></i>
             </div>
             <div class="summary-box-content">
                 <h3>Total</h3>
                 <p>Expense: ${formatCurrency(totalDebit)} | Income: ${formatCurrency(totalCredit)}</p>
                 <p>Net: ${formatCurrency(totalCredit - totalDebit)}</p>
             </div>
         `;
         summaryGrid.appendChild(totalBox);

         // Update expenses table
         const expensesTableBody = document.getElementById('expenses-body');
         expensesTableBody.innerHTML = '';

         paginatedExpensesData.forEach(expense => {
             const row = document.createElement('tr');
             row.innerHTML = `
                 <td>${formatDate(expense.date)}</td>
                 <td>${expense.category}</td>
                 <td>${expense.title}</td>
                 <td>${expense.description || '-'}</td>
                 <td>${formatCurrency(expense.amount)}</td>
                 <td>
                     <span class="badge ${expense.type === 'debit' ? 'badge-danger' : 'badge-success'}">
                         ${expense.type === 'debit' ? 'Expense' : 'Income'}
                     </span>
                 </td>
                 <td>
                     <button class="btn btn-secondary btn-sm edit-expense" data-id="${expense._id}">
                         <i class="fas fa-edit"></i>
                     </button>
                     <button class="btn btn-danger btn-sm delete-expense" data-id="${expense._id}">
                         <i class="fas fa-trash-alt"></i>
                     </button>
                 </td>
             `;
             expensesTableBody.appendChild(row);

             // Attach event listeners to buttons
             const editBtn = row.querySelector('.edit-expense');
             const deleteBtn = row.querySelector('.delete-expense');

             editBtn.addEventListener('click', () => editExpense(expense._id));
             deleteBtn.addEventListener('click', () => deleteItem(expense._id, 'expense'));
         });

     } catch (error) {
         console.error('Error loading expenses data:', error);
         showToast('Error', 'Failed to load expenses data', 'error');
     }
 }

 // Edit Expense
 function editExpense(expenseId) {
     const expense = expensesData.find(item => item._id === expenseId);
     if (!expense) return;

     // Load categories into select dropdown
     const categorySelect = document.getElementById('edit-expense-category');
     categorySelect.innerHTML = '';

     expenseCategoriesData.forEach(category => {
         const option = document.createElement('option');
         option.value = category.name;
         option.textContent = category.name;
         option.selected = category.name === expense.category;
         categorySelect.appendChild(option);
     });

     // Populate form with expense data
     document.getElementById('edit-expense-id').value = expense._id;
     document.getElementById('edit-expense-title').value = expense.title;
     document.getElementById('edit-expense-description').value = expense.description || '';
     document.getElementById('edit-expense-amount').value = expense.amount;
     document.getElementById('edit-expense-date').value = expense.date.split('T')[0];

     // Set radio button based on type
     document.querySelector(`input[name="edit-expense-type"][value="${expense.type}"]`).checked = true;

     // Show modal
     document.getElementById('edit-expense-modal').style.display = 'flex';
 }

 // Edit Expense Form
 document.getElementById('edit-expense-form').addEventListener('submit', async (event) => {
     event.preventDefault();

     const expenseId = document.getElementById('edit-expense-id').value;
     const updatedExpense = {
         category: document.getElementById('edit-expense-category').value,
         title: document.getElementById('edit-expense-title').value,
         description: document.getElementById('edit-expense-description').value,
         amount: parseFloat(document.getElementById('edit-expense-amount').value),
         date: document.getElementById('edit-expense-date').value,
         type: document.querySelector('input[name="edit-expense-type"]:checked').value
     };

     try {
         await ipcRenderer.invoke('update-expense', expenseId, updatedExpense);

         // Close modal
         document.getElementById('edit-expense-modal').style.display = 'none';

         // Refresh expense data
         loadExpensesData();
         loadDashboardData();

         showToast('Success', 'Expense updated successfully');
     } catch (error) {
         console.error('Error updating expense:', error);
         showToast('Error', 'Failed to update expense', 'error');
     }
 });

 // Add Expense Form
 document.getElementById('add-expense-form').addEventListener('submit', async (event) => {
     event.preventDefault();

     const expenseData = {
         category: document.getElementById('expense-category').value,
         title: document.getElementById('expense-title').value,
         description: document.getElementById('expense-description').value,
         amount: parseFloat(document.getElementById('expense-amount').value),
         date: document.getElementById('expense-date').value,
         type: document.querySelector('input[name="expense-type"]:checked').value,
         createdAt: new Date().toISOString()
     };

     try {
         await ipcRenderer.invoke('add-expense', expenseData);

         // Reset form and close modal
         document.getElementById('add-expense-form').reset();
         document.getElementById('expense-date').value = today;
         document.getElementById('add-expense-modal').style.display = 'none';

         // Refresh expenses data
         loadExpensesData();
         loadDashboardData();

         showToast('Success', 'Expense added successfully');
     } catch (error) {
         console.error('Error adding expense:', error);
         showToast('Error', 'Failed to add expense', 'error');
     }
 });

 // Delete Item
 function deleteItem(itemId, itemType) {
     document.getElementById('delete-item-id').value = itemId;
     document.getElementById('delete-item-type').value = itemType;
     document.getElementById('delete-confirmation-modal').style.display = 'flex';
 }

 // Delete Confirmation
 document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
     const itemId = document.getElementById('delete-item-id').value;
     const itemType = document.getElementById('delete-item-type').value;

     try {
         let success = false;

         if (itemType === 'stock') {
             success = await ipcRenderer.invoke('delete-stock', itemId);
             if (success) loadStockData();
         } else if (itemType === 'customer') {
             success = await ipcRenderer.invoke('delete-customer', itemId);
             if (success) loadCustomersData();
         } else if (itemType === 'transaction') {
             success = await ipcRenderer.invoke('delete-ledger-entry', itemId);
             if (success) {
                 viewCustomerLedger(currentCustomerId, document.getElementById('customer-name-title').textContent.replace("'s Ledger", ""));
             }
         } else if (itemType === 'expense') {
             success = await ipcRenderer.invoke('delete-expense', itemId);
             if (success) loadExpensesData();
         }

         // Close modal
         document.getElementById('delete-confirmation-modal').style.display = 'none';

         // Refresh dashboard
         loadDashboardData();

         if (success) {
             showToast('Success', 'Item deleted successfully');
         } else {
             showToast('Error', 'Failed to delete item', 'error');
         }
     } catch (error) {
         console.error('Error deleting item:', error);
         showToast('Error', 'Failed to delete item', 'error');
     }
 });

 // Cancel Delete
 document.getElementById('cancel-delete-btn').addEventListener('click', () => {
     document.getElementById('delete-confirmation-modal').style.display = 'none';
 });

 // PDF Generation
 document.getElementById('generate-pdf-form').addEventListener('submit', async (event) => {
     event.preventDefault();

     const startDate = document.getElementById('pdf-start-date').value;
     const endDate = document.getElementById('pdf-end-date').value;

     // Determine which page is active to know which report to generate
     let reportType = '';
     let pageTitle = '';

     if (document.getElementById('stock-page').classList.contains('active')) {
         reportType = 'stock';
         pageTitle = 'Stock Report';
     } else if (document.getElementById('ledger-page').classList.contains('active')) {
         reportType = 'ledger';
         pageTitle = 'Customers Report';
     } else if (document.getElementById('customer-ledger-page').classList.contains('active')) {
         reportType = 'customer-ledger';
         pageTitle = 'Customer Ledger Report';
     } else if (document.getElementById('transactions-page').classList.contains('active')) {
         reportType = 'expense';
         pageTitle = 'Expense Report';
     }

     try {
         // Ensure jsPDF and autoTable are available
         if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
             throw new Error('jsPDF library not loaded properly');
         }

         // Initialize jsPDF
         const { jsPDF } = window.jspdf;
         const doc = new jsPDF();

         // Ensure autoTable plugin is available
         if (typeof doc.autoTable !== 'function') {
             throw new Error('AutoTable plugin not loaded properly');
         }

         // Add header
         doc.setFontSize(18);
         doc.text(pageTitle, 14, 22);

         // Add date range
         doc.setFontSize(10);
         doc.text(`Period: ${formatDate(startDate)} - ${formatDate(endDate)}`, 14, 30);
         doc.text(`Generated on: ${formatDate(new Date())}`, 14, 36);
         doc.text(`Generated by: itshassanraza`, 14, 42);

         // Generate report based on type
         if (reportType === 'stock') {
             // Filter stock data by date range
             const filteredStocks = stockData.filter(stock => {
                 const stockDate = new Date(stock.date);
                 return stockDate >= new Date(startDate) && stockDate <= new Date(endDate);
             });

             // Process stock data for summary
             const stockSummary = {};

             filteredStocks.forEach(stock => {
                 const key = `${stock.name}`;

                 if (!stockSummary[key]) {
                     stockSummary[key] = {
                         name: stock.name,
                         category: stock.category,
                         totalQuantity: 0,
                         totalValue: 0
                     };
                 }

                 stockSummary[key].totalQuantity += stock.quantity;
                 stockSummary[key].totalValue += stock.quantity * stock.price;
             });

             // Generate summary table
             doc.autoTable({
                 startY: 48,
                 head: [['Item Name', 'Category', 'Total Quantity', 'Average Price', 'Value']],
                 body: Object.values(stockSummary).map(item => [
                     item.name,
                     item.category,
                     item.totalQuantity,
                     formatCurrency(item.totalValue / item.totalQuantity),
                     formatCurrency(item.totalValue)
                 ]),
                 headStyles: { fillColor: [0, 0, 0] }
             });

             // Generate entries table
             const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 48;

             doc.autoTable({
                 startY: finalY + 15,
                 head: [['Date', 'Item Name', 'Category', 'Color', 'Quantity', 'Price', 'Total']],
                 body: filteredStocks.map(stock => [
                     formatDate(stock.date),
                     stock.name,
                     stock.category,
                     stock.color || '-',
                     stock.quantity,
                     formatCurrency(stock.price),
                     formatCurrency(stock.quantity * stock.price)
                 ]),
                 headStyles: { fillColor: [0, 0, 0] }
             });

         } else if (reportType === 'ledger') {
             // Generate customers summary
             const tableData = [];

             for (const customer of customersData) {
                 const entries = await ipcRenderer.invoke('get-ledger', customer._id);

                 // Filter by date range
                 const filteredEntries = entries.filter(entry => {
                     const entryDate = new Date(entry.date);
                     return entryDate >= new Date(startDate) && entryDate <= new Date(endDate);
                 });

                 let totalDebit = 0;
                 let totalCredit = 0;

                 filteredEntries.forEach(entry => {
                     if (entry.type === 'debit') {
                         totalDebit += entry.amount;
                     } else {
                         totalCredit += entry.amount;
                     }
                 });

                 tableData.push([
                     customer.name,
                     formatCurrency(totalDebit),
                     formatCurrency(totalCredit),
                     formatCurrency(totalDebit - totalCredit)
                 ]);
             }

             doc.autoTable({
                 startY: 48,
                 head: [['Customer Name', 'Total Debit', 'Total Credit', 'Balance']],
                 body: tableData,
                 headStyles: { fillColor: [0, 0, 0] }
             });

         } else if (reportType === 'customer-ledger') {
             // Get customer name
             const customerName = document.getElementById('customer-name-title').textContent.replace("'s Ledger", "");

             // Get ledger entries
             const entries = await ipcRenderer.invoke('get-ledger', currentCustomerId);

             // Filter by date range
             const filteredEntries = entries.filter(entry => {
                 const entryDate = new Date(entry.date);
                 return entryDate >= new Date(startDate) && entryDate <= new Date(endDate);
             });

             // Sort by date
             filteredEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

             // Calculate running balance
             let runningBalance = 0;
             let totalDebit = 0;
             let totalCredit = 0;

             const tableData = filteredEntries.map(entry => {
                 if (entry.type === 'debit') {
                     runningBalance += entry.amount;
                     totalDebit += entry.amount;
                 } else {
                     runningBalance -= entry.amount;
                     totalCredit += entry.amount;
                 }

                 return [
                     formatDate(entry.date),
                     entry.title,
                     entry.description || '-',
                     entry.reference || '-',
                     entry.productName || '-',
                     entry.type === 'debit' ? formatCurrency(entry.amount) : '-',
                     entry.type === 'credit' ? formatCurrency(entry.amount) : '-',
                     formatCurrency(runningBalance)
                 ];
             });

             // Update title with customer name
             doc.setFontSize(18);
             doc.text(`${customerName}'s Ledger Report`, 14, 22);

             // Add summary
             doc.setFontSize(12);
             doc.text(`Total Debit: ${formatCurrency(totalDebit)}`, 14, 48);
             doc.text(`Total Credit: ${formatCurrency(totalCredit)}`, 14, 55);
             doc.text(`Balance: ${formatCurrency(totalDebit - totalCredit)}`, 14, 62);

             doc.autoTable({
                 startY: 68,
                 head: [['Date', 'Title', 'Description', 'Reference', 'Product', 'Debit', 'Credit', 'Balance']],
                 body: tableData,
                 headStyles: { fillColor: [0, 0, 0] }
             });

         } else if (reportType === 'expense') {
             // Filter expenses by date range
             const filteredExpenses = expensesData.filter(expense => {
                 const expenseDate = new Date(expense.date);
                 return expenseDate >= new Date(startDate) && expenseDate <= new Date(endDate);
             });

             // Calculate category totals
             const categorySummary = {};

             filteredExpenses.forEach(expense => {
                 if (!categorySummary[expense.category]) {
                     categorySummary[expense.category] = {
                         debit: 0,
                         credit: 0
                     };
                 }

                 if (expense.type === 'debit') {
                     categorySummary[expense.category].debit += expense.amount;
                 } else {
                     categorySummary[expense.category].credit += expense.amount;
                 }
             });

             // Generate summary table
             const summaryData = Object.entries(categorySummary).map(([category, data]) => [
                 category,
                 formatCurrency(data.debit),
                 formatCurrency(data.credit),
                 formatCurrency(data.credit - data.debit)
             ]);

             // Calculate totals
             let totalDebit = 0;
             let totalCredit = 0;

             Object.values(categorySummary).forEach(data => {
                 totalDebit += data.debit;
                 totalCredit += data.credit;
             });

             // Add totals row
             summaryData.push([
                 'TOTAL',
                 formatCurrency(totalDebit),
                 formatCurrency(totalCredit),
                 formatCurrency(totalCredit - totalDebit)
             ]);

             doc.autoTable({
                 startY: 48,
                 head: [['Category', 'Expense', 'Income', 'Net']],
                 body: summaryData,
                 headStyles: { fillColor: [0, 0, 0] }
             });

             // Generate entries table
             const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 48;

             doc.autoTable({
                 startY: finalY + 15,
                 head: [['Date', 'Category', 'Title', 'Description', 'Amount', 'Type']],
                 body: filteredExpenses.map(expense => [
                     formatDate(expense.date),
                     expense.category,
                     expense.title,
                     expense.description || '-',
                     formatCurrency(expense.amount),
                     expense.type === 'debit' ? 'Expense' : 'Income'
                 ]),
                 headStyles: { fillColor: [0, 0, 0] }
             });
         }

         // Save the PDF
         doc.save(`${pageTitle.toLowerCase().replace(/\s+/g, '-')}-${startDate}-to-${endDate}.pdf`);

         // Close modal
         document.getElementById('generate-pdf-modal').style.display = 'none';

         showToast('Success', 'PDF generated successfully');
     } catch (error) {
         console.error('Error generating PDF:', error);
         showToast('Error', `Failed to generate PDF: ${error.message}`, 'error');
     }
 });

 // Backup and Restore
 document.getElementById('backup-btn').addEventListener('click', async () => {
     try {
         const result = await ipcRenderer.invoke('create-backup');

         if (result.success) {
             showToast('Success', result.message);
         } else {
             showToast('Error', result.message, 'error');
         }
     } catch (error) {
         console.error('Error creating backup:', error);
         showToast('Error', 'Failed to create backup', 'error');
     }
 });

 document.getElementById('restore-btn').addEventListener('click', async () => {
     try {
         const result = await ipcRenderer.invoke('restore-backup');

         if (result.success) {
             showToast('Success', result.message);

             // Refresh data
             loadDashboardData();
             loadCategories();
             loadExpenseCategories();
         } else {
             showToast('Error', result.message, 'error');
         }
     } catch (error) {
         console.error('Error restoring backup:', error);
         showToast('Error', 'Failed to restore backup', 'error');
     }
 });

 // Update current date and time in the footer
 const usernamePlaceholder = document.querySelector('.font-medium');
 const datePlaceholder = document.querySelector('.text-xs.text-gray-500');

 usernamePlaceholder.textContent = 'itshassanraza';
 const now = new Date();
 datePlaceholder.textContent = now.toISOString().split('T')[0];
