// highlightTemplate.js
// 高亮数据模板及相关操作函数

// 创建高亮对象的模板函数
function createHighlightTemplate({
  id = `highlight-${Date.now()}`, // 高亮的唯一ID
  bookKey, // 书籍的唯一标识
  bookTitle = '', // 书籍标题
  cfi, // EPUB CFI或位置JSON对象
  text = '', // 高亮的文本内容
  chapter = '', // 章节名称
  chapterIndex, // 章节索引
  color = '#ffeb3b', // 高亮颜色
  type = 'word', // 高亮类型：word, sentence, paragraph
  note = '', // 高亮附加的笔记
  timestamp = Date.now(), // 创建时间戳
  tags = [] // 标签
} = {}) {
  return {
    id,
    bookKey,
    bookTitle,
    cfi,
    text,
    chapter,
    chapterIndex,
    color,
    type,
    note,
    timestamp,
    tags
  };
}

// 高亮数据管理
const highlightManager = {
  // 保存高亮到本地存储
  saveHighlight(highlight) {
    try {
      if (!highlight.bookKey) {
        console.error('无法保存高亮：缺少bookKey');
        return false;
      }

      const storageKey = `${highlight.bookKey}-highlights`;
      const existingHighlights = this.getHighlights(highlight.bookKey);
      
      // 检查是否已存在相同ID的高亮
      const existingIndex = existingHighlights.findIndex(h => h.id === highlight.id);
      if (existingIndex !== -1) {
        // 更新现有高亮
        existingHighlights[existingIndex] = highlight;
      } else {
        // 添加新高亮
        existingHighlights.push(highlight);
      }
      
      // 保存到localStorage
      localStorage.setItem(storageKey, JSON.stringify(existingHighlights));
      console.log(`高亮已保存到 ${storageKey}，当前共有 ${existingHighlights.length} 个高亮`);
      
      // 触发自定义事件
      const event = new CustomEvent('highlight-saved', { detail: highlight });
      document.dispatchEvent(event);
      
      return true;
    } catch (error) {
      console.error('保存高亮时出错:', error);
      return false;
    }
  },
  
  // 获取指定书籍的所有高亮
  getHighlights(bookKey) {
    try {
      if (!bookKey) {
        console.error('获取高亮失败：缺少bookKey');
        return [];
      }
      
      const storageKey = `${bookKey}-highlights`;
      const highlightsJson = localStorage.getItem(storageKey);
      
      if (highlightsJson) {
        return JSON.parse(highlightsJson);
      }
      
      return [];
    } catch (error) {
      console.error('获取高亮数据时出错:', error);
      return [];
    }
  },
  
  // 获取所有书籍的高亮
  getAllHighlights() {
    try {
      const allHighlights = [];
      const storageKeyPrefix = '-highlights';
      
      // 遍历localStorage寻找高亮数据
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.endsWith(storageKeyPrefix)) {
          const bookHighlights = JSON.parse(localStorage.getItem(key) || '[]');
          allHighlights.push(...bookHighlights);
        }
      }
      
      return allHighlights;
    } catch (error) {
      console.error('获取所有高亮数据时出错:', error);
      return [];
    }
  },
  
  // 删除指定高亮
  deleteHighlight(bookKey, highlightId) {
    try {
      if (!bookKey || !highlightId) {
        console.error('删除高亮失败：缺少必要参数');
        return false;
      }
      
      const storageKey = `${bookKey}-highlights`;
      const existingHighlights = this.getHighlights(bookKey);
      
      const filteredHighlights = existingHighlights.filter(h => h.id !== highlightId);
      
      if (filteredHighlights.length !== existingHighlights.length) {
        localStorage.setItem(storageKey, JSON.stringify(filteredHighlights));
        console.log(`高亮 ${highlightId} 已从 ${storageKey} 中删除`);
        
        // 触发自定义事件
        const event = new CustomEvent('highlight-deleted', { detail: { bookKey, highlightId } });
        document.dispatchEvent(event);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('删除高亮时出错:', error);
      return false;
    }
  },
  
  // 更新高亮
  updateHighlight(highlight) {
    return this.saveHighlight(highlight);
  },
  
  // 按条件过滤高亮
  filterHighlights({ bookKey, text, chapter, type, tags } = {}) {
    try {
      let highlights = bookKey ? this.getHighlights(bookKey) : this.getAllHighlights();
      
      if (text) {
        const searchText = text.toLowerCase();
        highlights = highlights.filter(h => 
          h.text.toLowerCase().includes(searchText) || 
          (h.note && h.note.toLowerCase().includes(searchText))
        );
      }
      
      if (chapter) {
        highlights = highlights.filter(h => h.chapter === chapter);
      }
      
      if (type) {
        highlights = highlights.filter(h => h.type === type);
      }
      
      if (tags && tags.length > 0) {
        highlights = highlights.filter(h => {
          if (!h.tags || !Array.isArray(h.tags)) return false;
          return tags.some(tag => h.tags.includes(tag));
        });
      }
      
      return highlights;
    } catch (error) {
      console.error('过滤高亮时出错:', error);
      return [];
    }
  },
  
  // 导出高亮数据
  exportHighlights(bookKey) {
    try {
      const highlights = bookKey ? this.getHighlights(bookKey) : this.getAllHighlights();
      
      if (highlights.length === 0) {
        console.log('没有可导出的高亮');
        return null;
      }
      
      const exportData = {
        version: '1.0',
        type: 'epubreader-highlights',
        date: new Date().toISOString(),
        highlights: highlights
      };
      
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('导出高亮数据时出错:', error);
      return null;
    }
  },
  
  // 导入高亮数据
  importHighlights(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      
      if (!data.highlights || !Array.isArray(data.highlights)) {
        console.error('导入的数据格式不正确');
        return false;
      }
      
      // 按书籍分组高亮
      const highlightsByBook = {};
      data.highlights.forEach(highlight => {
        if (!highlight.bookKey) return;
        
        if (!highlightsByBook[highlight.bookKey]) {
          highlightsByBook[highlight.bookKey] = [];
        }
        
        highlightsByBook[highlight.bookKey].push(highlight);
      });
      
      // 逐个保存每本书的高亮
      Object.keys(highlightsByBook).forEach(bookKey => {
        const existingHighlights = this.getHighlights(bookKey);
        const newHighlights = [...existingHighlights, ...highlightsByBook[bookKey]];
        
        const storageKey = `${bookKey}-highlights`;
        localStorage.setItem(storageKey, JSON.stringify(newHighlights));
      });
      
      return true;
    } catch (error) {
      console.error('导入高亮数据时出错:', error);
      return false;
    }
  }
};

// 导出模块
window.highlightTemplate = {
  createHighlight: createHighlightTemplate,
  manager: highlightManager
}; 