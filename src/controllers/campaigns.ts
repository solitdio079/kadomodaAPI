import {prisma} from "../lib/prisma.js"
import {CampaignValidator} from "../validation/validators.js"
import {Role} from "../generated/prisma/index.js"
import {type Request, type Response, type NextFunction} from "express"

interface CampaignParams {
    campaignId?: string
}

interface CampaignBody{
    name: string
    discount: number
}

async function validateCampaign(req:Request<CampaignParams,any,CampaignBody>, res:Response, next:NextFunction){
    const result = CampaignValidator.safeParse(req.body);
  if (!result.success) {
    next(result.error);
  } else {
    req.body = result.data;
    next();
  }

}

async function createCampaign(req:Request<CampaignParams,any,CampaignBody>, res:Response, next:NextFunction){
    // Permission checks
    if(!req.user) return res.status(403).json({error:"Unauthorized"})
    if(req.user.role !== Role.ADMIN) return res.status(403).json({error:"Unauthorized"})

    // check if campaign image exist
    if(!req.file) return res.status(403).json({error: "Please enter an image"})
    const image = req.file.filename

    try{
        const {name, discount} = req.body

        const campaign = await prisma.campaign.create({
            data:{
                image,
                name,
                discount
            }
        })
        return res.json({data:campaign, message: "Campaign created with success!"})

    }catch(err){
        next(err)
    }


}

async function putCampaign(req:Request<CampaignParams,any,CampaignBody>, res:Response, next:NextFunction){
    // Permission checks
    if(!req.user) return res.status(403).json({error:"Unauthorized"})
    if(req.user.role !== Role.ADMIN) return res.status(403).json({error:"Unauthorized"})

    
    const {campaignId} = req.params
    if(!campaignId) return res.status(403).json({error: "ID param is missing!"})

    // check if campaign image exist
    if(!req.file) return res.status(403).json({error: "Please enter an image"})
    const image = req.file.filename

    try{
        const {name,discount} = req.body
        const campaign = await prisma.campaign.update({
            where: {
                id: parseInt(campaignId)
            },
            data: {
                name,
                discount
            }
        })

        return res.json({data:campaign, message: "Campaign edited with success!"})

    }catch(err){
        next(err)
    }

}

async function patchCampaign(req:Request<CampaignParams,any,CampaignBody>, res:Response, next:NextFunction){
    // Permission checks
    if(!req.user) return res.status(403).json({error:"Unauthorized"})
    if(req.user.role !== Role.ADMIN) return res.status(403).json({error:"Unauthorized"})

    
    const {campaignId} = req.params
    if(!campaignId) return res.status(403).json({error: "ID param is missing!"})

    try{
        const {name,discount} = req.body
        const campaign = await prisma.campaign.update({
            where: {
                id: parseInt(campaignId)
            },
            data: {
                name,
                discount
            }
        })

        return res.json({data:campaign, message: "Campaign edited with success!"})

    }catch(err){
        next(err)
    }

}

async function getOneCampaign(req:Request<CampaignParams>, res:Response, next:NextFunction){
    const {campaignId} = req.params
    if(!campaignId) return res.status(403).json({error: "ID param is missing!"})
    try{
        const campaign = await prisma.campaign.findUnique({
            where:{
                id:parseInt(campaignId)
            }
        })
        if(!campaign) return res.status(404).json({error: "Campaign does not exist!"})
        
        return res.json({data:campaign})

    }catch(err){
        next(err)
    }
}

async function getAllCampaign(req:Request<CampaignParams>, res:Response, next:NextFunction){
    //const {campaignId} = req.params
    try{
        const campaigns = await prisma.campaign.findMany()
       
        return res.json({data:campaigns})

    }catch(err){
        next(err)
    }
}


async function deleteCampaign(req:Request<CampaignParams,any,CampaignBody>, res:Response, next:NextFunction){
    // Permission checks
    if(!req.user) return res.status(403).json({error:"Unauthorized"})
    if(req.user.role !== Role.ADMIN) return res.status(403).json({error:"Unauthorized"})

    
    const {campaignId} = req.params
     if(!campaignId) return res.status(403).json({error: "ID param is missing!"})

    try{
        const campaign = await prisma.campaign.delete({
            where: {
                id: parseInt(campaignId)
            },
          
        })

        return res.json({data:campaign, message: "Campaign deleted with success!"})

    }catch(err){
        next(err)
    }

}


export {createCampaign,validateCampaign,putCampaign,patchCampaign,getOneCampaign,getAllCampaign,deleteCampaign}









