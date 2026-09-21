import {createCategory, getOneCategory, getAllCategories, editCategory, deleteCategory, validateCategory} from "../controllers/categories.js"
import express ,{Router} from "express"


const router = Router()

router.use(express.json())

router.post("/", validateCategory, createCategory)
router.get("/:categoryId", getOneCategory)

router.get("/", getAllCategories)

router.put("/:categoryId", validateCategory, editCategory)

router.delete("/:categoryId", deleteCategory)





export default router