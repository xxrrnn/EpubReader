/**
 * 热重载启动脚本
 * 
 * 使用方法：node hot-start.js
 * 
 * 该脚本会设置NODE_ENV=development环境变量并启动应用
 * 监视src目录下的文件变化，自动重新加载应用
 */

const { spawn } = require('child_process');
const path = require('path');
const electron = require('electron');

// 设置环境变量
process.env.NODE_ENV = 'development';

console.log('正在以开发模式启动应用...');
console.log('热重载功能已启用 - 修改src目录下的文件将自动重新加载应用');
console.log('按 Ctrl+R 或 F5 可以手动重新加载应用');

// 启动Electron应用
const child = spawn(electron, [path.join(__dirname, 'src/index.js')], {
  stdio: 'inherit',
  env: process.env
});

child.on('close', (code) => {
  console.log(`应用已退出，退出码: ${code}`);
  process.exit(code);
});

// 捕获Ctrl+C事件，优雅地关闭应用
process.on('SIGINT', () => {
  console.log('正在关闭应用...');
  child.kill();
}); 