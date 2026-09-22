import {createCategory, getOneCategory, getAllCategories, editCategory, deleteCategory, validateCategory} from "../controllers/categories.js"
import express ,{Router} from "express"
import passport from "passport"


const router = Router()

router.use(express.json())
router.get("/:categoryId", getOneCategory)
router.get("/", getAllCategories)
router.use(passport.authenticate("jwt", { session: false }));
router.post("/", validateCategory, createCategory)

router.put("/:categoryId", validateCategory, editCategory)

router.delete("/:categoryId", deleteCategory)





export default router