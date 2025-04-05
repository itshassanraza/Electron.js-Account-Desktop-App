const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Datastore = require('nedb');

// Initialize databases
const db = {
  stocks: new Datastore({ filename: path.join(app.getPath('userData'), 'stocks.db'), autoload: true }),
  categories: new Datastore({ filename: path.join(app.getPath('userData'), 'categories.db'), autoload: true }),
  customers: new Datastore({ filename: path.join(app.getPath('userData'), 'customers.db'), autoload: true }),
  ledger: new Datastore({ filename: path.join(app.getPath('userData'), 'ledger.db'), autoload: true }),
  expenses: new Datastore({ filename: path.join(app.getPath('userData'), 'expenses.db'), autoload: true }),
  expenseCategories: new Datastore({ filename: path.join(app.getPath('userData'), 'expenseCategories.db'), autoload: true })
};

// Create the browser window
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  // Load the index.html file
  mainWindow.loadFile('index.html');
  
  // Open DevTools in development
  // mainWindow.webContents.openDevTools();
}

// App is ready to start
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers for database operations
// Stock Management
ipcMain.handle('get-stocks', async () => {
  return new Promise((resolve, reject) => {
    db.stocks.find({}).sort({ date: -1 }).exec((err, stocks) => {
      if (err) reject(err);
      resolve(stocks);
    });
  });
});

ipcMain.handle('add-stock', async (event, stockData) => {
  return new Promise((resolve, reject) => {
    db.stocks.insert(stockData, (err, newStock) => {
      if (err) reject(err);
      resolve(newStock);
    });
  });
});

ipcMain.handle('get-stock-categories', async () => {
  return new Promise((resolve, reject) => {
    db.categories.find({}).exec((err, categories) => {
      if (err) reject(err);
      resolve(categories);
    });
  });
});

ipcMain.handle('add-stock-category', async (event, categoryData) => {
  return new Promise((resolve, reject) => {
    db.categories.insert(categoryData, (err, newCategory) => {
      if (err) reject(err);
      resolve(newCategory);
    });
  });
});

// Customer and Ledger Management
ipcMain.handle('get-customers', async () => {
  return new Promise((resolve, reject) => {
    db.customers.find({}).exec((err, customers) => {
      if (err) reject(err);
      resolve(customers);
    });
  });
});

ipcMain.handle('add-customer', async (event, customerData) => {
  return new Promise((resolve, reject) => {
    db.customers.insert(customerData, (err, newCustomer) => {
      if (err) reject(err);
      resolve(newCustomer);
    });
  });
});

ipcMain.handle('get-ledger', async (event, customerId) => {
  return new Promise((resolve, reject) => {
    db.ledger.find({ customerId: customerId }).sort({ date: -1 }).exec((err, entries) => {
      if (err) reject(err);
      resolve(entries);
    });
  });
});

ipcMain.handle('add-ledger-entry', async (event, ledgerData) => {
  return new Promise((resolve, reject) => {
    db.ledger.insert(ledgerData, (err, newEntry) => {
      if (err) reject(err);
      resolve(newEntry);
      
      // Update stock if product is selected
      if (ledgerData.productId) {
        db.stocks.findOne({ _id: ledgerData.productId }, (err, stock) => {
          if (err || !stock) return;
          
          const newQuantity = ledgerData.type === 'debit' 
            ? stock.quantity - ledgerData.productQuantity 
            : stock.quantity + ledgerData.productQuantity;
          
          db.stocks.update(
            { _id: ledgerData.productId }, 
            { $set: { quantity: newQuantity } }
          );
        });
      }
    });
  });
});

// Expense Management
ipcMain.handle('get-expense-categories', async () => {
  return new Promise((resolve, reject) => {
    db.expenseCategories.find({}).exec((err, categories) => {
      if (err) reject(err);
      resolve(categories);
    });
  });
});

ipcMain.handle('add-expense-category', async (event, categoryData) => {
  return new Promise((resolve, reject) => {
    db.expenseCategories.insert(categoryData, (err, newCategory) => {
      if (err) reject(err);
      resolve(newCategory);
    });
  });
});

ipcMain.handle('get-expenses', async () => {
  return new Promise((resolve, reject) => {
    db.expenses.find({}).sort({ date: -1 }).exec((err, expenses) => {
      if (err) reject(err);
      resolve(expenses);
    });
  });
});

ipcMain.handle('add-expense', async (event, expenseData) => {
  return new Promise((resolve, reject) => {
    db.expenses.insert(expenseData, (err, newExpense) => {
      if (err) reject(err);
      resolve(newExpense);
    });
  });
});

// Backup and Restore
ipcMain.handle('create-backup', async () => {
  const backupPath = dialog.showSaveDialogSync({
    title: 'Create Backup',
    defaultPath: path.join(app.getPath('documents'), `sms-backup-${new Date().toISOString().slice(0, 10)}.json`),
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  
  if (!backupPath) return { success: false, message: 'Backup cancelled' };
  
  try {
    const backup = {};
    for (const [key, value] of Object.entries(db)) {
      const data = await new Promise((resolve, reject) => {
        value.find({}, (err, docs) => {
          if (err) reject(err);
          resolve(docs);
        });
      });
      backup[key] = data;
    }
    
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    return { success: true, message: 'Backup created successfully!' };
  } catch (error) {
    return { success: false, message: `Error creating backup: ${error.message}` };
  }
});

ipcMain.handle('restore-backup', async () => {
  const result = dialog.showOpenDialogSync({
    title: 'Restore Backup',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  
  if (!result || !result[0]) return { success: false, message: 'Restore cancelled' };
  
  try {
    const backupData = JSON.parse(fs.readFileSync(result[0], 'utf8'));
    
    for (const [key, value] of Object.entries(backupData)) {
      if (!db[key]) continue;
      
      await new Promise((resolve, reject) => {
        db[key].remove({}, { multi: true }, (err) => {
          if (err) reject(err);
          
          const insertions = value.map(doc => 
            new Promise((res, rej) => {
              db[key].insert(doc, (err) => {
                if (err) rej(err);
                res();
              });
            })
          );
          
          Promise.all(insertions).then(resolve).catch(reject);
        });
      });
    }
    
    return { success: true, message: 'Backup restored successfully!' };
  } catch (error) {
    return { success: false, message: `Error restoring backup: ${error.message}` };
  }
});