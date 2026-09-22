import {
  validateProduct,
  createOneProduct,
  putProduct,
  patchProduct,
  deleteProduct,
  getOneProduct,
  getAllProducts,
  getCampaignProducts,
  getCategoryProducts,
  createBulkProducts
} from "../controllers/product.js"

import passport from "passport"

//import upload from "../utils/multerUpload.js"

import express, {Router} from "express"
import upload, {uploadBulk} from "../utils/multerUpload.js"
import verifyIfAdmin from "../utils/verifyIfAdmin.js"


const router = Router()



router.get("/:productId", getOneProduct)
router.get("/campaign/:campaignId", getCampaignProducts)
router.get("/category/:categoryId", getCategoryProducts)
router.get("/", getAllProducts)
router.use(passport.authenticate("jwt", { session: false }));

router.post("/",upload.array("images", 6) ,validateProduct, createOneProduct)
router.post("/bulk", verifyIfAdmin,uploadBulk.single("file") , createBulkProducts)

router.put("/:productId",upload.array("images", 6),validateProduct,putProduct)

router.use(express.json())

router.patch("/:productId", validateProduct,patchProduct)
router.delete("/:productId", deleteProduct)


export default router

