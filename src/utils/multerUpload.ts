import multer from "multer"

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '../public');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = file.originalname.split(".")[1]
    cb(null, file.fieldname + '-' + uniqueSuffix+"."+extension);
  },
});

const upload = multer({ storage: storage });

export default upload