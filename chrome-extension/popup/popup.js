const BACKEND_URL = "http://localhost:3000";

// Helper to show status messages
function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  if (type !== 'error') {
    setTimeout(() => {
      statusEl.className = 'status';
    }, 5000);
  }
}

// Store current page URL for filtering
let currentPageUrl = '';

// Store selected file
let selectedFile = null;

/* ==================== FILE UPLOAD FUNCTIONALITY ==================== */

// Handle file selection
document.getElementById('fileInput').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) {
    selectedFile = null;
    document.getElementById('fileInfo').classList.remove('show');
    document.getElementById('uploadFileBtn').classList.remove('show');
    return;
  }

  selectedFile = file;
  const fileSize = (file.size / 1024).toFixed(2); // KB
  const fileInfo = document.getElementById('fileInfo');
  fileInfo.textContent = `📎 ${file.name} (${fileSize} KB)`;
  fileInfo.classList.add('show');
  document.getElementById('uploadFileBtn').classList.add('show');
  
  console.log('File selected:', file.name, file.type);
});

// Extract text from PDF using PDF.js
async function extractTextFromPDF(file) {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    
    fileReader.onload = async function() {
      try {
        const typedArray = new Uint8Array(this.result);
        
        // Configure PDF.js worker (local)
        pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('libs/pdf.worker.min.js');
        
        // Load the PDF
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        console.log(`PDF loaded: ${pdf.numPages} pages`);
        
        let fullText = '';
        
        // Extract text from each page
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
          
          // Update status during extraction
          showStatus(`📄 Extracting page ${pageNum}/${pdf.numPages}...`, 'info');
        }
        
        console.log(`Extracted ${fullText.length} characters from PDF`);
        resolve(fullText);
      } catch (error) {
        console.error('PDF extraction error:', error);
        reject(new Error('Failed to extract text from PDF: ' + error.message));
      }
    };
    
    fileReader.onerror = () => reject(new Error('Failed to read PDF file'));
    fileReader.readAsArrayBuffer(file);
  });
}

// Extract text from CSV
async function extractTextFromCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target.result;
        // Convert CSV to readable format
        const lines = csvText.split('\n');
        const formatted = lines
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map(line => line.replace(/,/g, ' | ')) // Replace commas with pipes for better readability
          .join('\n');
        
        console.log(`Extracted ${formatted.length} characters from CSV`);
        resolve(formatted);
      } catch (error) {
        reject(new Error('Failed to parse CSV: ' + error.message));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read CSV file'));
    reader.readAsText(file);
  });
}

// Extract text from plain text file
async function extractTextFromText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      console.log(`Extracted ${text.length} characters from text file`);
      resolve(text);
    };
    reader.onerror = () => reject(new Error('Failed to read text file'));
    reader.readAsText(file);
  });
}

// Extract text from Excel files (XLSX, XLS)
async function extractTextFromExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        console.log(`Excel workbook loaded: ${workbook.SheetNames.length} sheets`);
        
        let fullText = '';
        
        // Extract text from each sheet
        workbook.SheetNames.forEach((sheetName, index) => {
          const worksheet = workbook.Sheets[sheetName];
          
          // Convert sheet to CSV format (preserves structure)
          const csvText = XLSX.utils.sheet_to_csv(worksheet);
          
          if (csvText.trim().length > 0) {
            fullText += `\n--- Sheet: ${sheetName} ---\n`;
            // Convert CSV commas to pipes for better readability
            const formatted = csvText
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0)
              .map(line => line.replace(/,/g, ' | '))
              .join('\n');
            fullText += formatted + '\n';
          }
          
          console.log(`  Sheet ${index + 1} (${sheetName}): ${csvText.length} characters`);
        });
        
        console.log(`Extracted ${fullText.length} characters from Excel file`);
        resolve(fullText);
      } catch (error) {
        console.error('Excel extraction error:', error);
        reject(new Error('Failed to extract text from Excel: ' + error.message));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read Excel file'));
    reader.readAsArrayBuffer(file);
  });
}

// Handle file upload and indexing
document.getElementById('uploadFileBtn').addEventListener('click', async () => {
  if (!selectedFile) {
    showStatus('⚠️ Please select a file first', 'error');
    return;
  }

  const btn = document.getElementById('uploadFileBtn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Processing...';

  try {
    showStatus(`📂 Reading ${selectedFile.name}...`, 'info');
    
    let extractedText = '';
    const fileType = selectedFile.type;
    const fileName = selectedFile.name.toLowerCase();
    
    // Debug logging
    console.log('File details:', {
      name: selectedFile.name,
      type: fileType,
      size: selectedFile.size,
      fileName: fileName
    });
    
    // Determine file type - CHECK EXTENSION FIRST (more reliable than MIME type)
    if (fileName.endsWith('.pdf')) {
      console.log('Detected as PDF (by extension)');
      extractedText = await extractTextFromPDF(selectedFile);
    } 
    else if (fileName.endsWith('.csv')) {
      console.log('Detected as CSV (by extension)');
      extractedText = await extractTextFromCSV(selectedFile);
    }
    else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      console.log('Detected as Excel (by extension)');
      showStatus('📊 Reading Excel file...', 'info');
      extractedText = await extractTextFromExcel(selectedFile);
    }
    else if (fileName.endsWith('.txt')) {
      console.log('Detected as TXT (by extension)');
      extractedText = await extractTextFromText(selectedFile);
    }
    else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
      showStatus('⚠️ Word docs: Please save as PDF or TXT first, then upload', 'error');
      throw new Error('Please convert Word to PDF or TXT first (File → Save As → PDF/TXT)');
    }
    // Fallback to MIME type if extension doesn't match
    else if (fileType === 'application/pdf') {
      console.log('Detected as PDF (by MIME type)');
      extractedText = await extractTextFromPDF(selectedFile);
    }
    else if (fileType === 'text/csv') {
      console.log('Detected as CSV (by MIME type)');
      extractedText = await extractTextFromCSV(selectedFile);
    }
    else if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
             fileType === 'application/vnd.ms-excel') {
      console.log('Detected as Excel (by MIME type)');
      showStatus('📊 Reading Excel file...', 'info');
      extractedText = await extractTextFromExcel(selectedFile);
    }
    else if (fileType && fileType.startsWith('text/')) {
      console.log('Detected as text file (by MIME type)');
      extractedText = await extractTextFromText(selectedFile);
    }
    else {
      console.error('Unsupported file type:', fileType, 'filename:', fileName);
      throw new Error(`Unsupported file type: "${fileType || 'unknown'}" for file "${selectedFile.name}". Supported: .pdf, .csv, .xlsx, .xls, .txt`);
    }

    if (!extractedText || extractedText.trim().length < 20) {
      throw new Error(`File appears to be empty or could not extract text (got ${extractedText.length} chars)`);
    }

    showStatus(`✅ Extracted ${extractedText.length} characters. Sending to backend...`, 'info');

    // Send to backend for indexing
    const clearPrevious = document.getElementById('clearBeforeIndex').checked;
    const resp = await fetch(`${BACKEND_URL}/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: extractedText,
        source: `file:${selectedFile.name}`,
        clearPrevious: clearPrevious
      })
    });

    const data = await resp.json();
    
    if (data.ok) {
      const msg = data.clearedPrevious 
        ? `✅ Cleared old content & indexed ${data.indexedChunks} chunks from ${selectedFile.name}!`
        : `✅ Indexed ${data.indexedChunks} chunks from ${selectedFile.name}!`;
      showStatus(msg, 'success');
      
      // Update answer area
      document.getElementById('answer').textContent = 
        `File indexed successfully! You can now ask questions about "${selectedFile.name}".`;
      
      // Store source for filtering
      currentPageUrl = `file:${selectedFile.name}`;
    } else {
      throw new Error(data.error || 'Indexing failed');
    }

  } catch (error) {
    console.error('File upload error:', error);
    showStatus(`❌ Error: ${error.message}`, 'error');
    document.getElementById('answer').textContent = 'Upload error: ' + error.toString();
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

/* ==================== PAGE INDEXING FUNCTIONALITY ==================== */

// Index current page
document.getElementById("indexBtn").addEventListener("click", async () => {
  const btn = document.getElementById("indexBtn");
  btn.disabled = true;
  btn.textContent = "⏳ Indexing...";
  
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.id) {
      throw new Error('No active tab found');
    }

    // Store current page URL
    currentPageUrl = tab.url || 'unknown';

    // Check if user wants to clear previous content
    const clearPrevious = document.getElementById('clearBeforeIndex').checked;

    // For Google Sheets, show a tip
    if (currentPageUrl.includes('docs.google.com/spreadsheets')) {
      showStatus('📊 Google Sheets detected. Extracting content...', 'info');
    }

    // Extract text from the page
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractPageText,
    });
    
    // If very little content, wait and try again (for Google Sheets lazy loading)
    if (results[0]?.result && results[0].result.length < 500 && currentPageUrl.includes('docs.google.com/spreadsheets')) {
      console.log('Initial extraction got little content, waiting and retrying...');
      showStatus('⏳ Got little content, scrolling and retrying...', 'info');
      
      // Scroll to load more content
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          const container = document.querySelector('.docs-sheet-container') || document.body;
          container.scrollTop = container.scrollHeight;
          setTimeout(() => { container.scrollTop = 0; }, 500);
        }
      });
      
      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try extraction again
      const retryResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractPageText,
      });
      
      if (retryResults[0]?.result && retryResults[0].result.length > results[0].result.length) {
        console.log(`Retry successful: ${retryResults[0].result.length} chars (was ${results[0].result.length})`);
        results[0].result = retryResults[0].result;
      }
    }

    const pageText = results[0]?.result;
    
    console.log(`Extraction result: ${pageText ? pageText.length : 0} characters`);
    
    if (!pageText || pageText.length < 20) {
      const errorMsg = pageText 
        ? `Only extracted ${pageText.length} characters. The page might be empty or not fully loaded.`
        : 'Could not extract any text from the page. Please ensure the page is fully loaded.';
      throw new Error(errorMsg);
    }

    if (pageText.length < 100) {
      showStatus(`⚠️ Only extracted ${pageText.length} characters. Consider scrolling through the sheet first.`, 'info');
    } else {
      showStatus(`Extracted ${pageText.length} characters. Sending to backend...`, 'info');
    }

    // Send to backend for indexing
    const resp = await fetch(`${BACKEND_URL}/index`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        text: pageText,
        source: currentPageUrl,
        clearPrevious: clearPrevious
      })
    });

    const data = await resp.json();
    
    if (data.ok) {
      const msg = data.clearedPrevious 
        ? `✅ Cleared old content & indexed ${data.indexedChunks} chunks!`
        : `✅ Indexed ${data.indexedChunks} chunks successfully!`;
      showStatus(msg, 'success');
    } else {
      throw new Error(data.error || 'Indexing failed');
    }
    
  } catch (e) {
    showStatus(`❌ Error: ${e.message}`, 'error');
    document.getElementById("answer").textContent = 'Indexing error: ' + e.toString();
  } finally {
    btn.disabled = false;
    btn.textContent = "📑 Index This Page";
  }
});

// Function to extract text from page (runs in page context)
function extractPageText() {
  try {
    const url = window.location.href;
    let text = '';
    
    console.log('=== Starting text extraction ===');
    console.log('URL:', url);
    
    // Special handling for Google Docs
    if (url.includes('docs.google.com/document')) {
    console.log('Detected Google Docs');
    
    // Google Docs stores content in specific containers
    const docContent = document.querySelector('.kix-paginateddocumentplugin') || 
                      document.querySelector('.kix-appview-editor') ||
                      document.querySelector('[role="document"]');
    
    if (docContent) {
      // Get all paragraphs and text spans
      const paragraphs = docContent.querySelectorAll('.kix-paragraphrenderer, [role="paragraph"], .kix-lineview');
      text = Array.from(paragraphs)
        .map(p => p.innerText || p.textContent)
        .filter(t => t && t.trim().length > 0)
        .join('\n');
    }
    
    if (!text || text.length < 100) {
      // Fallback: get all text from the editor
      const editor = document.querySelector('.kix-appview-editor');
      if (editor) {
        text = editor.innerText || editor.textContent || '';
      }
    }
  }
  
  // Special handling for Google Sheets
  else if (url.includes('docs.google.com/spreadsheets')) {
    console.log('Detected Google Sheets');
    console.log('URL:', url);
    
    // Log DOM state for debugging
    const allRows = document.querySelectorAll('[role="row"]');
    const allCells = document.querySelectorAll('[role="gridcell"]');
    console.log(`Initial DOM state: ${allRows.length} rows, ${allCells.length} cells`);
    
    // Method 1: Try to get all loaded grid cells by role
    let rows = document.querySelectorAll('[role="row"]');
    console.log(`Method 1: Found ${rows.length} rows with [role="row"]`);
    
    if (rows.length > 1) { // More than just header row
      const rowTexts = [];
      let totalCells = 0;
      
      rows.forEach((row, rowIdx) => {
        // Get cells from this row
        const cells = row.querySelectorAll('[role="gridcell"], [role="columnheader"], [role="rowheader"]');
        const cellTexts = [];
        
        cells.forEach(cell => {
          // Try multiple ways to get cell text
          let cellText = '';
          
          // Try to get from input field (for editable cells)
          const input = cell.querySelector('input');
          if (input && input.value) {
            cellText = input.value;
          }
          
          // Try innerText
          if (!cellText) {
            cellText = cell.innerText || '';
          }
          
          // Try textContent as fallback
          if (!cellText) {
            cellText = cell.textContent || '';
          }
          
          // Try data attributes
          if (!cellText && cell.getAttribute('data-value')) {
            cellText = cell.getAttribute('data-value');
          }
          
          cellText = cellText.trim();
          if (cellText.length > 0) {
            cellTexts.push(cellText);
            totalCells++;
          }
        });
        
        if (cellTexts.length > 0) {
          rowTexts.push(cellTexts.join(' | '));
        }
      });
      
      if (rowTexts.length > 0) {
        text = rowTexts.join('\n');
        console.log(`Method 1 SUCCESS: Extracted ${text.length} characters from ${rowTexts.length} rows, ${totalCells} cells`);
      }
    }
    
    // Method 2: Try alternative selectors for cells
    if (!text || text.length < 100) {
      console.log('Method 2: Trying alternative cell selectors');
      
      // Try getting cells directly without rows
      const cells = document.querySelectorAll(
        '[role="gridcell"], ' +
        '.s-cell-content, ' +
        '.cell-content, ' +
        'td[class*="cell"], ' +
        '[data-sheet-cell]'
      );
      
      console.log(`Method 2: Found ${cells.length} cells with alternative selectors`);
      
      if (cells.length > 0) {
        const cellTexts = [];
        let cellsPerRow = 0;
        let maxCellsInRow = 0;
        
        // Try to detect number of columns by looking at grid structure
        const firstRow = document.querySelector('[role="row"]');
        if (firstRow) {
          const firstRowCells = firstRow.querySelectorAll('[role="gridcell"], [role="columnheader"]');
          cellsPerRow = firstRowCells.length;
        }
        
        // If we couldn't detect columns, estimate based on total cells
        if (!cellsPerRow && cells.length > 0) {
          cellsPerRow = Math.min(20, Math.ceil(Math.sqrt(cells.length)));
        }
        
        console.log(`Estimated ${cellsPerRow} cells per row`);
        
        let currentRow = [];
        cells.forEach((cell, idx) => {
          let cellText = cell.innerText || cell.textContent || '';
          cellText = cellText.trim();
          
          if (cellText.length > 0) {
            currentRow.push(cellText);
          }
          
          // Start new row after cellsPerRow cells
          if (cellsPerRow > 0 && (idx + 1) % cellsPerRow === 0 && currentRow.length > 0) {
            cellTexts.push(currentRow.join(' | '));
            maxCellsInRow = Math.max(maxCellsInRow, currentRow.length);
            currentRow = [];
          }
        });
        
        // Add remaining cells
        if (currentRow.length > 0) {
          cellTexts.push(currentRow.join(' | '));
        }
        
        if (cellTexts.length > 0) {
          text = cellTexts.join('\n');
          console.log(`Method 2 SUCCESS: Extracted ${text.length} characters from ${cellTexts.length} rows`);
        }
      }
    }
    
    // Method 3: Try to extract from formula bar and visible viewport
    if (!text || text.length < 100) {
      console.log('Method 3: Trying formula bar and viewport extraction');
      
      // Get sheet viewport area
      const sheetContainer = document.querySelector('.grid-container') || 
                             document.querySelector('.waffle') ||
                             document.querySelector('[role="grid"]');
      
      if (sheetContainer) {
        console.log('Found sheet container');
        
        // Extract all text, being careful to preserve structure
        const containerText = sheetContainer.innerText || sheetContainer.textContent || '';
        
        // Split by lines and filter out UI elements
        const lines = containerText.split('\n')
          .map(line => line.trim())
          .filter(line => {
            // Keep lines that have actual content
            if (line.length === 0) return false;
            // Filter out single letters (column headers like A, B, C)
            if (line.length === 1 && line.match(/[A-Z]/)) return false;
            // Filter out row numbers
            if (line.match(/^\d+$/)) return false;
            return true;
          });
        
        if (lines.length > 0) {
          text = lines.join('\n');
          console.log(`Method 3 SUCCESS: Extracted ${text.length} characters from ${lines.length} lines`);
        }
      }
    }
    
    // Method 4: Last resort - get everything from the editor area
    if (!text || text.length < 100) {
      console.log('Method 4: Last resort - extracting all visible text');
      
      const editorArea = document.querySelector('.docs-sheet-container') ||
                         document.querySelector('#docs-editor-container') ||
                         document.querySelector('#docs-editor') ||
                         document.body;
      
      if (editorArea) {
        const allText = editorArea.innerText || editorArea.textContent || '';
        
        // Clean up the text
        const lines = allText.split('\n')
          .map(line => line.trim())
          .filter(line => {
            if (line.length < 2) return false;
            // Filter out common UI elements
            if (line.includes('Share') || line.includes('File') || line.includes('Edit') || 
                line.includes('View') || line.includes('Insert') || line.includes('Format')) {
              return false;
            }
            return true;
          });
        
        text = lines.join('\n');
        console.log(`Method 4: Extracted ${text.length} characters`);
      }
    }
    
    console.log(`=== Google Sheets extraction complete ===`);
    console.log(`Final result: ${text.length} characters`);
    
    if (text.length > 0) {
      console.log(`First 500 characters: ${text.substring(0, 500)}`);
    } else {
      console.warn('WARNING: No text extracted! The sheet might not be fully loaded or might be empty.');
      console.log('DOM Debug Info:');
      console.log('- Rows with [role="row"]:', document.querySelectorAll('[role="row"]').length);
      console.log('- Cells with [role="gridcell"]:', document.querySelectorAll('[role="gridcell"]').length);
      console.log('- Grid containers:', document.querySelectorAll('[role="grid"]').length);
      console.log('Try: 1) Scroll through the sheet, 2) Wait 5 seconds, 3) Try again');
    }
  }
  
  // Special handling for Google Slides
  else if (url.includes('docs.google.com/presentation')) {
    console.log('Detected Google Slides');
    
    const slides = document.querySelectorAll('.punch-viewer-content, [role="article"]');
    const slideTexts = [];
    slides.forEach((slide, idx) => {
      const slideText = slide.innerText || slide.textContent || '';
      if (slideText.trim().length > 0) {
        slideTexts.push(`Slide ${idx + 1}: ${slideText.trim()}`);
      }
    });
    text = slideTexts.join('\n\n');
  }
  
  // Default extraction for regular web pages
  else {
    console.log('Using default extraction');
    
    // Get the main content, excluding scripts, styles, and navigation
    const excludeSelectors = 'script, style, nav, header, footer, aside, .ad, .advertisement, [role="banner"], [role="navigation"], [role="complementary"]';
    
    // Try to find main content area first
    const mainContent = document.querySelector('main, [role="main"], article, .content, #content, .post, .article');
    
    if (mainContent) {
      const clone = mainContent.cloneNode(true);
      clone.querySelectorAll(excludeSelectors).forEach(el => el.remove());
      text = clone.innerText || clone.textContent || '';
    } else {
      // Fallback to body
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll(excludeSelectors).forEach(el => el.remove());
      text = clone.innerText || clone.textContent || '';
    }
  }
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  // Remove very short repeated patterns (common in web UI)
  text = text.replace(/(\b\w{1,2}\b\s*){5,}/g, ' ');
  
  console.log(`=== Extraction complete ===`);
  console.log(`Final text length: ${text.length} characters`);
  console.log(`First 200 chars: ${text.substring(0, 200)}`);
  
  return text;
  } catch (error) {
    console.error('Error during text extraction:', error);
    // Return empty string on error, let the calling code handle it
    return '';
  }
}

// Ask question
document.getElementById("askBtn").addEventListener("click", async () => {
  const query = document.getElementById("query").value;
  if (!query) {
    showStatus('⚠️ Please type a question first', 'error');
    return;
  }

  const btn = document.getElementById("askBtn");
  const answerEl = document.getElementById("answer");
  
  btn.disabled = true;
  btn.textContent = "🔍 Searching...";
  answerEl.textContent = "Thinking...";

  try {
    // Get current tab URL for filtering
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabUrl = tab?.url || currentPageUrl;
    
    // Check if user wants to filter by current page
    const filterByCurrentPage = document.getElementById('filterByCurrentPage').checked;
    
    const requestBody = { query };
    if (filterByCurrentPage && tabUrl) {
      requestBody.filterBySource = tabUrl;
    }

    const resp = await fetch(`${BACKEND_URL}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
    
    const data = await resp.json();
    answerEl.textContent = data.answer || JSON.stringify(data);
    
    // Show retrieved context count
    if (data.retrieved?.length > 0) {
      const sourceInfo = filterByCurrentPage ? ' from this page' : '';
      showStatus(`Found ${data.retrieved.length} relevant chunks${sourceInfo}`, 'success');
    } else if (data.retrieved?.length === 0) {
      showStatus('⚠️ No matching content found', 'error');
    }
    
  } catch (e) {
    answerEl.textContent = 'Error: ' + e.toString();
    showStatus('❌ Query failed: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = "🔍 Ask Question";
  }
});
