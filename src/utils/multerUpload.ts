import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { RequestHandler } from 'express';
import { HttpError } from '../middleware/http.js';
export const uploadDirectory = path.resolve(process.env.UPLOAD_DIR || 'public');
// CSV/XLSX imports are private temporary files, never under the static web root.
const importDirectory = path.resolve(process.env.IMPORT_DIR || '/tmp/kadomoda-imports');
mkdirSync(uploadDirectory, { recursive: true });
mkdirSync(importDirectory, { recursive: true });
const storage = (directory: string) => multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, directory),
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});
const types: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const upload = multer({
  storage: storage(uploadDirectory), limits: { fileSize: 5 * 1024 * 1024, files: 6, fields: 20, fieldSize: 20000 },
  fileFilter: (_req, file, cb) => {
    if (types[path.extname(file.originalname).toLowerCase()] !== file.mimetype)
      return cb(new HttpError(400, 'INVALID_IMAGE', 'Yalnızca JPG, PNG veya WebP görselleri yükleyin.'));
    cb(null, true);
  },
});
export const verifyImageUploads: RequestHandler = async (req, _res, next) => {
  try {
    const files = req.file ? [req.file] : Array.isArray(req.files) ? req.files : [];
    for (const file of files) {
      const data = await readFile(file.path);
      const ext = path.extname(file.filename);
      const valid = ext === '.png' ? data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
        : ext === '.webp' ? data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP'
        : data[0] === 255 && data[1] === 216 && data[2] === 255;
      if (!valid) throw new HttpError(400, 'INVALID_IMAGE', 'Dosya içeriği geçerli bir görsel değil.');
    }
    next();
  } catch (error) { next(error); }
};
export const uploadBulk = multer({
  storage: storage(importDirectory), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 3, fieldSize: 100 },
  fileFilter: (_req, file, cb) => {
    if (!['.csv', '.xlsx'].includes(path.extname(file.originalname).toLowerCase()))
      return cb(new HttpError(400, 'INVALID_FILE', 'CSV veya XLSX dosyası yükleyin.'));
    cb(null, true);
  },
});
export default upload;
