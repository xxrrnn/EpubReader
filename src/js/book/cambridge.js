// Cambridge词典API包装器
// 使用主进程提供的API进行词典查询

/**
 * Cambridge词典API对象
 */
window.cambridgeDict = {
  /**
   * 获取单词信息
   * @param {string} word - 要查询的单词
   * @returns {Promise<Object>} 单词信息对象
   */
  getWordInfo: async function(word) {
    if (!word) {
      console.error('未提供单词');
      return null;
    }
    
         // 移除多余的空格和标点，只保留字母
    word = word.trim().toLowerCase().replace(/[^a-z]/gi, '');
    
    if (word.length === 0) {
      console.error('单词为空');
      return null;
    }
    
    try {
      console.log('通过主进程API查询Cambridge词典:', word);
      // 使用预加载脚本中暴露的API
      const result = await window.cambridgeAPI.getWordInfo(word);
      console.log('Cambridge词典查询结果:', result);
      return result;
    } catch (error) {
      console.error('Cambridge词典查询失败:', error);
      return null;
    }
  },
  
  /**
   * 格式化单词信息输出
   * @param {Object} wordInfo - 单词信息
   * @returns {string} 格式化后的信息
   */
  formatWordInfo: function(wordInfo) {
    return window.cambridgeAPI.formatWordInfo(wordInfo);
  }
}; 