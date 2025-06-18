const { app, BrowserWindow, globalShortcut, ipcMain, dialog, shell, net } = require('electron');
const path = require('path');
// const axios = require('axios');
const cheerio = require('cheerio');

// Cambridge词典爬虫功能
async function fetchCambridgeData(word) {
  try {
    console.log(`开始查询Cambridge词典: ${word}`);
    const urlList = [
      `https://dictionary.cambridge.org/dictionary/english-chinese-simplified/${word}`, 
      `https://dictionary.cambridge.org/dictionary/english/${word}`
    ];

    for (const url of urlList) {
      try {
        console.log(`尝试URL: ${url}`);
        
        // 使用Electron的net模块
        const htmlData = await new Promise((resolve, reject) => {
          const request = net.request({
            method: 'GET',
            url: url,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
              'Accept': 'text/html,application/xhtml+xml,application/xml',
              'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
            }
          });
          
          let responseData = '';
          
          request.on('response', (response) => {
            response.on('data', (chunk) => {
              responseData += chunk.toString();
            });
            
            response.on('end', () => {
              console.log(`请求完成，状态码: ${response.statusCode}`);
              if (response.statusCode === 200) {
                resolve(responseData);
              } else {
                reject(new Error(`请求失败，状态码: ${response.statusCode}`));
              }
            });
            
            response.on('error', (error) => {
              reject(error);
            });
          });
          
          request.on('error', (error) => {
            reject(error);
          });
          
          request.end();
        });
        
        if (!htmlData) {
          console.log('请求返回空数据，跳到下一个URL');
          continue;
        }
        
        console.log('成功获取数据，开始解析');
        const $ = cheerio.load(htmlData);
				
				// 初始化结果对象
				const pageResults = {
					wordUrl: url,
					partOfSpeech: []
				};
				
				// 提取单词原型
				const wordPrototype = $('.headword.dhw').first().text().trim();
				if (wordPrototype === "") {
					continue;
				}
				
				// 提取所有 class.pr.entry-body__el
				$('.entry-body__el').each((i, entryElement) => {
					// 创建一个新的 PartOfSpeech 对象
					const partOfSpeech = {
						wordPrototype: "",
						type: "",
						pronunciationUK: {
							phonetic: "",
							pronUrl: ""
						},
						pronunciationUS: {
							phonetic: "",
							pronUrl: ""
						},
						definitions: [],
						phrases: [],
						phraseDefinitions: []
					};
					
					// 提取单词原型
					partOfSpeech.wordPrototype = $(entryElement).find('.headword.dhw').first().text().trim();
					partOfSpeech.type = $(entryElement).find('.posgram.dpos-g.hdib.lmr-5').text().trim();
					
					// 提取 UK 发音信息
					const ukPronunciation = $(entryElement).find('.uk.dpron-i');
					partOfSpeech.pronunciationUK.phonetic = ukPronunciation.find(".pron.dpron").text().trim();
					const ukAudioUrl = ukPronunciation.find('audio source[type="audio/mpeg"]').attr('src');
					if (ukAudioUrl) {
						partOfSpeech.pronunciationUK.pronUrl = `https://dictionary.cambridge.org${ukAudioUrl}`;
					}
					
					// 提取 US 发音信息
					const usPronunciation = $(entryElement).find('.us.dpron-i');
					partOfSpeech.pronunciationUS.phonetic = usPronunciation.find(".pron.dpron").text().trim();
					const usAudioUrl = usPronunciation.find('audio source[type="audio/mpeg"]').attr('src');
					if (usAudioUrl) {
						partOfSpeech.pronunciationUS.pronUrl = `https://dictionary.cambridge.org${usAudioUrl}`;
					}

					// 提取英文和中文释义，确保不在短语块中
					$(entryElement).find('div.def-block.ddef_block').each((j, defElement) => {
						const isInPhraseBlock = $(defElement).closest('.phrase-block.dphrase-block').length > 0;
						if (!isInPhraseBlock) {
							const englishDefinition = $(defElement).find('.def.ddef_d.db').text().trim();
							const chineseDefinition = $(defElement).find('.trans.dtrans.dtrans-se').not('.hdb').text().trim();
							partOfSpeech.definitions.push({
								enMeaning: englishDefinition,
								chMeaning: chineseDefinition
							});
						}
					});

					// 提取短语和短语释义
					$(entryElement).find('.phrase-block.dphrase-block').each((j, phraseElement) => {
						const phraseText = $(phraseElement).find('.phrase-head.dphrase_h .phrase-title').text().trim();
						partOfSpeech.phrases.push(phraseText);

						$(phraseElement).find('.def-block.ddef_block').each((k, phraseDefElement) => {
							const englishPhraseDefinition = $(phraseDefElement).find('.def.ddef_d.db').text().trim();
							const chinesePhraseDefinition = $(phraseDefElement).find('.trans.dtrans span.dtrans').text().trim();
							partOfSpeech.phraseDefinitions.push({
								enMeaning: englishPhraseDefinition,
								chMeaning: chinesePhraseDefinition
							});
						});
					});

					// 确保每次推入的是独立对象
					pageResults.partOfSpeech.push({ ...partOfSpeech });
				});
				
				if (pageResults.partOfSpeech.length !== 0) {
					return pageResults;
				}
			} catch (error) {
				console.error(`Error fetching data from ${url}:`, error);
				continue;
			}
		}
		
		// 如果没有获取到有效数据，返回默认值
		return {
			wordUrl: "",
			partOfSpeech: [{
				type: "",
				wordPrototype: "",
				pronunciationUK: {
					phonetic: "",
					pronUrl: ""
				},
				pronunciationUS: {
					phonetic: "",
					pronUrl: ""
				},
				definitions: [],
				phrases: [],
				phraseDefinitions: []
			}]
		};
	} catch (error) {
		console.error('Error fetching Cambridge data:', error);
		throw error;
	}
}

// 开发环境下的热重载功能
if (process.env.NODE_ENV !== 'production') {
	try {
		const electronReload = require('electron-reload');
		
		// 监视的文件和目录
		electronReload(__dirname, {
			electron: path.join(__dirname, '../node_modules/electron'),
			hardResetMethod: 'quit', // 使用quit而不是exit，以避免强制关闭
			ignored: [
				/node_modules/,
				/epubs/,
				/[\/\\]\./,
				/.*\.json$/
			]
		});
		
		console.log('热重载功能已启用 - 修改src目录下的文件将自动重新加载应用');
	} catch (error) {
		console.error('热重载功能加载失败:', error);
	}
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
	// eslint-disable-line global-require
	app.quit();
}

const DEFAULT_WINDOW_WIDTH = 1280
const DEFAULT_WINDOW_HEIGHT = 720 

const createWindow = () => {
	// Create the browser window.
	const mainWindow = new BrowserWindow({
		width: DEFAULT_WINDOW_WIDTH,
		height: DEFAULT_WINDOW_HEIGHT,
		resizable: false,
		show: false,
		frame: false,
		icon: path.join(__dirname, "icon.ico"),
		webPreferences: {
			webviewTag: true,
			nodeIntegration: true,
			contextIsolation: true,
			enableRemoteModule: false,
			preload: path.join(__dirname, './preload.js'),
		},
	});

	// Load the index.html of the app.
	mainWindow.loadFile(path.join(__dirname, 'pages', 'library.html'));

	// IPC handlers
	ipcMain.handle('appVersion', () => app.getVersion());
	ipcMain.handle('storePath', () => path.resolve(path.join(app.getPath('userData'), 'localStorage')).split(path.sep).join("/"));
	
	// Cambridge词典查询API
	ipcMain.handle('get-cambridge-word-info', async (event, word) => {
		try {
			console.log(`尝试查询Cambridge词典: ${word}`);
			const wordInfo = await fetchCambridgeData(word);
			console.log('Cambridge词典查询成功');
			return wordInfo;
		} catch (error) {
			console.error('Cambridge词典查询失败:', error);
			return { error: '查询Cambridge词典失败' };
		}
	});

	// Open external URLs in default browser
	mainWindow.webContents.setWindowOpenHandler((details) => {
		shell.openExternal(details.url);
		return { action: 'deny' };
	});

	// Show the window when the content finishes loading
	mainWindow.webContents.on('did-finish-load', () => {
		setTimeout(() => mainWindow.show(), 50); // Delayed show to avoid visual glitches
	});

	// Register global shortcut for refreshing the window
	globalShortcut.register('f5', () => {
		mainWindow.reload();
	});

	// 开发环境下添加Ctrl+R快捷键重载
	if (process.env.NODE_ENV === 'development') {
		globalShortcut.register('CommandOrControl+R', () => {
			console.log('手动触发重新加载');
			mainWindow.reload();
		});
	}

	// Event listeners for window actions
	ipcMain.on('closeApp', () => {
		mainWindow.close();
	});
	ipcMain.on('minimizeApp', () => {
		mainWindow.minimize();
	});
	ipcMain.on('resizeApp', () => {
		if (!mainWindow.isMaximized()) {
			mainWindow.maximize();
		} else {
			mainWindow.unmaximize();
		}
	});
	ipcMain.on('unmaximizeApp', () => {
		if (mainWindow.isMaximized()) {
			mainWindow.unmaximize();
		}
	});
	ipcMain.on('setWindowResizable', () => {
		mainWindow.setResizable(true)
	});
	ipcMain.on('unsetWindowResizable', () => {
		mainWindow.unmaximize();
		mainWindow.setSize(1280,720,false);
		mainWindow.center()
		mainWindow.setResizable(false);
	});
	// Show a file dialog to choose an EPUB file
	ipcMain.on('openBookChooserDialog', () => {
		dialog
			.showOpenDialog({
				properties: ['openFile'],
				filters: [
					{ name: 'Epub Files', extensions: ['epub','pdf','mobi'] }
				]
			})
			.then(result => {
				if (!result.canceled) {
					// Send the selected file path to the renderer process
					mainWindow.webContents.send('bookChosenSuccess', result.filePaths[0]);
				}
			})
			.catch(err => {
				console.log(err);
			});
	});
	ipcMain.on('openCoverChooserDialog', () => {
		dialog
			.showOpenDialog({
				properties: ['openFile'],
				filters: [
					{ name: 'Cover image', extensions: ['png','jpg'] }
				]
			})
			.then(result => {
				if (!result.canceled) {
					// Send the selected file path to the renderer process
					mainWindow.webContents.send('coverChosenSuccess', result.filePaths[0]);
				}
			})
			.catch(err => {
				console.log(err);
			});
	});

	mainWindow.on('resize', () => {
		mainWindow.webContents.send('updateMaximizeIcon', mainWindow.isMaximized());
	});
};

// Event listener for when Electron has finished initialization
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	// Re-create the window when the dock icon is clicked (only for macOS)
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});
