import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3500;

// distディレクトリの絶対パス
const distPath = path.join(__dirname, 'dist');

// どの階層からでも assets へのアクセスは dist/assets を返すようにする
// これにより、サブディレクトリ (例: /app/) でアクセスした際などの
// 相対パス解決 (例: /app/assets/style.css) が正しく動作するようになる
app.get(/.*\/assets\/.*/, (req, res, next) => {
    const match = req.url.match(/\/assets\/(.*)$/);
    if (match) {
        res.sendFile(path.join(distPath, 'assets', match[1]), (err) => {
            if (err) next();
        });
    } else {
        next();
    }
});

// distディレクトリを静的ファイルとして配信（ルートアクセス用）
app.use(express.static(distPath));

// SPAのためのフォールバック設定
app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
