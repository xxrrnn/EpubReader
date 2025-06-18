const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const fse = require('fs-extra');
const Vibrant = require('node-vibrant');
const Epub = require("epub2").EPub;
const path = require('path');
const convert = require('ebook-convert');

// Define allowed extensions for books
const allowedExtensions = ['epub','pdf','mobi'];

/**
 * Get the store path.
 * Default store path is ...\AppData\Roaming\epub-reader\localStorage.
 * @returns {Promise<string>} The store path.
 */
const getStorePath = async () => await ipcRenderer.invoke('storePath');

/**
 * Add and save an EPUB book locally and extract metadata.
 * If everything goes fine, it returns the updated books in JSON.
 * @param {string} epubPath - The path to the EPUB file.
 * @returns {Promise<Array>} The updated books in JSON.
 */
const addEpubBook = async function (epubPath) {
    var response = await Epub.createAsync(epubPath, null, null)
        .then(async function (epub) {

            // Get the current book data for updating it later
            const jsonData = await getBooks();

            let storePath = await getStorePath();

            const title = epub.metadata.title ?? 'undefined';
            const author = epub.metadata.creator ?? null;

            // Generate folder name using title and author
			// Replace non alphanumeric character and replace spaces with "-"
            const bookFolderAuthorName = author?.replace(/[^\w\s]|_/g, '').replace(/\s+/g, '-').toLowerCase() ?? 'undefined';
            const bookFolderName = epub.metadata.title.replace(/[^\w\s]|_/g, '').replace(/\s+/g, '-').toLowerCase() + "-" + bookFolderAuthorName;
            const bookFolderPath = path.join(storePath, 'epubs', bookFolderName);

            const coverPath = epub.metadata.cover ? epub.metadata.cover + ".png" : null;

            // Check if the book already exists
            if (!fs.existsSync(bookFolderPath)) {
                var newBook = {
                    "title": title,
                    "author": author,
                    "bookYear": epub.metadata.date?.split('-')[0] ?? null,
                    "lang": epub.metadata.language?.split('-')[0].toUpperCase() ?? null,
                    "bookFolderName": bookFolderName,
                    "coverPath": coverPath,
                    "lastTimeOpened": new Date(),
                    "lastPageOpened": null,
                    "savedPages": []
                };
                // Update the virtual book JSON data
                jsonData.push(newBook);
                // Update the local book JSON
                fse.writeJsonSync(path.join(storePath, 'assets', 'json', 'books.json'), jsonData, { spaces: 4 });

                // Create the folder and move the EPUB file there
                fs.mkdirSync(bookFolderPath, { recursive: true });
                fs.copyFileSync(epubPath, path.join(bookFolderPath, "epub.epub"));

                // Save the cover image locally if exists
                if (coverPath) {
					// Do not pass coverPath here because it contains the .png extension while metadata.cover only the id
                    await epub.getImageAsync(epub.metadata.cover).then(async function ([data, _]) {
                        await fse.outputFile(path.join(bookFolderPath, coverPath), data, 'binary');
                    }).catch((e) => { console.log("Error while trying to retrieve cover from book!", e); });
                } else {
					console.log("Couldn't find cover image")
				} 
                return jsonData;
            } else {
                displayAlert("Book already in library!", "default");
            }
            return false;
        });
    return response;
};

/**
 * Delete an EPUB book.
 * @param {string} bookFolderName - The folder name of the book to be deleted.
 * @returns {Promise<Array>} The updated books in JSON.
 */
const deleteEpubBook = async function (bookFolderName) {
	var response = await getBooks().then(async function (booksData) {
		var bookToRemove = await searchBook(booksData, bookFolderName);
		if (bookToRemove) {
			var bookIndex = booksData.indexOf(bookToRemove);
			// Remove it from list and update the data
			booksData.splice(bookIndex, 1);
			await fse.writeJson(path.join(await getStorePath(), 'assets', 'json', 'books.json'), booksData, { spaces: 4 });
			await fse.remove(path.join(await getStorePath(), 'epubs', bookFolderName));
			return booksData;
		}
	});
	return response;
};

/**
 * Update and EPUB book
 * @param {string} bookFolderName - The folder name of the book to be deleted
 * @param {dict} optional - Optional parameter to change: title, author, language, year
 * @returns {Promise<Array>} The updated books in JSON
*/

const updateEpubBook = async function (bookFolderName, optional) {
	try {
		const booksData = await getBooks();
		const storePath = await getStorePath();

		for (let i = 0; i < booksData.length; i++) {
			if (booksData[i].bookFolderName == bookFolderName) {
				if (optional.title) booksData[i].title = optional.title;
				if (optional.author) booksData[i].author = optional.author;
				if (optional.language) booksData[i].lang = optional.language;
				if (optional.year) booksData[i].bookYear = optional.year;				
				if (optional.cover && path.basename(optional.cover) != booksData[i].coverPath) {
					const coverExt = path.parse(optional.cover).ext   
					await fse.copy(optional.cover,path.join(storePath,'epubs',booksData[i].bookFolderName,'cover'+coverExt))
					booksData[i].coverPath = 'cover'+coverExt;				
				}
				break;
			}
		}
		await fse.writeJson(path.join(storePath, 'assets', 'json', 'books.json'), booksData, { spaces: 4 });

		displayAlert('Update successfully','success')

		return booksData;
	} catch (e) {
		console.log("Error while updating book: ", e);
	}
};

/**
 * Get the books from the JSON data.
 * @returns {Promise<Array>} The books in JSON.
 */
const getBooks = async function () {
    const bookJsonPath = path.join(await getStorePath(), 'assets', 'json', 'books.json');
    if (!fs.existsSync(bookJsonPath)) {
		// If JSON doesn't exists create it
        await fse.outputJson(bookJsonPath, [], { spaces: 4 });
    }
    return JSON.parse(fs.readFileSync(bookJsonPath, 'utf-8'));
};

/**
 * Get user settings from the JSON file.
 * @returns {Promise<Object>} The user settings.
 */
const getUserSettings = async function () {
    let storePath = await getStorePath();
    var userSettingsJsonPath = path.join(storePath, 'assets', 'json', 'user_settings.json');
    if (!fs.existsSync(userSettingsJsonPath)) {
        // Create the user settings JSON file with default settings
        const userDefaultSettings = {
            book: {
                background_color_style: 'default',
                font_size_percent: 100,
                typeface: 'IBM Plex Serif'
            }
        };
        await fse.outputJson(userSettingsJsonPath, userDefaultSettings, { spaces: 4 });
    }
    return JSON.parse(fs.readFileSync(userSettingsJsonPath, 'utf-8'));
};

/**
 * Save user settings to the JSON file.
 * @param {Object} userSettings - The user settings to be saved.
 */
const saveUserSettings = async function (userSettings) {
	let storePath = await getStorePath()
    if(userSettings) await fse.writeJsonSync(path.join(storePath,'assets','json','user_settings.json'), userSettings, {spaces: 4})
};

/**
 * Search for a book in the JSON data by bookFolderName.
 * @param {Array} bookData - The books in JSON data.
 * @param {string} targetFolderName - The folder name of the book to search for.
 * @returns {Object|null} The book object if found, otherwise null.
 */
const searchBook = async function (bookData, targetFolderName) {
    return bookData.find(book => book.bookFolderName === targetFolderName) || null;
};

/**
 * Change the value of a book in the JSON data.
 * @param {Array} bookData - The books in JSON data.
 * @param {string} targetFolderName - The folder name of the book.
 * @param {string} propertyKey - The key of the value to be changed.
 * @param {any} newPropertyValue - The new value.
 */
const changeBookValue = async function (bookData, targetFolderName, propertyKey, newPropertyValue) {
	for (let i = 0; i < bookData.length; i++) {
		if (bookData[i].bookFolderName == targetFolderName) {
			bookData[i][propertyKey] = newPropertyValue
			break;
		}
	}
	let storePath = await getStorePath()
	await fse.writeJsonSync(path.join(storePath,'assets','json','books.json'), bookData, { spaces: 4 })
};

/**
 * Get the vibrant color from the book cover image.
 * @param {string} bookFolderName - The folder name of the book.
 * @param {string} coverPath - The path to the book cover image.
 * @returns {Array|null} The vibrant color as an RGB array if found, otherwise null.
 */
const getVibrantColorFromImage = async function (bookFolderName, bookCoverPath) {
    const imgPath = await ensureBookCoverExistsAndReturn(bookFolderName, bookCoverPath);
    if (fs.existsSync(imgPath)) {
        const palette = await Vibrant.from(imgPath).getPalette();
        const vibrantColorRGB = palette.Vibrant.getRgb();
        return vibrantColorRGB;
    } else {
        console.log("Image path not found, the vibrant color may not be retrieved.");
        return null;
    }
};

/**
 * Ensure the book cover image exists and return its path.
 * @param {string} bookFolderName - The folder name of the book.
 * @param {string} coverPath - The path to the book cover image.
 * @returns {string} The path to the book cover image.
 */
const ensureBookCoverExistsAndReturn = async function (bookFolderName, bookCoverPath) {
    const defaultCoverPath = '../assets/images/undefined-cover.jpg';
    if (!bookCoverPath) {
        return defaultCoverPath;
    }
    let storePath = await getStorePath();
    const coverImagePath = path.posix.join(storePath, 'epubs', bookFolderName, bookCoverPath);
    return fs.existsSync(coverImagePath) ? coverImagePath : defaultCoverPath;
};

/**
 * Display an alert message.
 * @param {string} message - The message to display.
 * @param {string} type - The type of the alert (e.g., "default", "success", "error").
 */
const displayAlert = function (message, type) {
    let elem = document.querySelector('#alert-text');
    elem.innerHTML = message;
    elem.classList.add(`alert-${type}`);
    elem.addEventListener("animationend", function () {
        elem.classList.remove("active");
        elem.classList.remove(`alert-${type}`);
    });
    elem.classList.add('active');
};

/**
 * Check if the extension is allowed.
 * @param {string} ext - The extension to check.
 * @returns {boolean} True if the extension is allowed, otherwise false.
 */
const isAllowedExtension = function (ext) {
    return allowedExtensions.includes(ext);
};

/**
 * Convert ebooks file allowed to epub and save in a local user folder.
 * @param {string} inputFilePath - File source path 
 * @returns {Promise<string>} The output file path
 */
const convertToEpub = async function (inputFilePath) {
	displayAlert("Converting file... It may take a while");
	const storePath = await getStorePath();
	// Unpack input file path
	const {dir,name,ext} = path.parse(inputFilePath);
	// Set the output file path in local folder
	const outputFilePath = path.join(storePath, 'tempConvertedBooks', name  + ".epub");

	return new Promise((resolve, reject) => {
		let convertOptions = {
			input: `"${inputFilePath}"`,
			output: `"${outputFilePath}"`,
		};

		convert(convertOptions, (err) => {
			if (err) {
				displayAlert("Couldn't convert file", 'default');
				console.log("Conversion error: ", err);
				reject(err); // Reject the promise with the error
			} else {
				console.log("Conversion success, book added in library!");
				resolve(outputFilePath); // Resolve the promise with the output file path
			}
		});
	});
};

contextBridge.exposeInMainWorld('bookConfig', {
    addEpubBook: async (epubPath) => await addEpubBook(epubPath),
    deleteEpubBook: async (bookFolderName) => await deleteEpubBook(bookFolderName),
    updateEpubBook: async (bookFolderName,optional) => await updateEpubBook(bookFolderName,optional),
    getBooks: async () => getBooks(),
    getUserSettings: async () => await getUserSettings(),
    saveUserSettings: async (json) => await saveUserSettings(json),
    searchBook: async (json, bookFolderName) => await searchBook(json, bookFolderName),
    changeBookValue: async (json, bookFolderName, key, newValue) => await changeBookValue(json, bookFolderName, key, newValue),
    getVibrantColorFromImage: async (bookFolderName,imagePath) => await getVibrantColorFromImage(bookFolderName,imagePath),
    ensureBookCoverExistsAndReturn: async (bookFolderName, coverPath) => await ensureBookCoverExistsAndReturn(bookFolderName, coverPath),
	isAllowedExtension: (ext) => isAllowedExtension(ext),
	convertToEpub: (inputFilePath) => convertToEpub(inputFilePath)
});

contextBridge.exposeInMainWorld('appConfig', {
    appVersion: () => ipcRenderer.invoke('appVersion'),
    dirname: async () => await getStorePath(),
	displayAlert: (content,type) => displayAlert(content,type),
    on(eventName, callback) {
        ipcRenderer.on(eventName, callback)
    },
    send: (channel,data) => ipcRenderer.send(channel, data),
    async invoke(eventName, ...params) {
        return await ipcRenderer.invoke(eventName, ...params)
    },
});

// 暴露Cambridge词典API给渲染进程
contextBridge.exposeInMainWorld('cambridgeAPI', {
    getWordInfo: async (word) => {
        console.log('请求Cambridge词典查询:', word);
        return await ipcRenderer.invoke('get-cambridge-word-info', word);
    },
    formatWordInfo: (wordInfo) => {
        if (!wordInfo || !wordInfo.partOfSpeech || wordInfo.partOfSpeech.length === 0) {
            return '未找到单词信息';
        }
        
        let result = '';
        
        wordInfo.partOfSpeech.forEach(pos => {
            if (pos.wordPrototype) {
                result += `📝 ${pos.wordPrototype} ${pos.type ? `(${pos.type})` : ''}\n`;
            }
            
            // 添加发音信息
            if (pos.pronunciationUK.phonetic) {
                result += `🇬🇧 ${pos.pronunciationUK.phonetic}\n`;
            }
            
            if (pos.pronunciationUS.phonetic) {
                result += `🇺🇸 ${pos.pronunciationUS.phonetic}\n`;
            }
            
            // 添加释义
            if (pos.definitions && pos.definitions.length > 0) {
                result += '\n📚 释义：\n';
                pos.definitions.forEach((def, idx) => {
                    result += `${idx + 1}. ${def.enMeaning}\n`;
                    if (def.chMeaning) {
                        result += `   ${def.chMeaning}\n`;
                    }
                });
            }
            
            // 添加短语
            if (pos.phrases && pos.phrases.length > 0) {
                result += '\n🔍 常用短语：\n';
                pos.phrases.forEach((phrase, idx) => {
                    result += `${idx + 1}. ${phrase}`;
                    if (pos.phraseDefinitions[idx]) {
                        result += ` - ${pos.phraseDefinitions[idx].enMeaning}`;
                        if (pos.phraseDefinitions[idx].chMeaning) {
                            result += ` (${pos.phraseDefinitions[idx].chMeaning})`;
                        }
                    }
                    result += '\n';
                });
            }
            
            result += '\n';
        });
        
        // 添加链接
        if (wordInfo.wordUrl) {
            result += `🔗 ${wordInfo.wordUrl}\n`;
        }
        
        return result;
    }
});


