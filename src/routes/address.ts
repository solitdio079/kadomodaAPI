import {
  validateAddress,
  createAddress,
  editAddress,
  getUserAddresses,
  getOneAddress,
  deleteAddress,
} from "../controllers/address.js"


import express, {Router} from "express" 


const router = Router()

router.use(express.json())

router.post("/", validateAddress, createAddress)
router.put("/:addressId", validateAddress, editAddress)
router.get("/", getUserAddresses)
router.get("/:addressId", getOneAddress)
router.delete("/:addressId", deleteAddress)


export default router