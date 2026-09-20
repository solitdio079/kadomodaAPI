import "../utils/passportLocal.js"
import express, {Router} from "express"
import passport from "passport"
import {sendUserToken, signUpUser, validateUser} from "../controllers/auth.js"
const router = Router()
router.use(express.json())


router.post("/signup", validateUser,signUpUser)
router.post('/login', passport.authenticate('local',{session:false}), sendUserToken)

export default router