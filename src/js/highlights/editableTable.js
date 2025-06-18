/**
 * editableTable.js
 * 实现可编辑的高亮表格组件
 */

// 存储当前高亮数据
let currentHighlights = [];
let currentBookId = null;
let inEditMode = false;
let editingCell = null;

// 初始化高亮表格
function initEditableHighlightTable(container, highlights, bookId) {
  currentHighlights = highlights || [];
  currentBookId = bookId;
  
  // 渲染表格
  renderEditableTable(container);
  
  // 设置窗口调整大小时重新渲染
  window.addEventListener('resize', function() {
    if (container) {
      renderEditableTable(container);
    }
  });
}

// 渲染可编辑表格
function renderEditableTable(container) {
  if (!container) return;
  
  // 创建表格标题
  const header = document.createElement('div');
  header.className = 'highlight-table-header flex justify-between items-center p-4 bg-gray-100 border-b';
  header.innerHTML = `
    <h2 class="text-lg font-semibold">高亮列表 (${currentHighlights.length})</h2>
    <div class="flex items-center">
      <button id="save-all-btn" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 mr-2">
        保存全部更改
      </button>
      <button id="edit-mode-btn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        ${inEditMode ? '完成编辑' : '编辑模式'}
      </button>
    </div>
  `;
  
  // 创建表格容器
  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'overflow-auto flex-1';
  
  // 创建表格
  const table = document.createElement('table');
  table.className = 'min-w-full bg-white table-auto border-collapse';
  
  // 创建表头
  const thead = document.createElement('thead');
  thead.className = 'sticky top-0 bg-gray-100 z-10';
  thead.innerHTML = `
    <tr>
      <th class="py-3 px-4 border text-left">文章标题</th>
      <th class="py-3 px-4 border text-left">高亮内容</th>
      <th class="py-3 px-4 border text-left">词典释义</th>
      <th class="py-3 px-4 border text-left">笔记</th>
      <th class="py-3 px-4 border text-left">标签</th>
      <th class="py-3 px-4 border text-left w-24">操作</th>
    </tr>
  `;
  
  // 创建表格主体
  const tbody = document.createElement('tbody');
  
  if (currentHighlights.length === 0) {
    // 没有高亮时显示空状态
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="6" class="py-8 px-4 text-center text-gray-500">
        <div class="flex flex-col items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="text-lg">暂无高亮数据</p>
        </div>
      </td>
    `;
    tbody.appendChild(emptyRow);
  } else {
    // 添加高亮行
    currentHighlights.forEach((highlight, index) => {
      const row = document.createElement('tr');
      row.className = 'border-b hover:bg-gray-50';
      row.dataset.id = highlight.id;
      row.dataset.index = index;
      
      // 处理文章标题
      const articleTitle = highlight.article || highlight.articleTitle || '';
      
      // 处理词典信息
      let dictionaryInfo = '';
      if (highlight.wordInfo) {
        const wordInfo = highlight.wordInfo;
        dictionaryInfo = `
          <div class="dictionary-info">
            <div class="font-bold">${escapeHTML(wordInfo.word || '')}</div>
            <div class="text-gray-600">${escapeHTML(wordInfo.phonetic || '')}</div>
            ${wordInfo.meanings && wordInfo.meanings.length > 0 ? 
              wordInfo.meanings.map(meaning => `
                <div class="mt-1">
                  <span class="text-gray-700">${escapeHTML(meaning.partOfSpeech || '')}</span>
                  ${meaning.definitions && meaning.definitions.length > 0 ?
                    meaning.definitions.map(def => `
                      <div class="ml-2">
                        <div>${escapeHTML(def.definition || '')}</div>
                        <div class="text-green-700">${escapeHTML(def.translation || '')}</div>
                      </div>
                    `).join('') : ''
                  }
                </div>
              `).join('') : ''
            }
            ${wordInfo.url ? `<a href="${wordInfo.url}" target="_blank" class="text-blue-600 text-sm hover:underline">查看更多</a>` : ''}
          </div>
        `;
      }
      
      // 生成单元格内容
      row.innerHTML = `
        <td class="py-3 px-4 border" data-field="articleTitle">${inEditMode ? `<div class="editable" contenteditable="true">${escapeHTML(articleTitle)}</div>` : escapeHTML(articleTitle)}</td>
        <td class="py-3 px-4 border" data-field="text">
          <div class="${inEditMode ? 'editable' : ''} highlight-content" ${inEditMode ? 'contenteditable="true"' : ''}>${escapeHTML(highlight.text || '')}</div>
        </td>
        <td class="py-3 px-4 border" data-field="wordInfo">${dictionaryInfo}</td>
        <td class="py-3 px-4 border" data-field="notes">
          <div class="${inEditMode ? 'editable' : ''}" ${inEditMode ? 'contenteditable="true"' : ''}>${escapeHTML(highlight.notes || '')}</div>
        </td>
        <td class="py-3 px-4 border" data-field="tags">
          <div class="${inEditMode ? 'editable tag-editor' : 'tags-container'}" ${inEditMode ? 'contenteditable="true"' : ''}>
            ${highlight.tags && highlight.tags.length ? highlight.tags.map(tag => `<span class="tag inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded mr-1 mb-1">${escapeHTML(tag)}</span>`).join('') : ''}
          </div>
        </td>
        <td class="py-3 px-4 border" data-field="actions">
          <button class="text-red-600 hover:text-red-800 delete-btn" data-id="${highlight.id}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          </button>
        </td>
      `;
      
      tbody.appendChild(row);
    });
  }
  
  // 组装表格
  table.appendChild(thead);
  table.appendChild(tbody);
  tableWrapper.appendChild(table);
  
  // 清空并添加到容器
  container.innerHTML = '';
  container.appendChild(header);
  container.appendChild(tableWrapper);
  
  // 添加事件监听
  addTableEventListeners(container);
}

// 添加表格事件监听
function addTableEventListeners(container) {
  if (!container) return;
  
  // 编辑模式按钮
  const editModeBtn = container.querySelector('#edit-mode-btn');
  if (editModeBtn) {
    editModeBtn.addEventListener('click', function() {
      inEditMode = !inEditMode;
      renderEditableTable(container);
    });
  }
  
  // 保存所有更改按钮
  const saveAllBtn = container.querySelector('#save-all-btn');
  if (saveAllBtn) {
    saveAllBtn.addEventListener('click', function() {
      saveAllChanges();
    });
  }
  
  // 删除按钮
  const deleteButtons = container.querySelectorAll('.delete-btn');
  deleteButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const id = this.dataset.id;
      if (id && confirm('确定要删除这个高亮吗？')) {
        deleteHighlight(id);
        renderEditableTable(container);
      }
    });
  });
  
  // 编辑模式下的contenteditable事件
  if (inEditMode) {
    const editableElements = container.querySelectorAll('.editable');
    editableElements.forEach(el => {
      // 焦点进入时记录当前编辑单元格
      el.addEventListener('focus', function() {
        editingCell = this;
      });
      
      // 焦点离开时保存更改
      el.addEventListener('blur', function() {
        if (editingCell === this) {
          const cell = this;
          const row = cell.closest('tr');
          const field = cell.closest('td').dataset.field;
          const index = parseInt(row.dataset.index);
          
          if (!isNaN(index) && field && index >= 0 && index < currentHighlights.length) {
            // 特殊处理tags字段
            if (field === 'tags') {
              const tagTexts = cell.textContent.split(',').map(tag => tag.trim()).filter(tag => tag);
              currentHighlights[index][field] = tagTexts;
            } else {
              currentHighlights[index][field] = cell.textContent.trim();
            }
          }
          
          editingCell = null;
        }
      });
      
      // 按Enter键时保存并完成编辑
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.blur();
        }
      });
    });
  }
}

// 保存所有更改
function saveAllChanges() {
  if (!currentBookId || !currentHighlights) return;
  
  try {
    const storageKey = `${currentBookId}-highlights`;
    localStorage.setItem(storageKey, JSON.stringify(currentHighlights));
    showMessage('保存成功！', 'success');
  } catch (err) {
    console.error('保存失败:', err);
    showMessage('保存失败，请重试', 'error');
  }
}

// 删除高亮
function deleteHighlight(id) {
  if (!currentHighlights || !currentBookId) return;
  
  const index = currentHighlights.findIndex(h => h.id == id);
  if (index !== -1) {
    currentHighlights.splice(index, 1);
    
    // 保存到localStorage
    try {
      const storageKey = `${currentBookId}-highlights`;
      localStorage.setItem(storageKey, JSON.stringify(currentHighlights));
      showMessage('删除成功！', 'success');
    } catch (err) {
      console.error('删除保存失败:', err);
      showMessage('删除后保存失败，请重试', 'error');
    }
  }
}

// 显示消息
function showMessage(message, type = 'info') {
  const messageEl = document.getElementById('message-container');
  if (!messageEl) {
    // 创建消息元素
    const el = document.createElement('div');
    el.id = 'message-container';
    el.className = `fixed top-4 right-4 px-4 py-2 rounded shadow-md z-50 ${
      type === 'success' ? 'bg-green-500' : 
      type === 'error' ? 'bg-red-500' : 'bg-blue-500'
    } text-white`;
    el.innerHTML = message;
    document.body.appendChild(el);
    
    // 3秒后自动消失
    setTimeout(() => {
      document.body.removeChild(el);
    }, 3000);
  } else {
    messageEl.className = `fixed top-4 right-4 px-4 py-2 rounded shadow-md z-50 ${
      type === 'success' ? 'bg-green-500' : 
      type === 'error' ? 'bg-red-500' : 'bg-blue-500'
    } text-white`;
    messageEl.innerHTML = message;
    
    // 重置消失计时器
    clearTimeout(messageEl._timer);
    messageEl._timer = setTimeout(() => {
      if (document.body.contains(messageEl)) {
        document.body.removeChild(messageEl);
      }
    }, 3000);
  }
}

// HTML转义函数
function escapeHTML(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 导出模块
window.EditableHighlightTable = {
  init: initEditableHighlightTable,
  render: renderEditableTable,
  saveAllChanges: saveAllChanges
}; 