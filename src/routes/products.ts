import {
  validateProduct,
  createOneProduct,
  putProduct,
  patchProduct,
  deleteProduct,
  getOneProduct,
  getAllProducts,
} from "../controllers/product.js"

import express, {Router} from "express"
import upload from "../utils/multerUpload.js"


const router = Router()

router.post("/", upload.array("images", 6) ,validateProduct, createOneProduct)

router.put("/:productId",upload.array("images", 6),validateProduct,putProduct)

router.use(express.json())

router.get("/:productId", getOneProduct)
router.get("/", getAllProducts)

router.put("/:productId", validateProduct,patchProduct)
router.delete("/:productId", deleteProduct)


export default router

