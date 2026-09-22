import multer from "multer"
import path from "node:path";

const uploadDirectory = path.resolve("public");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDirectory);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, file.fieldname + '-' + uniqueSuffix+"."+extension);
  },
});

const upload = multer({ storage: storage });

export const uploadBulk = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB

  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (![".csv", ".xlsx"].includes(extension)) {
      cb(new Error("Upload a .csv or .xlsx file"));
      return;
    }

    cb(null, true);
  },
});


export default upload