/**
 * textSelection.js
 * 监控EPUB阅读器中的文本选择，并实现文本高亮功能
 */

// 全局变量，存储所有的高亮数据
window.highlights = [];

// 添加初始化监控，确保全局变量正确设置
(function() {
  console.log("初始化文本选择和高亮功能");
  
  // 每隔100ms检查一次book_rendition是否可用
  const checkInterval = setInterval(() => {
    if (window.book_rendition) {
      console.log("检测到book_rendition全局变量");
      clearInterval(checkInterval);
      
      // 初始化高亮功能
      if (typeof window.loadHighlights === 'function') {
        console.log("加载已保存的高亮");
        window.loadHighlights();
      }
    }
  }, 100);
  
  // 5秒后如果仍未找到，则停止检查
  setTimeout(() => {
    clearInterval(checkInterval);
  }, 5000);
})();

// 确保displayAlert函数可用
function displayAlert(message, type) {
  // 避免递归调用，使用console.log作为替代
  console.log(`[${type}] ${message}`);
  
  // 创建一个临时的提示元素
  const alertElement = document.createElement('div');
  alertElement.textContent = message;
  alertElement.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 20px;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    z-index: 2000;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  `;
  
  // 根据类型设置样式
  if (type === 'success') {
    alertElement.style.backgroundColor = '#4CAF50'; // 绿色
  } else if (type === 'error') {
    alertElement.style.backgroundColor = '#F44336'; // 红色
  } else {
    alertElement.style.backgroundColor = '#2196F3'; // 蓝色
  }
  
  document.body.appendChild(alertElement);
  
  // 3秒后自动移除
  setTimeout(() => {
    if (alertElement.parentNode) {
      alertElement.parentNode.removeChild(alertElement);
    }
  }, 3000);
}

// 高亮选中的文本 - 参考Dictionary功能的实现
window.highlightSelectedText = function() {
  console.log("执行高亮选中文本");
  
  try {
    // 尝试多种方法获取选中文本
    let selection_text = '';
    let iframe = null;
    let range = null;
    
    // 方法1：从iframe获取
    try {
      iframe = document.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        const iframeSelection = iframe.contentWindow.getSelection();
        if (iframeSelection && !iframeSelection.isCollapsed) {
          selection_text = iframeSelection.toString().trim();
          if (iframeSelection.rangeCount > 0) {
            range = iframeSelection.getRangeAt(0);
          }
          console.log("从iframe获取选中文本:", selection_text);
        }
      }
    } catch (e) {
      console.error("从iframe获取选中文本失败:", e);
    }
    
    // 方法2：从document获取
    if (!selection_text || !range) {
      try {
        const docSelection = document.getSelection();
        if (docSelection && !docSelection.isCollapsed) {
          selection_text = docSelection.toString().trim();
          if (docSelection.rangeCount > 0) {
            range = docSelection.getRangeAt(0);
          }
          console.log("从document获取选中文本:", selection_text);
        }
      } catch (e) {
        console.error("从document获取选中文本失败:", e);
      }
    }
    
    // 方法3：从book_rendition.currentSelection获取
    if (!selection_text && window.book_rendition && window.book_rendition.currentSelection) {
      selection_text = window.book_rendition.currentSelection.text;
      console.log("从book_rendition.currentSelection获取选中文本:", selection_text);
    }
    
    // 检查是否有选中的文本
    if (!selection_text || selection_text.length === 0) {
      console.error("没有选中的文本可以高亮");
      displayAlert("请先选择要高亮的文本", "error");
      return;
    }
    
    console.log("选中的文本:", selection_text, "range:", range);
    
    // 获取CFI - 修复获取CFI的方法
    try {
      // 如果没有range但有iframe，尝试重新获取
      if (!range && iframe) {
        const iframeSelection = iframe.contentWindow.getSelection();
        if (iframeSelection && iframeSelection.rangeCount > 0) {
          range = iframeSelection.getRangeAt(0);
        }
      }
      
      // 检查全局变量
      if (!window.book_rendition) {
        console.error("全局变量book_rendition不存在");
        displayAlert("初始化错误，请刷新页面", "error");
        return;
      }
      
      // 如果有range，提取上下文和章节内容
      let contextInfo = null;
      if (range && iframe) {
        contextInfo = extractContextInfo(iframe, range, selection_text);
        console.log("上下文信息:", contextInfo);
      }
      
      // 提取所在句子
      let sentence = '';
      if (range) {
        sentence = extractSentence(range, selection_text);
        console.log("所在句子:", sentence);
      }
      
      // 获取书籍信息
      let bookInfo = extractBookInfo();
      console.log("书籍信息:", bookInfo);
      
      // 获取当前章节索引
      let chapterIndex = -1;
      let chapterHref = '';
      if (window.book_rendition) {
        chapterIndex = window.book_rendition.currentChapterIndex || -1;
        if (window.book_rendition.location && window.book_rendition.location.start) {
          chapterHref = window.book_rendition.location.start.href || '';
        }
      }
      
      // 生成高亮ID
      const highlightId = 'highlight-' + new Date().getTime();
      
      // 如果没有有效的range或无法获取CFI，使用章节信息和文本内容创建一个伪CFI
      let highlightData = null;
      let pseudoCfi = null;
      
      // 尝试获取真实CFI
      let cfiRange = null;
      if (range && window.book_rendition && window.book_rendition.manager && 
          window.book_rendition.manager.current && window.book_rendition.manager.current.content) {
        try {
          cfiRange = window.book_rendition.manager.current.content.cfiFromRange(range);
          console.log("生成的CFI:", cfiRange);
          
          // 使用真实CFI创建高亮数据
          highlightData = {
            id: highlightId,
            cfi: cfiRange,
            type: getHighlightType(selection_text),
            text: selection_text,
            sentence: sentence || selection_text,
            chapter: contextInfo ? contextInfo.chapterTitle : '',
            created: new Date().toISOString()
          };
        } catch (e) {
          console.error("生成CFI失败:", e);
        }
      }
      
      // 如果无法获取真实CFI，创建伪CFI
      if (!highlightData) {
        pseudoCfi = JSON.stringify({
          chapterIndex: chapterIndex,
          chapterHref: chapterHref,
          text: selection_text,
          timestamp: new Date().getTime()
        });
        
        console.log("生成伪CFI:", pseudoCfi);
        
        // 使用伪CFI创建高亮数据
        highlightData = {
          id: highlightId,
          cfi: pseudoCfi,
          type: getHighlightType(selection_text),
          text: selection_text,
          sentence: sentence || selection_text,
          chapter: contextInfo ? contextInfo.chapterTitle : '',
          created: new Date().toISOString(),
          spinePosition: chapterIndex
        };
      }
      
      console.log("高亮数据:", highlightData);
      
      // 保存高亮数据
      window.highlights = window.highlights || [];
      window.highlights.push(highlightData);
      saveHighlights();
      
      // 立即渲染高亮
      try {
        const iframe = document.querySelector('iframe');
        if (iframe && iframe.contentDocument && range) {
          // 手动添加高亮 - 仅保留成功的方法
          let highlightAdded = false;
          
          try {
            // 手动添加高亮样式
            const highlightSpan = document.createElement('span');
            highlightSpan.className = 'highlight-text';
            highlightSpan.dataset.id = highlightData.id;
            
            // 将选中内容包装在span中
            range.surroundContents(highlightSpan);
            
            highlightAdded = true;
            console.log("手动添加高亮成功");
          } catch (e) {
            console.error("手动添加高亮失败:", e);
          }
          
          if (highlightAdded) {
            // 隐藏右键菜单
            $('#book-action-menu').hide();
            
            // 显示成功消息
            displayAlert("文本已高亮", "success");
          } else {
            console.log("重新渲染所有高亮");
            // 如果手动添加失败，尝试重新渲染所有高亮
            renderHighlights();
            displayAlert("文本已高亮", "success");
          }
        } else {
          console.log("重新渲染所有高亮 (无iframe或range)");
          renderHighlights();
          displayAlert("文本已高亮", "success");
        }
      } catch (e) {
        console.error("添加高亮时出错:", e);
        // 即使出错也尝试重新渲染
        renderHighlights();
        displayAlert("文本已高亮", "success");
      }
    } catch (e) {
      console.error("获取CFI或添加高亮时出错:", e);
      displayAlert("无法获取文本位置", "error");
    }
  } catch (e) {
    console.error("高亮文本时出错:", e);
    displayAlert("高亮文本时出错", "error");
  }
};

// 判断高亮类型
function getHighlightType(text) {
  if (!text) return 'word';
  
  text = text.trim();
  
  // 检查是否包含句号、问号或感叹号，表示是一个句子
  if (/[.!?。！？]/.test(text)) {
    return 'sentence';
  }
  
  // 检查是否有空格，表示是词组
  if (/\s+/.test(text)) {
    return 'phrase';
  }
  
  // 默认是单词
  return 'word';
}

// 提取页面上下文信息
function extractContextInfo(iframe, range, selectedText) {
  try {
    const contextInfo = {
      nearbyHeadings: [],
      parentHeadings: [],
      structuralInfo: {},
      documentStructure: {},
      firstParagraphText: ''
    };
    
    if (!iframe || !iframe.contentDocument) {
      return contextInfo;
    }
    
    const doc = iframe.contentDocument;
    
    // 获取包含选中文本的节点及其祖先元素
    let node = range.startContainer;
    let parentElement = node.parentElement;
    
    // 查找所有祖先元素
    const ancestors = [];
    let current = parentElement;
    while (current) {
      ancestors.push(current);
      current = current.parentElement;
    }
    
    // 记录祖先元素的标签和类名信息
    contextInfo.structuralInfo.ancestors = ancestors.map(el => ({
      tag: el.tagName,
      id: el.id,
      className: el.className
    }));
    
    // 查找选中文本附近的标题
    const allHeadings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const headingsArray = Array.from(allHeadings);
    
    // 查找祖先元素中的标题
    for (const ancestor of ancestors) {
      if (/^H[1-6]$/.test(ancestor.tagName)) {
        contextInfo.parentHeadings.push({
          level: parseInt(ancestor.tagName.substring(1)),
          text: ancestor.textContent.trim()
        });
      }
    }
    
    // 查找离选中文本最近的5个标题
    headingsArray.sort((a, b) => {
      // 计算与选中文本的"距离"
      const posA = a.compareDocumentPosition(parentElement);
      const posB = b.compareDocumentPosition(parentElement);
      
      // 如果标题在选中文本之前
      if (posA & Node.DOCUMENT_POSITION_PRECEDING) {
        return -1;
      }
      // 如果标题在选中文本之后
      else if (posA & Node.DOCUMENT_POSITION_FOLLOWING) {
        return 1;
      }
      // 如果标题包含选中文本
      else if (posA & Node.DOCUMENT_POSITION_CONTAINS) {
        return -1;
      }
      // 如果选中文本包含标题（不太可能）
      else if (posA & Node.DOCUMENT_POSITION_CONTAINED_BY) {
        return 1;
      }
      return 0;
    });
    
    // 记录最近的5个标题
    contextInfo.nearbyHeadings = headingsArray.slice(0, 5).map(h => ({
      level: parseInt(h.tagName.substring(1)),
      text: h.textContent.trim()
    }));
    
    // 获取文档的整体结构
    const bodyClasses = doc.body.className;
    const mainContainers = doc.querySelectorAll('main, article, .article, .content, .main');
    
    contextInfo.documentStructure = {
      bodyClasses,
      mainContainerCount: mainContainers.length,
      totalParagraphs: doc.querySelectorAll('p').length,
      totalHeadings: allHeadings.length
    };
    
    // 获取第一段文本
    const firstParagraph = doc.querySelector('p');
    if (firstParagraph) {
      contextInfo.firstParagraphText = firstParagraph.textContent.trim();
    }
    
    return contextInfo;
  } catch (e) {
    console.error("提取上下文信息时出错:", e);
    return {};
  }
}

// 从上下文分析提取文章标题
function extractTitleFromContext(iframe, range, sentence, selectedText, contextInfo) {
  try {
    console.log("开始从上下文分析提取文章标题...");
    
    let potentialTitles = [];
    let titleScores = {};
    
    if (!iframe || !iframe.contentDocument) {
      return null;
    }
    
    const doc = iframe.contentDocument;
    
    // 方法1: 检查父级标题
    if (contextInfo.parentHeadings && contextInfo.parentHeadings.length > 0) {
      // 优先使用最近的父级标题
      const title = contextInfo.parentHeadings[0].text;
      potentialTitles.push(title);
      titleScores[title] = (titleScores[title] || 0) + 10; // 父级标题得高分
      console.log("从父级标题提取:", title);
    }
    
    // 方法2: 检查附近标题
    if (contextInfo.nearbyHeadings && contextInfo.nearbyHeadings.length > 0) {
      // 找出最高级别的标题（h1优先于h2等）
      const sortedHeadings = [...contextInfo.nearbyHeadings].sort((a, b) => a.level - b.level);
      
      // 取最高级别的标题
      const title = sortedHeadings[0].text;
      potentialTitles.push(title);
      titleScores[title] = (titleScores[title] || 0) + 8; // 高级别标题得分高
      console.log("从最高级别标题提取:", title);
      
      // 也考虑第一个标题
      const firstHeading = contextInfo.nearbyHeadings[0].text;
      if (firstHeading !== title) {
        potentialTitles.push(firstHeading);
        titleScores[firstHeading] = (titleScores[firstHeading] || 0) + 6; // 最近标题也有较高分
        console.log("从最近标题提取:", firstHeading);
      }
    }
    
    // 方法3: 检查文章开头段落
    if (contextInfo.firstParagraphText) {
      // 尝试从第一段提取标题
      // 通常标题会在第一段中提及，或者第一段会以标题开头
      const firstSentence = contextInfo.firstParagraphText.split(/[.!?。！？]/) 
                            .filter(s => s.trim().length > 0)[0]
                            ?.trim();
      
      if (firstSentence && firstSentence.length < 100) {
        potentialTitles.push(firstSentence);
        titleScores[firstSentence] = (titleScores[firstSentence] || 0) + 3;
        console.log("从第一段第一句提取:", firstSentence);
      }
    }
    
    // 方法4: 检查文档标题
    if (doc.title) {
      potentialTitles.push(doc.title);
      titleScores[doc.title] = (titleScores[doc.title] || 0) + 7;
      console.log("从文档标题提取:", doc.title);
    }
    
    // 方法5: 从所在句子中推断标题
    // 例如 "在文章《实际标题》中提到..."
    const titlePatterns = [
      /["''""]([^"""'']+)["''"']/,           // 引号中的内容
      /《([^》]+)》/,                        // 中文书名号中的内容
      /titled\s+["']([^"']+)["']/i,          // titled "..."
      /entitled\s+["']([^"']+)["']/i,        // entitled "..."
      /article\s+["']([^"']+)["']/i,         // article "..."
      /paper\s+["']([^"']+)["']/i,           // paper "..."
      /called\s+["']([^"']+)["']/i,          // called "..."
      /titled\s+([A-Z][^,.;]+)/i,            // titled Capitalized Text
      /article\s+on\s+([A-Z][^,.;]+)/i,      // article on Capitalized Text
      /paper\s+on\s+([A-Z][^,.;]+)/i,        // paper on Capitalized Text
      /in\s+["']([^"']+)["']/i,              // in "..."
    ];
    
    // 从句子中寻找可能的标题
    for (const pattern of titlePatterns) {
      const match = sentence.match(pattern);
      if (match && match[1] && match[1].length > 3 && match[1].length < 100) {
        const title = match[1].trim();
        potentialTitles.push(title);
        titleScores[title] = (titleScores[title] || 0) + 5;
        console.log("从句子模式中提取:", title, "使用模式:", pattern);
      }
    }
    
    // 方法6: 尝试从URL中提取
    try {
      const currentLocation = window.book_rendition && typeof window.book_rendition.location === 'function' 
        ? window.book_rendition.location() 
        : (window.book_rendition && window.book_rendition.location);
      
      if (currentLocation && currentLocation.start && currentLocation.start.href) {
        const href = currentLocation.start.href;
        
        // 尝试从URL路径中提取信息
        const pathParts = href.split('/');
        const fileName = pathParts[pathParts.length - 1].split('.')[0];
        
        // 如果文件名看起来像标题（而不是index_123这样的格式）
        if (fileName && !fileName.match(/^index/) && !fileName.match(/^\d+$/)) {
          // 将下划线和连字符转换为空格，并将首字母大写
          const title = fileName.replace(/[_-]/g, ' ')
                               .replace(/\b\w/g, l => l.toUpperCase());
          
          potentialTitles.push(title);
          titleScores[title] = (titleScores[title] || 0) + 2;
          console.log("从文件名提取:", title);
        }
      }
    } catch (e) {
      console.error("从URL提取标题失败:", e);
    }
    
    // 根据得分选择最佳标题
    let bestTitle = null;
    let bestScore = 0;
    
    console.log("候选标题及得分:");
    for (const title of potentialTitles) {
      console.log(`- "${title}": ${titleScores[title]}分`);
      if (titleScores[title] > bestScore) {
        bestScore = titleScores[title];
        bestTitle = title;
      }
    }
    
    if (bestTitle) {
      console.log("选择得分最高的标题:", bestTitle, "得分:", bestScore);
      return bestTitle;
    }
    
    return null;
  } catch (e) {
    console.error("从上下文提取标题时出错:", e);
    return null;
  }
}

// 提取选区所在的完整句子
function extractSentence(range, selectedText) {
  try {
    // 获取选区所在节点的文本内容
    let node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) {
      console.warn("选区不在文本节点中，无法提取完整句子");
      return selectedText;
    }
    
    // 获取完整的段落文本
    let paragraphText = node.textContent;
    
    // 尝试扩展到父元素获取更完整的段落
    let parentElement = node.parentElement;
    if (parentElement && parentElement.textContent.length > paragraphText.length) {
      paragraphText = parentElement.textContent;
    }
    
    // 定义句子结束标记
    const sentenceEndMarkers = ['. ', '! ', '? ', '。', '！', '？', '\n'];
    
    // 查找选中文本在段落中的位置
    const textIndex = paragraphText.indexOf(selectedText);
    if (textIndex === -1) {
      console.warn("在段落中找不到选中文本，无法提取完整句子");
      return selectedText;
    }
    
    // 向前查找句子开始
    let sentenceStart = 0;
    for (let i = textIndex; i >= 0; i--) {
      // 检查是否是句子结束标记（意味着下一个字符是新句子的开始）
      for (const marker of sentenceEndMarkers) {
        if (i >= marker.length && paragraphText.substring(i - marker.length, i) === marker) {
          sentenceStart = i;
          break;
        }
      }
      if (sentenceStart > 0) break;
    }
    
    // 向后查找句子结束
    let sentenceEnd = paragraphText.length;
    for (let i = textIndex + selectedText.length; i < paragraphText.length; i++) {
      // 检查是否是句子结束标记
      for (const marker of sentenceEndMarkers) {
        if (i + marker.length <= paragraphText.length && 
            paragraphText.substring(i, i + marker.length) === marker) {
          sentenceEnd = i + marker.length;
          break;
        }
      }
      if (sentenceEnd < paragraphText.length) break;
    }
    
    // 提取完整句子
    let sentence = paragraphText.substring(sentenceStart, sentenceEnd).trim();
    
    // 如果句子过长，可以截断
    const maxLength = 200;
    if (sentence.length > maxLength) {
      // 在选中文本前后各保留一定字符
      const before = Math.floor((maxLength - selectedText.length) / 2);
      const selectedIndex = sentence.indexOf(selectedText);
      
      if (selectedIndex !== -1) {
        let start = Math.max(0, selectedIndex - before);
        let end = Math.min(sentence.length, start + maxLength);
        
        // 调整以确保包含完整的选中文本
        if (end < selectedIndex + selectedText.length) {
          end = selectedIndex + selectedText.length;
          start = Math.max(0, end - maxLength);
        }
        
        sentence = (start > 0 ? '...' : '') + 
                   sentence.substring(start, end) + 
                   (end < sentence.length ? '...' : '');
      } else {
        // 如果找不到选中文本，简单截断
        sentence = sentence.substring(0, maxLength) + '...';
      }
    }
    
    return sentence;
  } catch (e) {
    console.error("提取句子时出错:", e);
    return selectedText;
  }
}

// 提取书籍、章节和文章信息
function extractBookInfo() {
  try {
    let info = {
      title: '未知书籍',
      author: '未知作者',
      chapter: '未知章节',
      article: '未知文章'
    };
    
    console.log("==================== 开始提取书籍信息 ====================");
    
    // 尝试从DOM获取书籍标题
    const titleElement = $('#book-info-title');
    if (titleElement.length && titleElement.text().trim()) {
      info.title = titleElement.text().trim();
      console.log("从DOM获取到书籍标题:", info.title);
    }
    
    // 尝试从DOM获取作者
    const authorElement = $('#book-info-author');
    if (authorElement.length && authorElement.text().trim()) {
      info.author = authorElement.text().trim();
      console.log("从DOM获取到作者:", info.author);
    }
    
    // 输出所有可能的文档信息
    console.log("==================== 导航和章节信息 ====================");
    
    // 获取所有book对象信息
    if (window.book_epub) {
      console.log("book_epub对象:", window.book_epub);
      
      if (window.book_epub.package && window.book_epub.package.metadata) {
        const metadata = window.book_epub.package.metadata;
        console.log("EPUB元数据:", metadata);
        
        // 尝试从元数据中获取标题和作者
        if (metadata.title && !info.title.includes('未知')) {
          console.log("从EPUB元数据获取到书籍标题:", metadata.title);
        }
        
        if (metadata.creator && !info.author.includes('未知')) {
          console.log("从EPUB元数据获取到作者:", metadata.creator);
        }
      }
    }
    
    // 尝试获取当前章节信息
    if (window.book_rendition) {
      console.log("book_rendition对象:", window.book_rendition);
      
      // 安全地获取位置信息
      let location = null;
      let currentHref = null;
      
      try {
        // 检查location是否为函数
        if (typeof window.book_rendition.location === 'function') {
          location = window.book_rendition.location();
          console.log("通过函数调用获取rendition位置信息:", location);
        } 
        // 检查是否是直接属性
        else if (window.book_rendition.location) {
          location = window.book_rendition.location;
          console.log("直接获取rendition位置信息:", location);
        }
        
        // 从location中提取href
        if (location && location.start && location.start.href) {
          currentHref = location.start.href;
        } else if (window.book_rendition.currentLocation && window.book_rendition.currentLocation.start) {
          currentHref = window.book_rendition.currentLocation.start.href;
        }
        
        console.log("当前章节URL:", currentHref);
      } catch (e) {
        console.error("获取位置信息时出错:", e);
      }
      
      // 如果有导航信息，输出完整导航
      if (window.book_epub && window.book_epub.navigation) {
        try {
          console.log("导航对象:", window.book_epub.navigation);
          // 使用更安全的方式输出导航信息
          if (window.book_epub.navigation.toc) {
            console.log("导航目录条目数:", window.book_epub.navigation.toc.length);
            // 只输出前几项，避免过多信息
            const sampleToc = window.book_epub.navigation.toc.slice(0, 3);
            console.log("导航目录样本:", sampleToc);
          }
        } catch (e) {
          console.error("输出导航信息时出错:", e);
        }
      }
    }
    
    console.log("==================== 提取文章标题的所有可能来源 ====================");
    
    // 获取iframe文档的所有可能标题
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentDocument) {
      // 输出iframe基本信息
      console.log("iframe URL:", iframe.src);
      console.log("iframe document title:", iframe.contentDocument.title);
      
      // 输出所有heading元素
      console.log("--- H1标签 ---");
      const h1Elements = iframe.contentDocument.querySelectorAll('h1');
      for (let i = 0; i < h1Elements.length; i++) {
        console.log(`H1[${i}]:`, h1Elements[i].textContent.trim());
      }
      
      console.log("--- H2标签 ---");
      const h2Elements = iframe.contentDocument.querySelectorAll('h2');
      for (let i = 0; i < h2Elements.length; i++) {
        console.log(`H2[${i}]:`, h2Elements[i].textContent.trim());
      }
      
      console.log("--- H3标签 ---");
      const h3Elements = iframe.contentDocument.querySelectorAll('h3');
      for (let i = 0; i < h3Elements.length; i++) {
        console.log(`H3[${i}]:`, h3Elements[i].textContent.trim());
      }
      
      // 输出所有可能的标题元素
      console.log("--- 可能的标题元素 ---");
      const possibleTitleElements = iframe.contentDocument.querySelectorAll(
        'header, .title, .article-title, .heading, .chapter-title, ' + 
        '[class*="title"], [class*="heading"], [id*="title"], [id*="heading"]'
      );
      
      for (let i = 0; i < possibleTitleElements.length; i++) {
        const element = possibleTitleElements[i];
        console.log(`标题元素[${i}] (${element.tagName}.${element.className}):`, 
                    element.textContent.trim());
      }
      
      // 输出特定结构中的内容
      console.log("--- 第一段文本 ---");
      const firstParagraph = iframe.contentDocument.querySelector('p');
      if (firstParagraph) {
        console.log("第一段内容:", firstParagraph.textContent.trim());
      }
      
      // 输出文档中的前几个文本节点
      const allTextNodes = [];
      const walker = document.createTreeWalker(
        iframe.contentDocument.body, 
        NodeFilter.SHOW_TEXT, 
        { acceptNode: function(node) { 
          return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }}, 
        false
      );
      
      console.log("--- 前5个非空文本节点 ---");
      let node;
      let count = 0;
      while ((node = walker.nextNode()) && count < 5) {
        if (node.textContent.trim().length > 10) {
          console.log(`文本节点[${count}]:`, node.textContent.trim());
          count++;
        }
      }
    }
    
    // 标准提取过程...
    // 尝试从导航获取章节名
    if (window.book_epub && window.book_epub.navigation && currentHref) {
      try {
        // 获取导航目录
        const toc = window.book_epub.navigation.toc || [];
        
        // 先处理一级导航
        for (const item of toc) {
          if (item.href && currentHref && currentHref.includes(item.href)) {
            info.chapter = item.label || item.title || info.chapter;
            console.log("从一级导航找到章节:", info.chapter);
            
            // 查找子导航项
            if (item.subitems && item.subitems.length) {
              for (const subitem of item.subitems) {
                if (subitem.href && currentHref.includes(subitem.href)) {
                  info.article = subitem.label || subitem.title || info.article;
                  console.log("从子导航找到文章:", info.article);
                  break;
                }
              }
            }
            
            break;
          }
        }
      } catch (e) {
        console.error("从导航提取章节信息时出错:", e);
      }
    }
    
    console.log("==================== 最终提取结果 ====================");
    console.log("书籍信息:", info);
    
    return info;
  } catch (e) {
    console.error("提取书籍信息时出错:", e);
    return {
      title: '未知书籍',
      author: '未知作者',
      chapter: '未知章节',
      article: '未知文章'
    };
  }
}

// 获取最近的标题元素
function getClosestHeading(element, headingTag) {
  // 向上查找
  let current = element;
  while (current && current.tagName !== 'BODY') {
    if (current.tagName && current.tagName.toLowerCase() === headingTag) {
      return current;
    }
    
    // 检查前一个同级元素
    let previous = current.previousElementSibling;
    while (previous) {
      if (previous.tagName && previous.tagName.toLowerCase() === headingTag) {
        return previous;
      }
      previous = previous.previousElementSibling;
    }
    
    current = current.parentElement;
  }
  
  // 如果向上未找到，查找文档中第一个符合条件的标题
  return element.ownerDocument.querySelector(headingTag);
}

// 获取第一个有意义的段落
function getFirstSignificantParagraph(element) {
  // 查找所有段落
  const paragraphs = element.querySelectorAll('p');
  
  // 筛选非空且长度大于10的段落
  for (let i = 0; i < paragraphs.length; i++) {
    const text = paragraphs[i].textContent.trim();
    if (text.length > 10) {
      return paragraphs[i];
    }
  }
  
  return null;
}

// 添加CMD+J/CMD+K快捷键触发高亮/删除高亮
(function() {
  console.log("注册CMD+J/CMD+K快捷键");
  
  // 直接在document上监听键盘事件，使用捕获阶段，确保最先捕获事件
  document.addEventListener('keydown', function(e) {
    // CMD+J (Mac) 或 Ctrl+J (Windows/Linux) - 高亮文本
    if ((e.metaKey || e.ctrlKey) && (e.keyCode === 74 || e.key.toLowerCase() === 'j')) {
      console.log("检测到CMD+J/Ctrl+J快捷键", e);
      e.preventDefault(); // 阻止默认行为
      e.stopPropagation(); // 阻止事件传播
      window.highlightSelectedText();
      return false;
    }
    
    // CMD+K (Mac) 或 Ctrl+K (Windows/Linux) - 删除高亮
    if ((e.metaKey || e.ctrlKey) && (e.keyCode === 75 || e.key.toLowerCase() === 'k')) {
      console.log("检测到CMD+K/Ctrl+K快捷键", e);
      e.preventDefault(); // 阻止默认行为
      e.stopPropagation(); // 阻止事件传播
      window.deleteSelectedHighlight();
      return false;
    }
  }, true); // 使用捕获阶段，确保在冒泡阶段之前处理
  
  // 在iframe中监听键盘事件（作为备用方案）
  window.setupIframeKeyboardShortcuts = function() {
    console.log("设置iframe键盘快捷键");
    try {
      const iframe = document.querySelector('iframe');
      if (!iframe || !iframe.contentDocument) {
        console.warn("找不到iframe或其contentDocument，无法在iframe中注册快捷键");
        return;
      }
      
      // 先移除现有的事件监听器（避免重复添加）
      if (iframe.contentDocument._hasKeyboardListener) {
        console.log("已存在键盘监听器，跳过添加");
        return;
      }
      
      // 给iframe内容添加键盘事件监听，使用捕获阶段
      const keydownHandler = function(e) {
        // CMD+J (Mac) 或 Ctrl+J (Windows/Linux) - 高亮文本
        if ((e.metaKey || e.ctrlKey) && (e.keyCode === 74 || e.key.toLowerCase() === 'j')) {
          console.log("在iframe中检测到CMD+J/Ctrl+J快捷键", e);
          e.preventDefault(); // 阻止默认行为
          e.stopPropagation(); // 阻止事件传播
          window.highlightSelectedText();
          return false;
        }
        
        // CMD+K (Mac) 或 Ctrl+K (Windows/Linux) - 删除高亮
        if ((e.metaKey || e.ctrlKey) && (e.keyCode === 75 || e.key.toLowerCase() === 'k')) {
          console.log("在iframe中检测到CMD+K/Ctrl+K快捷键", e);
          e.preventDefault(); // 阻止默认行为
          e.stopPropagation(); // 阻止事件传播
          window.deleteSelectedHighlight();
          return false;
        }
      };
      
      iframe.contentDocument.addEventListener('keydown', keydownHandler, true);
      // 标记已添加事件监听器
      iframe.contentDocument._hasKeyboardListener = true;
      
      console.log("已在iframe中注册CMD+J/CMD+K快捷键");
    } catch (e) {
      console.error("在iframe中注册快捷键失败:", e);
    }
  };
  
  // 监听iframe加载完成事件
  window.addEventListener('load', function() {
    console.log("页面加载完成，检查iframe并设置快捷键");
    window.setupIframeKeyboardShortcuts();
  });
  
  // 在每次页面渲染后设置iframe快捷键
  if (window.book_rendition) {
    window.book_rendition.on("rendered", function() {
      console.log("页面渲染完成，设置iframe快捷键");
      window.setupIframeKeyboardShortcuts();
    });
  }
  
  // 初始化时也尝试设置iframe快捷键
  const checkInterval = setInterval(() => {
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentDocument) {
      window.setupIframeKeyboardShortcuts();
      clearInterval(checkInterval);
    }
  }, 1000);
  
  // 10秒后停止检查
  setTimeout(() => clearInterval(checkInterval), 10000);
  
  console.log("已在document上注册CMD+J/CMD+K快捷键");
})();

// 保存高亮数据到localStorage
function saveHighlights() {
  try {
    console.log("尝试保存高亮数据");
    
    // 尝试不同的方法获取书籍ID
    let bookKey = null;
    
    if (window.book_epub && typeof window.book_epub.key === 'function') {
      bookKey = window.book_epub.key();
      console.log("通过book_epub.key()获取书籍ID:", bookKey);
    } else if (window.epubCodeSearch) {
      bookKey = window.epubCodeSearch;
      console.log("通过epubCodeSearch获取书籍ID:", bookKey);
    } else if (window.location.search) {
      // 从URL获取
      const searchParams = new URLSearchParams(window.location.search);
      const bookId = searchParams.get('book');
      if (bookId) {
        bookKey = bookId;
        console.log("通过URL参数获取书籍ID:", bookKey);
      }
    }
    
    if (!bookKey) {
      console.error("无法找到合适的书籍标识符，无法保存高亮");
      return;
    }
    
    // 保存到localStorage
    const storageKey = `${bookKey}-highlights`;
    localStorage.setItem(storageKey, JSON.stringify(window.highlights));
    
    console.log("高亮数据已保存到", storageKey, "，当前共有", window.highlights.length, "个高亮");
  } catch (e) {
    console.error("保存高亮数据时出错:", e);
  }
}

// 加载已保存的高亮数据
window.loadHighlights = function() {
  try {
    console.log("尝试加载高亮数据");
    
    // 尝试不同的方法获取书籍ID
    let bookKey = null;
    
    if (window.book_epub && typeof window.book_epub.key === 'function') {
      bookKey = window.book_epub.key();
      console.log("通过book_epub.key()获取书籍ID:", bookKey);
    } else if (window.epubCodeSearch) {
      bookKey = window.epubCodeSearch;
      console.log("通过epubCodeSearch获取书籍ID:", bookKey);
    } else if (window.location.search) {
      // 从URL获取
      const searchParams = new URLSearchParams(window.location.search);
      const bookId = searchParams.get('book');
      if (bookId) {
        bookKey = bookId;
        console.log("通过URL参数获取书籍ID:", bookKey);
      }
    }
    
    if (!bookKey) {
      console.error("无法找到合适的书籍标识符，无法加载高亮");
      return;
    }
    
    console.log("使用bookKey:", bookKey);
    
    // 从localStorage获取高亮数据
    const storageKey = `${bookKey}-highlights`;
    const savedHighlights = localStorage.getItem(storageKey);
    
    if (savedHighlights) {
      try {
        window.highlights = JSON.parse(savedHighlights);
        console.log("已加载", window.highlights.length, "个高亮从", storageKey);
        
        // 渲染所有高亮
        renderHighlights();
      } catch (e) {
        console.error("解析保存的高亮数据失败:", e);
        window.highlights = [];
      }
    } else {
      console.log("没有找到保存的高亮数据");
      window.highlights = [];
    }
  } catch (e) {
    console.error("加载高亮数据时出错:", e);
    window.highlights = [];
  }
};

// 渲染所有高亮
function renderHighlights() {
  console.log("尝试渲染高亮");
  
  // 确保book_rendition存在
  if (!window.book_rendition) {
    console.error("window.book_rendition不存在，无法渲染高亮");
    return;
  }
  
  // 手动清除现有高亮
  try {
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentDocument) {
      const highlights = iframe.contentDocument.querySelectorAll('.highlight-text');
      highlights.forEach(el => el.remove());
      console.log("手动清除高亮成功，移除了", highlights.length, "个高亮");
    }
    
    // 也尝试通过rendition的annotations API清除高亮
    // if (window.book_rendition.annotations && typeof window.book_rendition.annotations.clear === 'function') {
    //   window.book_rendition.annotations.clear();
    //   console.log("通过annotations API清除高亮成功");
    // }
  } catch (e) {
    console.error("清除高亮失败:", e);
    return;
  }
  
  // 获取当前章节信息，用于过滤高亮
  const currentChapterIndex = window.book_rendition.currentChapterIndex;
  const currentHref = window.book_rendition.location && window.book_rendition.location.start && window.book_rendition.location.start.href;
  console.log("当前章节信息:", { index: currentChapterIndex, href: currentHref });
  
  // 添加所有高亮
  let addedCount = 0;
  
  window.highlights.forEach(highlight => {
    try {
      // 判断高亮类型 - 支持两种格式：JSON结构和CFI字符串
      if (typeof highlight.cfi === 'string') {
        if (highlight.cfi.startsWith('{') || highlight.cfi.startsWith('[')) {
          // JSON结构的高亮 - 使用手动方法
          handleJsonHighlight(highlight, currentChapterIndex, currentHref);
        } else {
          // CFI字符串格式的高亮 - 使用rendition API
          handleCfiHighlight(highlight);
        }
      } else {
        console.log("不支持的高亮格式，跳过:", highlight.id);
      }
    } catch (e) {
      console.error("渲染高亮时出错:", e, highlight);
    }
  });
  
  console.log("高亮渲染完成，成功添加", addedCount, "/", window.highlights.length, "个高亮");
  
  // 处理JSON结构的高亮
  function handleJsonHighlight(highlight, currentChapterIndex, currentHref) {
    try {
      const position = JSON.parse(highlight.cfi);
      
      // 检查章节是否匹配
      let chapterMatches = false;
      if (position.chapterHref && currentHref) {
        chapterMatches = position.chapterHref === currentHref;
      } else if (position.chapterIndex !== undefined && currentChapterIndex !== undefined) {
        chapterMatches = position.chapterIndex === currentChapterIndex;
      }
      
      if (!chapterMatches) {
        console.log("高亮不在当前章节，跳过:", highlight.id);
        return; // 跳过此高亮
      }
      
      // 只使用手动高亮方法
      if (position && position.text) {
        // 在iframe中查找文本并添加高亮
        const iframe = document.querySelector('iframe');
        if (iframe && iframe.contentDocument) {
          const textNodes = [];
          const walker = document.createTreeWalker(
            iframe.contentDocument.body, 
            NodeFilter.SHOW_TEXT, 
            null, 
            false
          );
          
          let node;
          while (node = walker.nextNode()) {
            if (node.nodeValue.includes(position.text)) {
              textNodes.push(node);
            }
          }
          
          console.log("找到", textNodes.length, "个匹配文本节点");
          
          if (textNodes.length > 0) {
            // 使用第一个匹配节点
            const textNode = textNodes[0];
            const text = textNode.nodeValue;
            const index = text.indexOf(position.text);
            
            if (index >= 0) {
              // 分割节点并插入高亮span
              const range = document.createRange();
              range.setStart(textNode, index);
              range.setEnd(textNode, index + position.text.length);
              
              const span = iframe.contentDocument.createElement('span');
              span.className = 'highlight-text';
              span.dataset.id = highlight.id;
              
              try {
                range.surroundContents(span);
                addedCount++;
                console.log("手动添加高亮成功:", highlight.id);
              } catch (e) {
                console.error("创建高亮元素失败:", e);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("处理JSON高亮失败:", e);
    }
  }
  
  // 处理CFI字符串格式的高亮
  function handleCfiHighlight(highlight) {
    try {
      // 使用rendition的annotations API添加高亮
      if (window.book_rendition.annotations && typeof window.book_rendition.annotations.add === 'function') {
        // 检测高亮类型
        const highlightType = highlight.type || 'word';
        const className = 'highlight-' + highlightType;
        
        // 根据类型设置样式
        const fillColor = highlightType === 'word' ? 'yellow' : 
                        (highlightType === 'sentence' ? '#8eff52' : 'orange');
        
        // 添加高亮
        window.book_rendition.annotations.add(
          'highlight', 
          highlight.cfi, 
          { id: highlight.id }, 
          null, 
          className, 
          {
            'fill': fillColor,
            'fill-opacity': '0.4'
          }
        );
        
        addedCount++;
        console.log("通过annotations API添加高亮成功:", highlight.id);
      } else {
        console.error("annotations API不可用，无法添加高亮");
      }
    } catch (e) {
      console.error("处理CFI高亮失败:", e);
    }
  }
}

// 添加高亮按钮到右键菜单
window.addHighlightButtonToMenu = function() {
  console.log("添加高亮/删除高亮按钮到右键菜单");
  
  // 获取右键菜单
  const actionMenu = document.getElementById('book-action-menu');
  if (!actionMenu) {
    console.error("找不到右键菜单");
    return;
  }
  
  // 检查选中文本是否已被高亮
  const highlightInfo = window.checkSelectedTextHighlighted();
  console.log("菜单高亮状态检查结果:", highlightInfo);
  
  // 移除之前的高亮按钮（如果存在）
  const existingHighlightButton = document.getElementById('action-menu-highlight');
  if (existingHighlightButton) {
    existingHighlightButton.remove();
  }
  
  // 移除之前的删除高亮按钮（如果存在）
  const existingDeleteButton = document.getElementById('action-menu-delete-highlight');
  if (existingDeleteButton) {
    existingDeleteButton.remove();
  }
  
  // 根据高亮状态添加相应的按钮
  if (highlightInfo.isHighlighted) {
    // 如果文本已被高亮，添加删除高亮按钮
    const deleteButton = document.createElement('li');
    deleteButton.id = 'action-menu-delete-highlight';
    deleteButton.className = 'main-text text-sb flex-row flex-v-center';
    deleteButton.onclick = function() {
      window.deleteSelectedHighlight();
      document.getElementById('book-action-menu').style.display = 'none';
    };
    
    // 添加图标和文本
    deleteButton.innerHTML = `
      <svg class="m-r-10" width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M8 4V5H4V7H5V16C5 16.5523 5.44772 17 6 17H14C14.5523 17 15 16.5523 15 16V7H16V5H12V4H8ZM7 7H13V15H7V7ZM9 9H8V13H9V9ZM11 9H12V13H11V9Z" fill="#f44336"/>
      </svg>删除高亮 (CMD+K)
    `;
    
    // 添加到菜单开头
    actionMenu.insertBefore(deleteButton, actionMenu.firstChild);
  } else {
    // 如果文本未被高亮，添加高亮按钮
    const highlightButton = document.createElement('li');
    highlightButton.id = 'action-menu-highlight';
    highlightButton.className = 'main-text text-sb flex-row flex-v-center';
    highlightButton.onclick = function() {
      window.highlightSelectedText();
      document.getElementById('book-action-menu').style.display = 'none';
    };
    
    // 添加图标和文本
    highlightButton.innerHTML = `
      <svg class="m-r-10" width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M2 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4zm2 0h12v12H4V4zm3 3a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H7zm0 4a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7z" fill="black"/>
      </svg>高亮文本 (CMD+J)
    `;
    
    // 添加到菜单开头
    actionMenu.insertBefore(highlightButton, actionMenu.firstChild);
  }
  
  console.log("高亮/删除高亮按钮已添加到右键菜单");
};

// 监听文本选择 - 只添加按钮到菜单，简化逻辑
window.monitorTextSelection = function() {
  console.log("初始化文本选择监听器...");
  
  // 添加高亮按钮到右键菜单
  window.addHighlightButtonToMenu();
  
  console.log("文本选择监听器设置完成");
};

// 初始化右键菜单
window.initContextMenu = function() {
  console.log("初始化右键菜单");
  
  // 添加高亮按钮到右键菜单
  window.addHighlightButtonToMenu();
  
  // 监听文本选择
  window.monitorTextSelection();
  
  // 初始化高亮列表弹出窗口
  window.initHighlightListPopup();
};

// 初始化高亮列表弹出窗口功能
window.initHighlightListPopup = function() {
  console.log("初始化高亮列表弹出窗口");
  
  const $popup = document.getElementById('highlight-list-popup');
  const $closeBtn = $popup.querySelector('.popup-close');
  const $tabButtons = $popup.querySelectorAll('.tab-button');
  const $highlightListBtn = document.getElementById('highlight-list-btn');
  
  // 当前章节和全部书籍的高亮列表元素
  const $currentHighlightsList = document.getElementById('current-chapter-highlights');
  const $allHighlightsList = document.getElementById('all-book-highlights');
  
  // 打开弹窗
  $highlightListBtn.addEventListener('click', function(e) {
    console.log("点击了高亮列表按钮");
    
    // 加载高亮数据
    window.loadHighlightsForPopup();
    
    // 显示弹窗
    $popup.style.display = 'block';
    e.preventDefault();
  });
  
  // 关闭弹窗
  $closeBtn.addEventListener('click', function() {
    $popup.style.display = 'none';
  });
  
  // 点击弹窗背景不关闭
  $popup.addEventListener('click', function(e) {
    e.stopPropagation();
  });
  
  // 标签切换
  $tabButtons.forEach(function(button) {
    button.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');
      
      // 保存当前选中的标签
      try {
        const settings = JSON.parse(localStorage.getItem('reader-settings') || '{}');
        settings.highlightListTab = tabId;
        localStorage.setItem('reader-settings', JSON.stringify(settings));
      } catch (e) {
        console.error('保存设置失败:', e);
      }
      
      // 切换标签和内容
      $tabButtons.forEach(btn => btn.classList.remove('active'));
      $popup.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      this.classList.add('active');
      
      if (tabId === 'current') {
        document.getElementById('current-highlights').classList.add('active');
      } else {
        document.getElementById('all-highlights').classList.add('active');
      }
    });
  });
  
  // 恢复之前的标签选择
  try {
    const settings = JSON.parse(localStorage.getItem('reader-settings') || '{}');
    if (settings.highlightListTab === 'all') {
      const allTabButton = document.querySelector('[data-tab="all"]');
      if (allTabButton) allTabButton.click();
    }
  } catch (e) {
    console.error('加载设置失败:', e);
  }
};

// 加载高亮数据到弹出窗口
window.loadHighlightsForPopup = function() {
  console.log("加载高亮数据到弹出窗口");
  
  // 获取当前章节和全部书籍的高亮列表元素
  const $currentHighlightsList = document.getElementById('current-chapter-highlights');
  const $allHighlightsList = document.getElementById('all-book-highlights');
  
  if (!$currentHighlightsList || !$allHighlightsList) {
    console.error("找不到高亮列表元素");
    return;
  }
  
  try {
    // 获取所有高亮
    const allHighlights = window.highlights || [];
    console.log('已加载全部高亮:', allHighlights.length, '条');
    
    // 获取当前章节信息
    let currentChapter = '';
    let currentCfi = '';
    let currentSpinePosition = -1;
    
    try {
      // 尝试获取当前位置的CFI
      if (window.book_rendition && window.book_rendition.currentLocation) {
        const location = window.book_rendition.currentLocation();
        if (location && location.start) {
          currentCfi = location.start.cfi;
          console.log('当前CFI:', currentCfi);
          
          // 尝试获取当前spine位置
          if (window.book_epub && window.book_epub.spine) {
            try {
              const spineItem = window.book_epub.spine.get(currentCfi);
              if (spineItem) {
                currentSpinePosition = spineItem.index;
                console.log('当前Spine位置:', currentSpinePosition);
              }
            } catch (e) {
              console.warn('无法获取当前spine位置:', e);
            }
          }
        }
      }
      
      // 获取当前章节URL
      const iframe = document.querySelector('iframe');
      if (iframe && iframe.contentWindow && iframe.contentWindow.location) {
        currentChapter = iframe.contentWindow.location.href || '';
        console.log('当前章节URL:', currentChapter);
      }
    } catch (e) {
      console.warn('无法获取当前章节信息:', e);
    }
    
    // 筛选当前章节的高亮
    const currentHighlights = allHighlights.filter(function(highlight) {
      // 如果有spine位置信息，优先使用
      if (currentSpinePosition >= 0 && highlight.spinePosition !== undefined) {
        return highlight.spinePosition === currentSpinePosition;
      }
      
      // 尝试从CFI匹配
      if (currentCfi && highlight.cfi) {
        // 比较CFI的章节部分 (通常是形如"/6/4[chap01]"的格式)
        const cfiMatch = currentCfi.match(/\/\d+\/\d+(\[[^\]]+\])?/);
        const highlightCfiMatch = highlight.cfi.match(/\/\d+\/\d+(\[[^\]]+\])?/);
        
        if (cfiMatch && highlightCfiMatch && cfiMatch[0] === highlightCfiMatch[0]) {
          return true;
        }
      }
      
      // 尝试从href匹配章节
      if (highlight.href && currentChapter && 
          (highlight.href.includes(currentChapter) || currentChapter.includes(highlight.href))) {
        return true;
      }
      
      // 尝试从chapter字段匹配
      if (window.book_chapterTitle && highlight.chapter && 
          (highlight.chapter.includes(window.book_chapterTitle) || 
           window.book_chapterTitle.includes(highlight.chapter))) {
        return true;
      }
      
      return false;
    });
    
    console.log('当前章节高亮:', currentHighlights.length, '条');
    
    // 渲染高亮列表
    renderHighlightList($currentHighlightsList, currentHighlights);
    renderHighlightList($allHighlightsList, allHighlights);
  } catch (e) {
    console.error('加载高亮数据失败:', e);
  }
};

// 渲染高亮列表
function renderHighlightList(listElement, highlights) {
  // 清空列表
  listElement.innerHTML = '';
  
  if (!highlights || highlights.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'popup-highlight-item empty';
    emptyItem.textContent = '没有高亮内容';
    listElement.appendChild(emptyItem);
    return;
  }
  
  // 按时间降序排序
  highlights.sort(function(a, b) {
    return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
  });
  
  // 渲染每一项
  highlights.forEach(function(highlight) {
    const typeClass = 'highlight-type-' + (highlight.type || 'word');
    const truncatedText = highlight.text.length > 100 ? 
        highlight.text.substring(0, 100) + '...' : 
        highlight.text;
    
    const item = document.createElement('li');
    item.className = 'popup-highlight-item ' + typeClass;
    
    // 添加文本
    const textDiv = document.createElement('div');
    textDiv.className = 'popup-highlight-text';
    textDiv.textContent = truncatedText;
    item.appendChild(textDiv);
    
    // 添加章节和时间信息
    let contextInfo = '';
    let timeStr = '';
    
    // 尝试获取最有意义的上下文信息
    if (highlight.bookInfo && highlight.bookInfo.article && highlight.bookInfo.article !== '未知文章') {
      contextInfo = highlight.bookInfo.article;
    } else if (highlight.chapter && highlight.chapter !== '未知章节') {
      contextInfo = highlight.chapter;
    } else if (highlight.bookInfo && highlight.bookInfo.chapter && highlight.bookInfo.chapter !== '未知章节') {
      contextInfo = highlight.bookInfo.chapter;
    } else if (highlight.sentence && highlight.sentence.length > 0 && highlight.sentence !== highlight.text) {
      // 使用句子的前20个字符作为上下文
      contextInfo = highlight.sentence.length > 20 ? 
                    highlight.sentence.substring(0, 20) + '...' : 
                    highlight.sentence;
    }
    
    if (highlight.timestamp) {
      try {
        const date = new Date(highlight.timestamp);
        timeStr = date.getFullYear() + '/' + 
                 (date.getMonth() + 1) + '/' + 
                 date.getDate() + ' ' + 
                 date.getHours() + ':' + 
                 (date.getMinutes() < 10 ? '0' : '') + date.getMinutes();
      } catch (e) {
        timeStr = highlight.timestamp;
      }
    }
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'popup-highlight-info';
    
    // 只有在有意义的上下文信息存在时才显示
    if (contextInfo) {
      infoDiv.innerHTML = `
        <span class="popup-highlight-chapter" title="${contextInfo}">${contextInfo}</span>
        <span class="popup-highlight-time">${timeStr}</span>
      `;
    } else {
      // 如果没有上下文信息，只显示时间
      infoDiv.innerHTML = `
        <span class="popup-highlight-time" style="width: 100%; text-align: right;">${timeStr}</span>
      `;
    }
    
    item.appendChild(infoDiv);
    
    // 添加点击事件，跳转到高亮位置
    item.addEventListener('click', function() {
      try {
        // 创建一个跳转函数，以便尝试多种方法
        const navigateToHighlight = async () => {
          // 首先尝试使用epubCfi（最可靠）
          if (highlight.epubCfi) {
            try {
              console.log("使用epubCfi跳转:", highlight.epubCfi);
              await window.book_rendition.display(highlight.epubCfi);
              return true;
            } catch (e) {
              console.warn("epubCfi跳转失败:", e);
            }
          }
          
          // 然后尝试使用普通cfi
          if (highlight.cfi) {
            try {
              console.log("使用cfi跳转:", highlight.cfi);
              // 先检查CFI是否有效
              window.book_epub.spine.get(highlight.cfi);
              await window.book_rendition.display(highlight.cfi);
              return true;
            } catch (e) {
              console.warn("cfi跳转失败:", e);
            }
          }
          
          // 尝试使用href（章节链接）
          if (highlight.href) {
            try {
              console.log("使用href跳转:", highlight.href);
              await window.book_rendition.display(highlight.href);
              return true;
            } catch (e) {
              console.warn("href跳转失败:", e);
            }
          }
          
          // 尝试使用spine位置
          if (highlight.spinePosition !== undefined && highlight.spinePosition >= 0) {
            try {
              console.log("使用spinePosition跳转:", highlight.spinePosition);
              const spineItem = window.book_epub.spine.get(highlight.spinePosition);
              if (spineItem) {
                await window.book_rendition.display(spineItem.href);
                return true;
              }
            } catch (e) {
              console.warn("spinePosition跳转失败:", e);
            }
          }
          
          // 尝试根据章节名称在目录中查找
          if (highlight.chapter) {
            try {
              console.log("尝试根据章节名称跳转:", highlight.chapter);
              if (window.book_epub && window.book_epub.navigation) {
                const toc = window.book_epub.navigation.toc;
                for (let i = 0; i < toc.length; i++) {
                  if (toc[i].label === highlight.chapter && toc[i].href) {
                    await window.book_rendition.display(toc[i].href);
                    return true;
                  }
                }
              }
            } catch (e) {
              console.warn("章节名称跳转失败:", e);
            }
          }
          
          return false;
        };
        
        // 执行跳转
        navigateToHighlight().then(success => {
          if (success) {
            // 隐藏弹窗
            document.getElementById('highlight-list-popup').style.display = 'none';
          } else {
            // 所有方法都失败了
            throw new Error('所有跳转方法都失败了');
          }
        }).catch(e => {
          console.error("跳转失败:", e);
          alert('无法跳转到高亮位置，该章节可能已被修改或删除');
        });
      } catch (e) {
        console.error('跳转到高亮位置失败:', e);
        alert('无法跳转到高亮位置，该章节可能已被修改或删除');
      }
    });
    
    listElement.appendChild(item);
  });
}

// 检查选中的文本是否已经被高亮
window.checkSelectedTextHighlighted = function() {
  console.log("检查选中文本是否已被高亮");
  
  try {
    // 尝试多种方法获取选中文本
    let selection_text = '';
    let iframe = null;
    let range = null;
    let selectedNode = null;
    
    // 方法1：从iframe获取
    try {
      iframe = document.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        const iframeSelection = iframe.contentWindow.getSelection();
        if (iframeSelection && !iframeSelection.isCollapsed) {
          selection_text = iframeSelection.toString().trim();
          if (iframeSelection.rangeCount > 0) {
            range = iframeSelection.getRangeAt(0);
            // 检查选中的节点是否在高亮span内部
            selectedNode = iframeSelection.anchorNode;
            // 向上查找高亮节点
            let currentNode = selectedNode;
            while (currentNode && currentNode.nodeType !== 9) { // 9是Document类型
              if (currentNode.nodeType === 1) { // 元素节点
                if (currentNode.classList && currentNode.classList.contains('highlight-text')) {
                  // 找到了高亮节点
                  return {
                    isHighlighted: true,
                    highlightNode: currentNode,
                    highlightId: currentNode.dataset.id,
                    text: selection_text,
                    range: range
                  };
                }
              }
              currentNode = currentNode.parentNode;
            }
          }
        }
      }
    } catch (e) {
      console.error("从iframe检查高亮失败:", e);
    }
    
    // 检查是否有高亮包含当前选中的文本
    if (selection_text && window.highlights && window.highlights.length > 0) {
      const matchingHighlight = window.highlights.find(h => h.text === selection_text);
      if (matchingHighlight) {
        return {
          isHighlighted: true,
          highlightId: matchingHighlight.id,
          text: selection_text,
          highlight: matchingHighlight,
          range: range
        };
      }
    }
    
    return {
      isHighlighted: false,
      text: selection_text,
      range: range
    };
  } catch (e) {
    console.error("检查高亮状态时出错:", e);
    return { isHighlighted: false };
  }
};

// 移除高亮
window.removeHighlight = function(highlightId) {
  console.log("移除高亮:", highlightId);
  
  if (!highlightId) {
    console.error("无法移除高亮：ID为空");
    return false;
  }
  
  try {
    // 查找索引
    const index = window.highlights.findIndex(h => h.id === highlightId);
    
    if (index !== -1) {
      // 从数组中移除
      const removedHighlight = window.highlights.splice(index, 1)[0];
      console.log("从数组中移除高亮:", removedHighlight);
      
      // 保存到localStorage
      saveHighlights();
      
      // 移除DOM中的高亮元素
      try {
        const iframe = document.querySelector('iframe');
        if (iframe && iframe.contentDocument) {
          const highlightElements = iframe.contentDocument.querySelectorAll(`.highlight-text[data-id="${highlightId}"]`);
          highlightElements.forEach(el => {
            // 获取高亮文本内容
            const text = el.textContent;
            // 创建文本节点代替高亮元素
            const textNode = iframe.contentDocument.createTextNode(text);
            // 替换元素
            el.parentNode.replaceChild(textNode, el);
          });
          console.log("从DOM中移除高亮元素成功");
          
          // 不调用renderHighlights()，而是保留其他高亮
          // 隐藏右键菜单
          const actionMenu = document.getElementById('book-action-menu');
          if (actionMenu) {
            actionMenu.style.display = 'none';
          }
          
          displayAlert("高亮已删除", "success");
          return true;
        }
      } catch (e) {
        console.error("从DOM中移除高亮元素失败:", e);
      }
      
      displayAlert("高亮已删除", "success");
      return true;
    } else {
      console.warn("找不到ID为", highlightId, "的高亮");
      return false;
    }
  } catch (e) {
    console.error("移除高亮失败:", e);
    return false;
  }
};

// 删除选中文本的高亮
window.deleteSelectedHighlight = function() {
  console.log("删除选中文本的高亮");
  
  try {
    // 检查选中文本是否已被高亮
    const highlightInfo = window.checkSelectedTextHighlighted();
    console.log("高亮状态:", highlightInfo);
    
    if (highlightInfo.isHighlighted) {
      // 删除高亮
      window.removeHighlight(highlightInfo.highlightId);
      return true;
    } else {
      console.log("选中的文本未被高亮");
      displayAlert("选中的文本未被高亮", "info");
      return false;
    }
  } catch (e) {
    console.error("删除高亮失败:", e);
    displayAlert("删除高亮失败", "error");
    return false;
  }
}; 