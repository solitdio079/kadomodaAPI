import express,{Router} from "express"

import { createCart, editCart, getCart,  validateCartProduct, clearCart } from "../controllers/cart.js"

const router = Router()

router.use(express.json())

router.post("/", createCart)
router.get("/", getCart)
router.put("/:cartId", validateCartProduct, editCart)
router.delete("/:cartId", clearCart)

export default router