import  { validateOrder, createOrder, deleteOrder, editOrder, getOneOrder, getOrders } from "../controllers/order.js"


import express, {Router} from "express"

const router = Router()


router.use(express.json())

router.post("/", validateOrder, createOrder)
router.get("/:orderId", getOneOrder)
router.get("/", getOrders)
router.put("/:orderId", validateOrder,editOrder)
router.delete("/:orderId", deleteOrder)

export default router