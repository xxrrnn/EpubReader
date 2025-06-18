/**
 * highlights.js
 * 处理高亮表格页面的交互逻辑
 */

// 初始化高亮数据
let allHighlights = [];
let currentBook = null;
let sortedHighlights = [];
let currentSort = {
  field: 'articleTitle',
  direction: 'asc'
};

// 初始化表格视图
function initializeHighlightsTable() {
  console.log('初始化高亮表格');
  
  // 加载所有高亮数据
  loadAllHighlights();
  
  // 在页面上渲染可编辑表格
  const tableContainer = document.getElementById('highlights-table-wrapper');
  if (tableContainer && window.EditableHighlightTable) {
    window.EditableHighlightTable.init(tableContainer, sortedHighlights, currentBook);
  } else {
    console.error('找不到表格容器或可编辑表格组件未加载');
  }
}

// 从localStorage加载所有高亮数据
function loadAllHighlights() {
  console.log('加载所有高亮数据');
  allHighlights = [];
  
  // 获取URL中的bookId参数
  const urlParams = new URLSearchParams(window.location.search);
  currentBook = urlParams.get('book');
  
  if (!currentBook) {
    console.warn('未提供书籍ID，将尝试加载所有高亮');
  } else {
    console.log(`加载书籍ID为 ${currentBook} 的高亮`);
  }
  
  // 从localStorage查找并加载高亮数据
  try {
    const storageKey = currentBook ? `${currentBook}-highlights` : null;
    
    if (storageKey) {
      // 加载指定书籍的高亮
      const bookHighlights = localStorage.getItem(storageKey);
      if (bookHighlights) {
        const parsedHighlights = JSON.parse(bookHighlights);
        allHighlights = parsedHighlights.map((h, index) => ({
          ...h,
          id: h.id || `highlight-${index + 1}`, // 确保每个高亮都有ID
        }));
        console.log(`成功加载 ${allHighlights.length} 条高亮`);
      } else {
        console.log('未找到该书籍的高亮数据');
      }
    } else {
      // 尝试加载所有书籍的高亮
      let allKeys = Object.keys(localStorage);
      let highlightKeys = allKeys.filter(key => key.endsWith('-highlights'));
      
      highlightKeys.forEach(key => {
        try {
          const bookHighlights = localStorage.getItem(key);
          if (bookHighlights) {
            const bookId = key.replace('-highlights', '');
            const parsedHighlights = JSON.parse(bookHighlights);
            
            // 为每个高亮添加书籍ID和序号
            const processedHighlights = parsedHighlights.map((h, index) => ({
              ...h,
              bookId,
              id: h.id || `highlight-${allHighlights.length + index + 1}` // 确保每个高亮都有ID
            }));
            
            allHighlights = [...allHighlights, ...processedHighlights];
          }
        } catch (e) {
          console.error(`处理书籍 ${key} 的高亮数据时出错:`, e);
        }
      });
      
      console.log(`总共加载了 ${allHighlights.length} 条高亮，来自 ${highlightKeys.length} 本书籍`);
    }
    
    // 增强高亮数据
    enhanceHighlightData();
    
    // 排序高亮
    sortHighlights();
  } catch (e) {
    console.error('加载高亮数据时出错:', e);
  }
}

// 增强高亮数据，确保所有必要字段存在
function enhanceHighlightData() {
  allHighlights = allHighlights.map(highlight => {
    // 确保有笔记字段
    if (!highlight.hasOwnProperty('notes')) {
      highlight.notes = '';
    }
    
    // 确保有标签字段
    if (!highlight.hasOwnProperty('tags')) {
      highlight.tags = [];
    }
    
    // 确保有文章标题
    if (!highlight.article && !highlight.articleTitle) {
      if (highlight.chapterIndex !== undefined) {
        highlight.article = `第${highlight.chapterIndex + 1}章`;
      } else {
        const date = new Date(highlight.timestamp || Date.now());
        highlight.article = `高亮 - ${date.toLocaleDateString()}`;
      }
    }
    
    // 确保article和articleTitle同步
    if (highlight.article && !highlight.articleTitle) {
      highlight.articleTitle = highlight.article;
    } else if (!highlight.article && highlight.articleTitle) {
      highlight.article = highlight.articleTitle;
    }
    
    return highlight;
  });
}

// 根据当前排序设置对高亮进行排序
function sortHighlights() {
  console.log(`按 ${currentSort.field} ${currentSort.direction} 排序高亮`);
  
  sortedHighlights = [...allHighlights];
  
  sortedHighlights.sort((a, b) => {
    let valueA, valueB;
    
    // 根据排序字段提取值
    if (currentSort.field === 'articleTitle') {
      valueA = (a.article || a.articleTitle || '').toLowerCase();
      valueB = (b.article || b.articleTitle || '').toLowerCase();
      
      // 如果两个值都为空，则按照章节索引和时间戳排序
      if (!valueA && !valueB) {
        if (a.chapterIndex !== b.chapterIndex) {
          return a.chapterIndex - b.chapterIndex;
        }
        return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
      }
    } else if (currentSort.field === 'position') {
      // 按章节位置排序
      valueA = a.chapterIndex || 0;
      valueB = b.chapterIndex || 0;
      
      // 如果章节相同，按照在章节中的位置排序
      if (valueA === valueB && a.epubCfi && b.epubCfi) {
        valueA = a.epubCfi;
        valueB = b.epubCfi;
      }
    } else if (currentSort.field === 'text') {
      valueA = (a.text || '').toLowerCase();
      valueB = (b.text || '').toLowerCase();
    } else if (currentSort.field === 'date') {
      valueA = new Date(a.timestamp || 0);
      valueB = new Date(b.timestamp || 0);
    } else {
      // 默认按ID排序
      valueA = a.id;
      valueB = b.id;
    }
    
    // 根据排序方向比较
    if (currentSort.direction === 'asc') {
      if (valueA < valueB) return -1;
      if (valueA > valueB) return 1;
      return 0;
    } else {
      if (valueA > valueB) return -1;
      if (valueA < valueB) return 1;
      return 0;
    }
  });
}

// 处理排序变更
function handleSortChange(field) {
  console.log(`改变排序字段为: ${field}`);
  
  // 如果点击当前排序字段，则切换排序方向
  if (currentSort.field === field) {
    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    // 否则更换排序字段，默认为升序
    currentSort.field = field;
    currentSort.direction = 'asc';
  }
  
  // 重新排序并更新表格
  sortHighlights();
  
  // 重新渲染表格
  const tableContainer = document.getElementById('highlights-table-wrapper');
  if (tableContainer && window.EditableHighlightTable) {
    window.EditableHighlightTable.init(tableContainer, sortedHighlights, currentBook);
  }
}

// 删除选中的高亮
function deleteSelectedHighlights(selectedIds) {
  if (!selectedIds || selectedIds.length === 0) {
    console.log('没有选中任何高亮，无法删除');
    return;
  }
  
  console.log(`删除 ${selectedIds.length} 条高亮`);
  
  // 按书籍分组需要删除的高亮
  const deleteByBook = {};
  
  selectedIds.forEach(id => {
    const highlight = allHighlights.find(h => h.id === id);
    if (highlight) {
      // 确定书籍ID
      const bookId = highlight.bookId || currentBook;
      
      if (!bookId) {
        console.error('无法确定高亮所属的书籍ID，跳过删除');
        return;
      }
      
      // 初始化书籍ID对应的数组
      if (!deleteByBook[bookId]) {
        deleteByBook[bookId] = [];
      }
      
      // 将需要删除的高亮ID添加到对应书籍的数组中
      deleteByBook[bookId].push(highlight);
    }
  });
  
  // 处理每本书籍的高亮删除
  Object.keys(deleteByBook).forEach(bookId => {
    try {
      // 获取该书籍的所有高亮
      const storageKey = `${bookId}-highlights`;
      const bookHighlightsStr = localStorage.getItem(storageKey);
      
      if (bookHighlightsStr) {
        const bookHighlights = JSON.parse(bookHighlightsStr);
        
        // 筛选出不需要删除的高亮
        const highlightsToDelete = deleteByBook[bookId];
        const updatedHighlights = bookHighlights.filter(h => {
          // 检查当前高亮是否在要删除的列表中
          return !highlightsToDelete.some(delH => {
            // 使用epubCfi和文本内容来匹配同一条高亮
            if (delH.epubCfi && h.epubCfi) {
              return delH.epubCfi === h.epubCfi;
            }
            // 如果没有epubCfi，则尝试用文本和时间戳匹配
            return delH.text === h.text && delH.timestamp === h.timestamp;
          });
        });
        
        // 保存更新后的高亮列表
        localStorage.setItem(storageKey, JSON.stringify(updatedHighlights));
        console.log(`已更新书籍 ${bookId} 的高亮，删除了 ${bookHighlights.length - updatedHighlights.length} 条`);
      }
    } catch (e) {
      console.error(`处理书籍 ${bookId} 的高亮删除时出错:`, e);
    }
  });
  
  // 重新加载所有高亮并更新表格
  loadAllHighlights();
  renderHighlightsTable();
}

// 获取文章标题
function getArticleTitle(highlight) {
  // 优先使用article字段
  if (highlight.article && highlight.article.trim()) {
    return highlight.article;
  }
  
  // 其次使用articleTitle字段
  if (highlight.articleTitle && highlight.articleTitle.trim()) {
    return highlight.articleTitle;
  }
  
  // 如果都没有，使用章节信息
  if (highlight.chapterIndex !== undefined) {
    return `第${highlight.chapterIndex + 1}章`;
  }
  
  // 最后使用时间戳
  if (highlight.timestamp) {
    const date = new Date(highlight.timestamp);
    return `高亮 - ${date.toLocaleDateString()}`;
  }
  
  return '';
}

// 渲染高亮表格
function renderHighlightsTable() {
  console.log('渲染高亮表格');
  
  const tableContainer = document.getElementById('highlights-table-wrapper');
  if (!tableContainer) {
    console.error('找不到表格容器元素');
    return;
  }
  
  // 构建表格HTML
  let tableHtml = `
    <div class="w-full h-full flex flex-col">
      <div class="p-4 bg-gray-100 border-b flex justify-between items-center">
        <div class="text-lg font-semibold">高亮列表 (${sortedHighlights.length})</div>
        <div id="table-actions" class="flex items-center">
          <span id="selected-count" class="mr-4 hidden">已选择 <span id="selected-count-number">0</span> 项</span>
          <button id="delete-selected-btn" class="bg-red-600 text-white px-4 py-2 rounded hidden hover:bg-red-700">
            删除选中项
          </button>
          <button id="select-all-btn" class="ml-2 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300">
            全选
          </button>
          <button id="deselect-all-btn" class="ml-2 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 hidden">
            取消全选
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-auto" id="table-scroll-container">
        <table class="min-w-full bg-white table-fixed">
          <thead class="sticky top-0 bg-gray-100 z-10">
            <tr>
              <th class="w-12 py-3 px-4 border-b">
                <input type="checkbox" id="select-all-checkbox" class="form-checkbox h-5 w-5 text-blue-600">
              </th>
              <th class="py-3 px-4 border-b text-left cursor-pointer w-1/5" data-sort="articleTitle">
                文章标题
                <span class="sort-indicator ml-1">${currentSort.field === 'articleTitle' ? (currentSort.direction === 'asc' ? '↑' : '↓') : ''}</span>
              </th>
              <th class="py-3 px-4 border-b text-left cursor-pointer w-2/5" data-sort="text">
                高亮内容
                <span class="sort-indicator ml-1">${currentSort.field === 'text' ? (currentSort.direction === 'asc' ? '↑' : '↓') : ''}</span>
              </th>
              <th class="py-3 px-4 border-b text-left cursor-pointer w-1/6" data-sort="position">
                位置
                <span class="sort-indicator ml-1">${currentSort.field === 'position' ? (currentSort.direction === 'asc' ? '↑' : '↓') : ''}</span>
              </th>
              <th class="py-3 px-4 border-b text-left cursor-pointer w-1/6" data-sort="date">
                创建日期
                <span class="sort-indicator ml-1">${currentSort.field === 'date' ? (currentSort.direction === 'asc' ? '↑' : '↓') : ''}</span>
              </th>
            </tr>
          </thead>
          <tbody class="overflow-y-auto">
  `;
  
  // 如果没有高亮，显示空状态
  if (sortedHighlights.length === 0) {
    tableHtml += `
      <tr>
        <td colspan="5" class="py-8 px-4 text-center text-gray-500">
          <div class="flex flex-col items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p class="text-lg">暂无高亮数据</p>
          </div>
        </td>
      </tr>
    `;
  } else {
    // 添加所有高亮行
    sortedHighlights.forEach((highlight, index) => {
      const date = highlight.timestamp ? new Date(highlight.timestamp).toLocaleString() : '';
      const articleTitle = getArticleTitle(highlight);
      const position = highlight.chapterIndex !== undefined ? `第${highlight.chapterIndex + 1}章` : '';
      
      tableHtml += `
        <tr class="border-b hover:bg-gray-50" data-id="${highlight.id}">
          <td class="py-3 px-4">
            <input type="checkbox" class="highlight-checkbox form-checkbox h-5 w-5 text-blue-600" data-id="${highlight.id}">
          </td>
          <td class="py-3 px-4 font-medium">${escapeHTML(articleTitle)}</td>
          <td class="py-3 px-4 break-words">
            <span class="highlight-content">${escapeHTML(highlight.text || '')}</span>
          </td>
          <td class="py-3 px-4">${position}</td>
          <td class="py-3 px-4">${date}</td>
        </tr>
      `;
    });
  }
  
  // 完成表格HTML
  tableHtml += `
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  // 更新DOM
  tableContainer.innerHTML = tableHtml;
  
  // 添加事件监听器
  addTableEventListeners();
  
  // 确保滚动容器可以滚动
  setTimeout(() => {
    const scrollContainer = document.getElementById('table-scroll-container');
    if (scrollContainer) {
      scrollContainer.style.overflowY = 'auto';
      scrollContainer.style.overflowX = 'auto';
      
      // 检查表格是否需要水平滚动条
      const table = scrollContainer.querySelector('table');
      if (table && table.offsetWidth > scrollContainer.offsetWidth) {
        console.log('表格宽度超出容器，启用水平滚动');
        scrollContainer.classList.add('overflow-x-auto');
      }
    }
  }, 0);
}

// 添加表格的各种事件监听器
function addTableEventListeners() {
  // 表头排序点击事件
  const sortHeaders = document.querySelectorAll('th[data-sort]');
  sortHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const field = header.getAttribute('data-sort');
      handleSortChange(field);
    });
  });
  
  // 全选/取消全选复选框
  const selectAllCheckbox = document.getElementById('select-all-checkbox');
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', function() {
      const checkboxes = document.querySelectorAll('.highlight-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.checked = this.checked;
      });
      updateSelectedUI();
    });
  }
  
  // 全选按钮
  const selectAllBtn = document.getElementById('select-all-btn');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', function() {
      const checkboxes = document.querySelectorAll('.highlight-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.checked = true;
      });
      if (selectAllCheckbox) selectAllCheckbox.checked = true;
      updateSelectedUI();
    });
  }
  
  // 取消全选按钮
  const deselectAllBtn = document.getElementById('deselect-all-btn');
  if (deselectAllBtn) {
    deselectAllBtn.addEventListener('click', function() {
      const checkboxes = document.querySelectorAll('.highlight-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.checked = false;
      });
      if (selectAllCheckbox) selectAllCheckbox.checked = false;
      updateSelectedUI();
    });
  }
  
  // 删除选中项按钮
  const deleteSelectedBtn = document.getElementById('delete-selected-btn');
  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener('click', function() {
      const selectedCheckboxes = document.querySelectorAll('.highlight-checkbox:checked');
      const selectedIds = Array.from(selectedCheckboxes).map(checkbox => 
        parseInt(checkbox.getAttribute('data-id'))
      );
      
      if (confirm(`确定要删除所选的 ${selectedIds.length} 条高亮吗？此操作不可撤销。`)) {
        deleteSelectedHighlights(selectedIds);
      }
    });
  }
  
  // 单个高亮复选框变化事件
  const checkboxes = document.querySelectorAll('.highlight-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', updateSelectedUI);
  });
  
  // 初始更新UI状态
  updateSelectedUI();
  
  // 添加滚动事件监听器，确保表头固定
  const scrollContainer = document.getElementById('table-scroll-container');
  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', function() {
      const thead = scrollContainer.querySelector('thead');
      if (thead) {
        thead.style.transform = `translateY(${this.scrollTop}px)`;
      }
    });
  }
}

// 更新选中项UI状态
function updateSelectedUI() {
  const checkboxes = document.querySelectorAll('.highlight-checkbox');
  const selectedCheckboxes = document.querySelectorAll('.highlight-checkbox:checked');
  const selectAllCheckbox = document.getElementById('select-all-checkbox');
  const selectedCount = document.getElementById('selected-count');
  const selectedCountNumber = document.getElementById('selected-count-number');
  const deleteSelectedBtn = document.getElementById('delete-selected-btn');
  const selectAllBtn = document.getElementById('select-all-btn');
  const deselectAllBtn = document.getElementById('deselect-all-btn');
  
  // 更新全选复选框状态
  if (selectedCheckboxes.length === checkboxes.length && checkboxes.length > 0) {
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
  } else if (selectedCheckboxes.length > 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = true;
  } else {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  }
  
  // 更新选中数量和删除按钮显示状态
  if (selectedCheckboxes.length > 0) {
    selectedCount.classList.remove('hidden');
    selectedCountNumber.textContent = selectedCheckboxes.length;
    deleteSelectedBtn.classList.remove('hidden');
  } else {
    selectedCount.classList.add('hidden');
    deleteSelectedBtn.classList.add('hidden');
  }
  
  // 更新全选/取消全选按钮显示
  if (selectedCheckboxes.length === checkboxes.length && checkboxes.length > 0) {
    selectAllBtn.classList.add('hidden');
    deselectAllBtn.classList.remove('hidden');
  } else {
    selectAllBtn.classList.remove('hidden');
    deselectAllBtn.classList.add('hidden');
  }
}

// HTML转义函数，防止XSS
function escapeHTML(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 当页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  // 初始化高亮表格
  initializeHighlightsTable();
  
  // 返回按钮点击事件
  document.getElementById('back-to-library').addEventListener('click', function() {
    window.location.href = 'library.html';
  });
  
  // 获取并设置应用窗口控制按钮的事件监听
  const minimizeAppIcon = document.getElementById('minimize-app-icon');
  const closeAppIcon = document.getElementById('close-app-icon');
  
  if (minimizeAppIcon) {
    minimizeAppIcon.addEventListener('click', function() {
      window.appConfig.send('minimizeApp');
    });
  }
  
  if (closeAppIcon) {
    closeAppIcon.addEventListener('click', function() {
      window.appConfig.send('closeApp');
    });
  }
}); 