import {createCampaign,validateCampaign,putCampaign,patchCampaign,getOneCampaign,getAllCampaign,deleteCampaign} from "../controllers/campaigns.js"
import upload from "../utils/multerUpload.js"
import express, {Router} from "express"
import passport from "passport"
const router = Router()


router.get("/:campaignId", getOneCampaign)
router.get("/", getAllCampaign)


router.use(passport.authenticate("jwt", { session: false }));
router.post("/",upload.single("image"),validateCampaign,createCampaign)
router.put("/:campaignId",upload.single("image"),validateCampaign,putCampaign)

router.use(express.json())

router.patch("/:campaignId", validateCampaign, patchCampaign)


router.delete("/:campaignId", deleteCampaign)
export default router